"""
AI provider integration service (LangChain backend).

Mirrors store/store-backend/src/modules/ai/application/services/llm.service.ts:
  - persists provider + encrypted API key (one row per provider).
  - exposes a `get_chat_model()` LangChain `BaseChatModel` factory used
    by future agents (LangGraph, ReAct, etc).
  - lists available models per provider (dynamic via API + static fallback).
  - validates a key by issuing a tiny ping to the provider.

Today only `google` (Gemini) is wired up; `openai` and `anthropic` are
reserved in the enum so adding them is just plugging in the LangChain
adapter and a `_fetch_*_models` helper.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.secrets import decrypt_secret, encrypt_secret, last4
from app.models.ai_provider import (
    AiProvider,
    AiProviderCode,
    AiProviderStatus,
)
from app.models.user import User
from app.schemas.ai_provider import (
    AiModelInfo,
    AiModelListResult,
    AiProviderCreate,
    AiProviderTestResult,
    AiProviderUpdate,
)


logger = logging.getLogger("app.ai")


# --------------------------------------------------------------- static models


GOOGLE_MODELS: list[AiModelInfo] = [
    AiModelInfo(
        id="gemini-2.5-pro",
        name="Gemini 2.5 Pro",
        provider=AiProviderCode.GOOGLE,
        context_window=1_048_576,
        max_output_tokens=65_536,
    ),
    AiModelInfo(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider=AiProviderCode.GOOGLE,
        context_window=1_048_576,
        max_output_tokens=65_536,
    ),
    AiModelInfo(
        id="gemini-2.5-flash-lite",
        name="Gemini 2.5 Flash-Lite",
        provider=AiProviderCode.GOOGLE,
        context_window=1_048_576,
        max_output_tokens=65_536,
    ),
    AiModelInfo(
        id="gemini-2.0-flash",
        name="Gemini 2.0 Flash",
        provider=AiProviderCode.GOOGLE,
        context_window=1_048_576,
        max_output_tokens=8192,
    ),
]

STATIC_MODELS: dict[AiProviderCode, list[AiModelInfo]] = {
    AiProviderCode.GOOGLE: GOOGLE_MODELS,
    AiProviderCode.OPENAI: [],  # reserved
    AiProviderCode.ANTHROPIC: [],  # reserved
}

GOOGLE_INCLUDE = re.compile(r"^gemini-", re.IGNORECASE)
GOOGLE_EXCLUDE = re.compile(
    r"preview|exp|thinking|embedding|aqa|imagen|veo", re.IGNORECASE
)


class AiService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --------------------------------------------------------------- queries

    async def list_all(self) -> list[AiProvider]:
        result = await self.session.execute(
            select(AiProvider).order_by(AiProvider.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, provider_id: int) -> AiProvider | None:
        result = await self.session.execute(
            select(AiProvider).where(AiProvider.id == provider_id)
        )
        return result.scalar_one_or_none()

    async def get_by_provider(self, provider: AiProviderCode) -> AiProvider | None:
        result = await self.session.execute(
            select(AiProvider).where(AiProvider.provider == provider)
        )
        return result.scalar_one_or_none()

    async def get_default(self) -> AiProvider | None:
        """The active provider used by agents (first `is_default=True && enabled`)."""
        result = await self.session.execute(
            select(AiProvider)
            .where(
                AiProvider.is_default.is_(True),
                AiProvider.enabled.is_(True),
                AiProvider.status != AiProviderStatus.DISCONNECTED,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    # --------------------------------------------------------------- mutations

    async def upsert(
        self, payload: AiProviderCreate, current_user: User
    ) -> AiProvider:
        """
        Insert or replace the row for `payload.provider`. The newly saved row
        becomes the default, and other defaults are demoted (last write wins).
        """
        existing = await self.get_by_provider(payload.provider)

        if existing is None:
            row = AiProvider(
                provider=payload.provider,
                display_name=payload.display_name or _default_display_name(payload.provider),
                model=payload.model,
                max_tokens=payload.max_tokens,
                api_key_ciphertext=encrypt_secret(payload.api_key),
                api_key_last4=last4(payload.api_key),
                enabled=payload.enabled,
                is_default=True,
                status=AiProviderStatus.PENDING,
                connected_by_user_id=current_user.id,
            )
            self.session.add(row)
        else:
            existing.display_name = payload.display_name or existing.display_name
            existing.model = payload.model
            existing.max_tokens = payload.max_tokens
            existing.api_key_ciphertext = encrypt_secret(payload.api_key)
            existing.api_key_last4 = last4(payload.api_key)
            existing.enabled = payload.enabled
            existing.is_default = True
            existing.status = AiProviderStatus.PENDING
            existing.last_error = None
            self.session.add(existing)
            row = existing

        # Demote others
        others = await self.session.execute(
            select(AiProvider).where(AiProvider.provider != payload.provider)
        )
        for other in others.scalars().all():
            if other.is_default:
                other.is_default = False
                self.session.add(other)

        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def update(
        self, provider: AiProvider, payload: AiProviderUpdate
    ) -> AiProvider:
        if payload.model is not None:
            provider.model = payload.model
        if payload.api_key is not None:
            provider.api_key_ciphertext = encrypt_secret(payload.api_key)
            provider.api_key_last4 = last4(payload.api_key)
            provider.status = AiProviderStatus.PENDING
            provider.last_error = None
        if payload.max_tokens is not None:
            provider.max_tokens = payload.max_tokens
        if payload.display_name is not None:
            provider.display_name = payload.display_name
        if payload.enabled is not None:
            provider.enabled = payload.enabled

        self.session.add(provider)
        await self.session.commit()
        await self.session.refresh(provider)
        return provider

    async def disconnect(self, provider: AiProvider) -> None:
        provider.status = AiProviderStatus.DISCONNECTED
        provider.enabled = False
        provider.is_default = False
        self.session.add(provider)
        await self.session.commit()

    async def _mark_status(
        self, provider: AiProvider, *, ok: bool, error: str | None
    ) -> None:
        provider.status = (
            AiProviderStatus.CONNECTED if ok else AiProviderStatus.ERROR
        )
        provider.last_error = error
        provider.last_synced_at = datetime.now(timezone.utc)
        self.session.add(provider)
        await self.session.commit()

    # ---------------------------------------------------------------- models

    async def list_models(
        self, provider: AiProviderCode, *, include_static: bool = True
    ) -> AiModelListResult:
        """List models from the provider's API; falls back to static list."""
        api_key = await self._maybe_decrypt_key(provider)
        try:
            if provider == AiProviderCode.GOOGLE and api_key:
                models = await _fetch_google_models(api_key)
                if models:
                    return AiModelListResult(models=models, source="api")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Dynamic model fetch failed for %s: %s", provider, exc)

        if include_static:
            return AiModelListResult(
                models=STATIC_MODELS.get(provider, []), source="static"
            )
        return AiModelListResult(models=[], source="static")

    async def _maybe_decrypt_key(self, provider: AiProviderCode) -> str | None:
        row = await self.get_by_provider(provider)
        if row is None:
            return None
        try:
            return decrypt_secret(row.api_key_ciphertext)
        except ValueError:
            return None

    # ----------------------------------------------------------------- test

    async def test_provider(self, provider: AiProvider) -> AiProviderTestResult:
        """
        Fire a tiny ping to the provider's API to validate the key + model.
        For Google we hit the public `models/{model}:generateContent` with a
        single short prompt.
        """
        try:
            api_key = decrypt_secret(provider.api_key_ciphertext)
        except ValueError:
            await self._mark_status(provider, ok=False, error="invalid_ciphertext")
            return AiProviderTestResult(ok=False, detail="Şifreli anahtar çözülemedi.")

        if provider.provider == AiProviderCode.GOOGLE:
            ok, detail, sample = await _ping_google(api_key, provider.model)
        else:
            ok, detail, sample = (
                False,
                f"Bu provider henüz desteklenmiyor: {provider.provider.value}",
                None,
            )

        await self._mark_status(provider, ok=ok, error=None if ok else detail)
        return AiProviderTestResult(ok=ok, detail=detail, sample_text=sample)

    # ---------------------------------------------------------------- factory

    async def get_chat_model(self, provider_row: AiProvider | None = None) -> Any:
        """
        Return a configured LangChain BaseChatModel for the active provider.

        Imported lazily so the rest of the app doesn't pay the LangChain import
        cost at boot.
        """
        row = provider_row or await self.get_default()
        if row is None or not row.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aktif AI sağlayıcısı yok. Önce entegrasyonu bağlayın.",
            )
        api_key = decrypt_secret(row.api_key_ciphertext)

        if row.provider == AiProviderCode.GOOGLE:
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                api_key=api_key,
                model=row.model,
                max_output_tokens=row.max_tokens,
            )

        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{row.provider.value} provider henüz LangChain ile bağlı değil.",
        )


