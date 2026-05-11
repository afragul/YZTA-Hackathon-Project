"""
Email provider integration endpoints (Brevo).

Frontend modal flow (Settings → Integrations → Email → Bağla):
  1. POST /integrations/email          — submit provider+api_key+sender, persist encrypted.
  2. POST /integrations/email/{id}/test — ping Brevo account API, mark CONNECTED.
  3. POST /integrations/email/{id}/send-test — send a test email.
  4. GET  /integrations/email          — list configured email providers.
  5. PATCH /integrations/email/{id}    — rotate key / change sender.
  6. DELETE /integrations/email/{id}   — disconnect.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import CurrentUser, DBSession, require_admin
from app.models.user import User
from app.schemas.email_provider import (
    EmailProviderCreate,
    EmailProviderRead,
    EmailProviderTestResult,
    EmailProviderUpdate,
    EmailSendTestRequest,
    EmailSendTestResult,
)
from app.services.email_service import EmailService


router = APIRouter(prefix="/integrations/email", tags=["integrations:email"])


def get_email_service(session: DBSession) -> EmailService:
    return EmailService(session)


EmailServiceDep = Annotated[EmailService, Depends(get_email_service)]
AdminUser = Annotated[User, Depends(require_admin)]


# ----------------------------------------------------------------- public read


@router.get(
    "",
    response_model=list[EmailProviderRead],
    summary="List configured email providers",
)
async def list_email_providers(svc: EmailServiceDep, _user: CurrentUser):
    return await svc.list_all()


# ----------------------------------------------------------------- admin write


@router.post(
    "",
    response_model=EmailProviderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update email provider (auto-tests credentials)",
)
async def upsert_email_provider(
    body: EmailProviderCreate, svc: EmailServiceDep, admin: AdminUser
):
    return await svc.upsert(body, admin)


@router.patch(
    "/{provider_id}",
    response_model=EmailProviderRead,
    summary="Update email provider config",
)
async def update_email_provider(
    provider_id: int,
    body: EmailProviderUpdate,
    svc: EmailServiceDep,
    admin: AdminUser,
):
    return await svc.update(provider_id, body, admin)


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect email provider",
)
async def disconnect_email_provider(
    provider_id: int, svc: EmailServiceDep, admin: AdminUser
):
    await svc.disconnect(provider_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------- test


@router.post(
    "/{provider_id}/test",
    response_model=EmailProviderTestResult,
    summary="Test email provider credentials",
)
async def test_email_provider(
    provider_id: int, svc: EmailServiceDep, admin: AdminUser
):
    ok, detail = await svc.test_connection(provider_id)
    return EmailProviderTestResult(ok=ok, detail=detail)


@router.post(
    "/{provider_id}/send-test",
    response_model=EmailSendTestResult,
    summary="Send a test email via the configured provider",
)
async def send_test_email(
    provider_id: int,
    body: EmailSendTestRequest,
    svc: EmailServiceDep,
    admin: AdminUser,
):
    ok, detail, message_id = await svc.send_test_email(provider_id, body)
    return EmailSendTestResult(ok=ok, detail=detail, message_id=message_id)
