"""
Email provider service — Brevo (Sendinblue) integration.

Handles CRUD, credential verification, and test email sending
via the Brevo transactional email API.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.secrets import decrypt_secret, encrypt_secret, last4
from app.models.email_provider import (
    EmailProvider,
    EmailProviderCode,
    EmailProviderStatus,
)
from app.models.user import User
from app.schemas.email_provider import (
    EmailProviderCreate,
    EmailProviderUpdate,
    EmailSendTestRequest,
)

logger = logging.getLogger("app.email")

BREVO_API_BASE = "https://api.brevo.com/v3"


class EmailService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --------------------------------------------------------------- queries

    async def list_all(self) -> list[EmailProvider]:
        result = await self.session.execute(
            select(EmailProvider).order_by(EmailProvider.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, provider_id: int) -> EmailProvider | None:
        result = await self.session.execute(
            select(EmailProvider).where(EmailProvider.id == provider_id)
        )
        return result.scalar_one_or_none()

    async def get_by_provider(self, provider: EmailProviderCode) -> EmailProvider | None:
        result = await self.session.execute(
            select(EmailProvider).where(EmailProvider.provider == provider)
        )
        return result.scalar_one_or_none()

    async def get_default(self) -> EmailProvider | None:
        result = await self.session.execute(
            select(EmailProvider)
            .where(
                EmailProvider.is_default.is_(True),
                EmailProvider.enabled.is_(True),
                EmailProvider.status != EmailProviderStatus.DISCONNECTED,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    # --------------------------------------------------------------- mutations

    async def upsert(
        self, payload: EmailProviderCreate, current_user: User
    ) -> EmailProvider:
        """
        Insert or replace the row for the provider. Auto-tests the API key
        against Brevo account endpoint.
        """
        existing = await self.get_by_provider(payload.provider)

        display = payload.display_name or "Brevo"

        if existing is None:
            row = EmailProvider(
                provider=payload.provider,
                display_name=display,
                sender_name=payload.sender_name,
                sender_email=payload.sender_email,
                api_key_ciphertext=encrypt_secret(payload.api_key),
                api_key_last4=last4(payload.api_key),
                enabled=payload.enabled,
                is_default=True,
                status=EmailProviderStatus.PENDING,
                connected_by_user_id=current_user.id,
            )
            self.session.add(row)
        else:
            row = existing
            row.display_name = display
            row.sender_name = payload.sender_name
            row.sender_email = payload.sender_email
            row.api_key_ciphertext = encrypt_secret(payload.api_key)
            row.api_key_last4 = last4(payload.api_key)
            row.enabled = payload.enabled
            row.is_default = True
            row.status = EmailProviderStatus.PENDING
            row.last_error = None
            row.connected_by_user_id = current_user.id

        # Auto-test credentials
        test_ok, test_detail = await self._verify_brevo_key(payload.api_key)
        if test_ok:
            row.status = EmailProviderStatus.CONNECTED
            row.last_error = None
            row.last_synced_at = datetime.now(timezone.utc)
        else:
            row.status = EmailProviderStatus.ERROR
            row.last_error = test_detail

        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def update(
        self, provider_id: int, payload: EmailProviderUpdate, current_user: User
    ) -> EmailProvider:
        row = await self.get_by_id(provider_id)
        if row is None or row.status == EmailProviderStatus.DISCONNECTED:
            raise HTTPException(status_code=404, detail="Email provider bulunamadı.")

        if payload.display_name is not None:
            row.display_name = payload.display_name
        if payload.sender_name is not None:
            row.sender_name = payload.sender_name
        if payload.sender_email is not None:
            row.sender_email = payload.sender_email
        if payload.enabled is not None:
            row.enabled = payload.enabled
        if payload.api_key is not None:
            row.api_key_ciphertext = encrypt_secret(payload.api_key)
            row.api_key_last4 = last4(payload.api_key)
            # Re-test
            test_ok, test_detail = await self._verify_brevo_key(payload.api_key)
            if test_ok:
                row.status = EmailProviderStatus.CONNECTED
                row.last_error = None
                row.last_synced_at = datetime.now(timezone.utc)
            else:
                row.status = EmailProviderStatus.ERROR
                row.last_error = test_detail

        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def disconnect(self, provider_id: int) -> None:
        row = await self.get_by_id(provider_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Email provider bulunamadı.")
        row.status = EmailProviderStatus.DISCONNECTED
        row.enabled = False
        await self.session.commit()

    # --------------------------------------------------------------- test

    async def test_connection(self, provider_id: int) -> tuple[bool, str | None]:
        row = await self.get_by_id(provider_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Email provider bulunamadı.")

        api_key = decrypt_secret(row.api_key_ciphertext)
        ok, detail = await self._verify_brevo_key(api_key)

        if ok:
            row.status = EmailProviderStatus.CONNECTED
            row.last_error = None
            row.last_synced_at = datetime.now(timezone.utc)
        else:
            row.status = EmailProviderStatus.ERROR
            row.last_error = detail

        await self.session.commit()
        await self.session.refresh(row)
        return ok, detail

    async def send_test_email(
        self, provider_id: int, payload: EmailSendTestRequest
    ) -> tuple[bool, str | None, str | None]:
        """Send a test email via Brevo. Returns (ok, detail, message_id)."""
        row = await self.get_by_id(provider_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Email provider bulunamadı.")

        api_key = decrypt_secret(row.api_key_ciphertext)

        body = {
            "sender": {"name": row.sender_name, "email": row.sender_email},
            "to": [{"email": payload.to_email}],
            "subject": payload.subject,
            "htmlContent": (
                "<html><body>"
                "<h2>YZTA Test E-postası</h2>"
                "<p>Bu e-posta Brevo entegrasyonunuzun doğru çalıştığını "
                "doğrulamak için gönderilmiştir.</p>"
                "<p style='color:#888;font-size:12px;'>Gönderen: "
                f"{row.sender_name} &lt;{row.sender_email}&gt;</p>"
                "</body></html>"
            ),
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{BREVO_API_BASE}/smtp/email",
                    headers={
                        "api-key": api_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=body,
                )
            if resp.status_code in (200, 201):
                data = resp.json()
                message_id = data.get("messageId") or data.get("messageIds", [None])[0]
                return True, None, message_id
            else:
                detail = resp.json().get("message", resp.text[:200])
                return False, f"Brevo API hatası ({resp.status_code}): {detail}", None
        except httpx.TimeoutException:
            return False, "Brevo API zaman aşımı.", None
        except Exception as exc:
            logger.exception("Brevo send_test_email error")
            return False, str(exc)[:200], None

    # --------------------------------------------------------------- internal

    @staticmethod
    async def _verify_brevo_key(api_key: str) -> tuple[bool, str | None]:
        """Verify the API key by calling Brevo account endpoint."""
        # Detect SMTP keys (which won't work with the v3 transactional API)
        if api_key.lower().startswith("xsmtpsib-"):
            return False, (
                "Bu bir SMTP anahtarı. Brevo transactional e-posta API'si "
                "v3 API anahtarı gerektirir (xkeysib-… ile başlar)."
            )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{BREVO_API_BASE}/account",
                    headers={
                        "api-key": api_key,
                        "Accept": "application/json",
                    },
                )
            if resp.status_code == 200:
                return True, None
            elif resp.status_code == 401:
                return False, (
                    "API anahtarı geçersiz (401 Unauthorized). Brevo "
                    "panelinden yeni bir v3 API anahtarı oluşturup tekrar "
                    "deneyin."
                )
            else:
                detail = resp.json().get("message", resp.text[:200])
                return False, f"Brevo API hatası ({resp.status_code}): {detail}"
        except httpx.TimeoutException:
            return False, "Brevo API'ye bağlanılamadı (zaman aşımı)."
        except Exception as exc:
            return False, f"Bağlantı hatası: {str(exc)[:150]}"
