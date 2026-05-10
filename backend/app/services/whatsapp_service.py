"""
WhatsApp Business Cloud API integration service.

Responsibilities:
  - Persist a single WhatsApp account row (encrypted credentials).
  - Verify credentials by calling Meta Graph `GET /{phone_number_id}`.
  - Send a test template message (e.g. `hello_world`) to validate messaging.
  - Provide a webhook helper that returns the public callback URL.

Hackathon scope: a single account row, but the data model is multi-account ready.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.secrets import decrypt_secret, encrypt_secret, last4
from app.models.user import User
from app.models.whatsapp_account import (
    WhatsAppAccount,
    WhatsAppAccountStatus,
    WhatsAppOnboardingMethod,
)
from app.schemas.whatsapp import (
    WhatsAppAccountCreate,
    WhatsAppAccountUpdate,
    WhatsAppSendTestRequest,
    WhatsAppSendTestResult,
    WhatsAppTestResult,
)


logger = logging.getLogger("app.whatsapp")


WEBHOOK_PATH = "/api/v1/integrations/whatsapp/webhook"


def _webhook_url() -> str:
    base = settings.WHATSAPP_PUBLIC_WEBHOOK_BASE.rstrip("/")
    return f"{base}{WEBHOOK_PATH}"


def _graph_url(api_version: str, path: str) -> str:
    base = settings.WHATSAPP_GRAPH_BASE_URL.rstrip("/")
    return f"{base}/{api_version}/{path.lstrip('/')}"


def _attach_webhook_url(account: WhatsAppAccount) -> WhatsAppAccount:
    """Attach a transient `webhook_url` attribute for response serialization."""
    setattr(account, "webhook_url", _webhook_url())
    return account


class WhatsAppService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---------------------------------------------------------------- queries

    async def get_active(self) -> WhatsAppAccount | None:
        """
        Returns the single active (non-disconnected) account if any.
        Hackathon scope: there is at most one.
        """
        result = await self.session.execute(
            select(WhatsAppAccount)
            .where(WhatsAppAccount.status != WhatsAppAccountStatus.DISCONNECTED)
            .order_by(WhatsAppAccount.created_at.desc())
            .limit(1)
        )
        account = result.scalar_one_or_none()
        if account:
            _attach_webhook_url(account)
        return account

    async def get_by_id(self, account_id: int) -> WhatsAppAccount | None:
        result = await self.session.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.id == account_id)
        )
        account = result.scalar_one_or_none()
        if account:
            _attach_webhook_url(account)
        return account

    async def get_by_phone_number_id(
        self, phone_number_id: str
    ) -> WhatsAppAccount | None:
        result = await self.session.execute(
            select(WhatsAppAccount).where(
                WhatsAppAccount.phone_number_id == phone_number_id
            )
        )
        account = result.scalar_one_or_none()
        if account:
            _attach_webhook_url(account)
        return account

    # --------------------------------------------------------------- mutations

    async def create_or_replace(
        self, payload: WhatsAppAccountCreate, current_user: User
    ) -> WhatsAppAccount:
        """
        Hackathon-mode behavior: a single active account.
        If one already exists with the same phone_number_id, raise.
        Otherwise upsert by replacing any previous active account.
        """
        existing = await self.get_by_phone_number_id(payload.phone_number_id)
        if existing and existing.status != WhatsAppAccountStatus.DISCONNECTED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bu WhatsApp numarası zaten bağlı.",
            )

        if existing and existing.status == WhatsAppAccountStatus.DISCONNECTED:
            # Reuse the existing row to avoid unique-constraint conflicts.
            existing.display_name = payload.display_name
            existing.phone_e164 = payload.phone_e164
            existing.business_account_id = payload.business_account_id
            existing.app_id = payload.app_id
            existing.api_version = payload.api_version
            existing.default_language = payload.default_language
            existing.access_token_ciphertext = encrypt_secret(payload.access_token)
            existing.access_token_last4 = last4(payload.access_token)
            existing.app_secret_ciphertext = encrypt_secret(payload.app_secret)
            existing.app_secret_last4 = last4(payload.app_secret)
            existing.verify_token_ciphertext = encrypt_secret(payload.verify_token)
            existing.onboarding_method = WhatsAppOnboardingMethod.MANUAL
            existing.status = WhatsAppAccountStatus.PENDING
            existing.is_verified_credentials = False
            existing.is_verified_messaging = False
            existing.webhook_subscribed = False
            existing.last_error = None
            existing.last_synced_at = None
            existing.connected_by_user_id = current_user.id
            self.session.add(existing)
            await self.session.commit()
            await self.session.refresh(existing)
            _attach_webhook_url(existing)
            return existing

        account = WhatsAppAccount(
            display_name=payload.display_name,
            phone_e164=payload.phone_e164,
            phone_number_id=payload.phone_number_id,
            business_account_id=payload.business_account_id,
            app_id=payload.app_id,
            api_version=payload.api_version,
            default_language=payload.default_language,
            access_token_ciphertext=encrypt_secret(payload.access_token),
            access_token_last4=last4(payload.access_token),
            app_secret_ciphertext=encrypt_secret(payload.app_secret),
            app_secret_last4=last4(payload.app_secret),
            verify_token_ciphertext=encrypt_secret(payload.verify_token),
            onboarding_method=WhatsAppOnboardingMethod.MANUAL,
            status=WhatsAppAccountStatus.PENDING,
            connected_by_user_id=current_user.id,
        )
        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        _attach_webhook_url(account)
        return account

    async def update(
        self, account: WhatsAppAccount, payload: WhatsAppAccountUpdate
    ) -> WhatsAppAccount:
        if payload.display_name is not None:
            account.display_name = payload.display_name
        if payload.access_token is not None:
            account.access_token_ciphertext = encrypt_secret(payload.access_token)
            account.access_token_last4 = last4(payload.access_token)
            account.is_verified_credentials = False
        if payload.app_secret is not None:
            account.app_secret_ciphertext = encrypt_secret(payload.app_secret)
            account.app_secret_last4 = last4(payload.app_secret)
        if payload.verify_token is not None:
            account.verify_token_ciphertext = encrypt_secret(payload.verify_token)

        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)
        _attach_webhook_url(account)
        return account

    async def disconnect(self, account: WhatsAppAccount) -> None:
        await self.session.delete(account)
        await self.session.commit()

    async def mark_credentials_verified(
        self, account: WhatsAppAccount, *, error: str | None = None
    ) -> None:
        account.is_verified_credentials = error is None
        account.last_error = error
        account.last_synced_at = datetime.now(timezone.utc)
        if error is None:
            account.status = WhatsAppAccountStatus.CONNECTED
        else:
            account.status = WhatsAppAccountStatus.ERROR
        self.session.add(account)
        await self.session.commit()

    async def mark_messaging_verified(
        self, account: WhatsAppAccount, *, ok: bool, error: str | None
    ) -> None:
        account.is_verified_messaging = ok
        if not ok:
            account.last_error = error
        self.session.add(account)
        await self.session.commit()

    # --------------------------------------------------------------- Graph API

    def _decrypt_access_token(self, account: WhatsAppAccount) -> str:
        try:
            return decrypt_secret(account.access_token_ciphertext)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Şifreli token çözülemedi. Lütfen tekrar bağlayın.",
            ) from exc

    async def verify_credentials(
        self, account: WhatsAppAccount
    ) -> WhatsAppTestResult:
        """
        Calls `GET /{phone_number_id}?fields=display_phone_number,verified_name`
        with the stored access token. Returns a normalized result.
        """
        access_token = self._decrypt_access_token(account)
        url = _graph_url(account.api_version, account.phone_number_id)
        params = {"fields": "display_phone_number,verified_name"}
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params, headers=headers)
        except httpx.HTTPError as exc:
            await self.mark_credentials_verified(
                account, error=f"network: {exc.__class__.__name__}"
            )
            return WhatsAppTestResult(
                ok=False, detail="Meta sunucularına ulaşılamadı."
            )

        if resp.status_code == 200:
            data: dict[str, Any] = resp.json()
            await self.mark_credentials_verified(account, error=None)
            return WhatsAppTestResult(
                ok=True,
                detail="Kimlik bilgileri doğrulandı.",
                verified_phone_number=data.get("display_phone_number"),
            )

        # Translate common failures into user-friendly messages.
        try:
            err = resp.json().get("error", {})
        except Exception:
            err = {}
        code = err.get("code")
        meta_msg = err.get("message") or resp.text[:200]
        message: str
        if resp.status_code == 401 or code in (190, 200):
            message = (
                "Access Token geçersiz. Meta Business → System Users üzerinden "
                "kalıcı bir token üretin."
            )
        elif resp.status_code == 404 or code == 100:
            message = (
                "Phone Number ID bulunamadı veya bu token bu numaraya erişemiyor."
            )
        elif resp.status_code == 403:
            message = "Token'a `whatsapp_business_messaging` izni atanmamış."
        else:
            message = f"Meta API hata ({resp.status_code}): {meta_msg}"

        await self.mark_credentials_verified(account, error=message)
        return WhatsAppTestResult(ok=False, detail=message)

    async def send_test_template(
        self,
        account: WhatsAppAccount,
        payload: WhatsAppSendTestRequest,
    ) -> WhatsAppSendTestResult:
        """
        Sends a template message (default `hello_world`) to validate end-to-end
        messaging. The recipient must be a number that opted-in for templates
        (or the test number registered in Meta App).
        """
        access_token = self._decrypt_access_token(account)
        url = _graph_url(
            account.api_version, f"{account.phone_number_id}/messages"
        )
        body = {
            "messaging_product": "whatsapp",
            "to": payload.to_phone_e164.lstrip("+"),
            "type": "template",
            "template": {
                "name": payload.template_name,
                "language": {"code": payload.language},
            },
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=body, headers=headers)
        except httpx.HTTPError as exc:
            await self.mark_messaging_verified(
                account, ok=False, error=f"network: {exc.__class__.__name__}"
            )
            return WhatsAppSendTestResult(
                ok=False, detail="Meta sunucularına ulaşılamadı."
            )

        if resp.status_code == 200:
            data: dict[str, Any] = resp.json()
            messages = data.get("messages") or []
            wamid = messages[0].get("id") if messages else None
            await self.mark_messaging_verified(account, ok=True, error=None)
            return WhatsAppSendTestResult(
                ok=True,
                message_id=wamid,
                detail="Test mesajı kuyruğa alındı.",
            )

        try:
            err = resp.json().get("error", {})
        except Exception:
            err = {}
        meta_msg = err.get("message") or resp.text[:200]
        await self.mark_messaging_verified(
            account, ok=False, error=f"{resp.status_code}: {meta_msg}"
        )
        return WhatsAppSendTestResult(
            ok=False,
            detail=f"Test mesajı gönderilemedi: {meta_msg}",
        )