# ---------------------------------------------------------------- helpers


def _default_display_name(provider: AiProviderCode) -> str:
    return {
        AiProviderCode.GOOGLE: "Google Gemini",
        AiProviderCode.OPENAI: "OpenAI",
        AiProviderCode.ANTHROPIC: "Anthropic Claude",
    }[provider]


async def _fetch_google_models(api_key: str) -> list[AiModelInfo]:
    base = settings.GOOGLE_GENAI_BASE_URL.rstrip("/")
    url = f"{base}/v1beta/models"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params={"key": api_key})
    resp.raise_for_status()
    data = resp.json()

    models: list[AiModelInfo] = []
    for m in data.get("models", []):
        raw_id: str = (m.get("name") or "").replace("models/", "")
        if not GOOGLE_INCLUDE.search(raw_id):
            continue
        if GOOGLE_EXCLUDE.search(raw_id):
            continue
        if "generateContent" not in (m.get("supportedGenerationMethods") or []):
            continue
        models.append(
            AiModelInfo(
                id=raw_id,
                name=m.get("displayName") or _format_google_name(raw_id),
                provider=AiProviderCode.GOOGLE,
                context_window=m.get("inputTokenLimit"),
                max_output_tokens=m.get("outputTokenLimit"),
            )
        )

    # Sort newest-first by version-aware natural sort on id.
    models.sort(key=lambda x: x.id, reverse=True)
    return models


def _format_google_name(raw_id: str) -> str:
    return (
        raw_id.replace("gemini-", "Gemini ")
        .replace("-", " ")
        .title()
        .replace("Gemini ", "Gemini ")
    )


async def _ping_google(api_key: str, model: str) -> tuple[bool, str, str | None]:
    base = settings.GOOGLE_GENAI_BASE_URL.rstrip("/")
    url = f"{base}/v1beta/models/{model}:generateContent"
    body = {
        "contents": [
            {"role": "user", "parts": [{"text": "Say 'ok' in one word."}]}
        ],
        "generationConfig": {"maxOutputTokens": 16, "temperature": 0.0},
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, params={"key": api_key}, json=body)
    except httpx.HTTPError as exc:
        return False, f"Ağ hatası: {exc.__class__.__name__}", None

    if resp.status_code == 200:
        try:
            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text")
            )
        except Exception:
            text = None
        return True, "Bağlantı doğrulandı.", text

    try:
        err = resp.json().get("error", {})
    except Exception:
        err = {}
    msg = err.get("message") or resp.text[:200]
    if resp.status_code == 401 or resp.status_code == 403:
        return False, "API anahtarı geçersiz veya yetersiz.", None
    if resp.status_code == 404:
        return False, f"Model bulunamadı: {model}", None
    return False, f"Google API hata ({resp.status_code}): {msg}", None
