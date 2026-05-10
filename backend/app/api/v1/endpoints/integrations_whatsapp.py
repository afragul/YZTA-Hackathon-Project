"""
WhatsApp Business Cloud API integration endpoints.

Frontend modal flow:
  1. POST  /integrations/whatsapp           — submit credentials, persists encrypted.
  2. POST  /integrations/whatsapp/{id}/test — verify credentials against Graph API.
  3. POST  /integrations/whatsapp/{id}/send-test — send hello_world template.
  4. GET   /integrations/whatsapp           — read current connection (no secrets).
  5. DELETE /integrations/whatsapp/{id}     — disconnect.

Webhook:
  - GET  /integrations/whatsapp/webhook  — Meta verify challenge.
  - POST /integrations/whatsapp/webhook  — message + status callbacks (logged for now).
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DBSession, require_admin
from app.core.secrets import decrypt_secret
from app.models.user import User
from app.schemas.whatsapp import (
    WhatsAppAccountCreate,
    WhatsAppAccountRead,
    WhatsAppAccountUpdate,
    WhatsAppSendTestRequest,
    WhatsAppSendTestResult,
    WhatsAppTestResult,
)
from app.services.whatsapp_service import WhatsAppService


logger = logging.getLogger("app.whatsapp")


router = APIRouter(
    prefix="/integrations/whatsapp", tags=["integrations:whatsapp"]
)


def get_whatsapp_service(session: DBSession) -> WhatsAppService:
    return WhatsAppService(session)


WhatsAppServiceDep = Annotated[WhatsAppService, Depends(get_whatsapp_service)]
AdminUser = Annotated[User, Depends(require_admin)]


# ----------------------------------------------------------------- public read


@router.get(
    "",
    response_model=WhatsAppAccountRead | None,
    summary="Get the active WhatsApp account",
)
async def get_account(
    _: CurrentUser,
    service: WhatsAppServiceDep,
) -> WhatsAppAccountRead | None:
    account = await service.get_active()
    if account is None:
        return None
    return WhatsAppAccountRead.model_validate(account)


# ------------------------------------------------------------- create / update


@router.post(
    "",
    response_model=WhatsAppAccountRead,
    status_code=status.HTTP_201_CREATED,
    summary="Connect a WhatsApp Business account",
)
async def create_account(
    payload: WhatsAppAccountCreate,
    current_user: AdminUser,
    service: WhatsAppServiceDep,
) -> WhatsAppAccountRead:
    account = await service.create_or_replace(payload, current_user)
    # Auto-run a credential check so the modal can advance to step 3.
    await service.verify_credentials(account)
    refreshed = await service.get_by_id(account.id)
    return WhatsAppAccountRead.model_validate(refreshed)


@router.patch(
    "/{account_id}",
    response_model=WhatsAppAccountRead,
    summary="Update WhatsApp account (token rotation, display name)",
)
async def update_account(
    account_id: int,
    payload: WhatsAppAccountUpdate,
    _: AdminUser,
    service: WhatsAppServiceDep,
) -> WhatsAppAccountRead:
    account = await service.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    updated = await service.update(account, payload)
    return WhatsAppAccountRead.model_validate(updated)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect the WhatsApp account",
)
async def disconnect_account(
    account_id: int,
    _: AdminUser,
    service: WhatsAppServiceDep,
) -> Response:
    account = await service.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    await service.disconnect(account)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------- verify ops


@router.post(
    "/{account_id}/test",
    response_model=WhatsAppTestResult,
    summary="Verify credentials against Meta Graph API",
)
async def test_credentials(
    account_id: int,
    _: AdminUser,
    service: WhatsAppServiceDep,
) -> WhatsAppTestResult:
    account = await service.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return await service.verify_credentials(account)


@router.post(
    "/{account_id}/send-test",
    response_model=WhatsAppSendTestResult,
    summary="Send a template test message (default hello_world)",
)
async def send_test_message(
    account_id: int,
    payload: WhatsAppSendTestRequest,
    _: AdminUser,
    service: WhatsAppServiceDep,
) -> WhatsAppSendTestResult:
    account = await service.get_by_id(account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return await service.send_test_template(account, payload)


# -------------------------------------------------------------------- webhook


@router.get(
    "/webhook",
    summary="Meta webhook verify challenge",
    include_in_schema=False,
)
async def webhook_verify(
    session: DBSession,
    hub_mode: str = Query("", alias="hub.mode"),
    hub_challenge: str = Query("", alias="hub.challenge"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
) -> Response:
    """
    Meta calls this once when a webhook is configured. We respond with the
    challenge if the supplied verify token matches any active account.
    """
    if hub_mode != "subscribe" or not hub_verify_token:
        raise HTTPException(status_code=400, detail="Bad subscribe request")

    service = WhatsAppService(session)
    account = await service.get_active()
    if account is None:
        raise HTTPException(status_code=404, detail="No active account")

    try:
        expected = decrypt_secret(account.verify_token_ciphertext)
    except ValueError:
        raise HTTPException(status_code=500, detail="Invalid stored verify token")

    if expected != hub_verify_token:
        raise HTTPException(status_code=403, detail="Verify token mismatch")

    account.webhook_subscribed = True
    session.add(account)
    await session.commit()

    return Response(content=hub_challenge, media_type="text/plain")


@router.post(
    "/webhook",
    summary="Meta webhook receiver (messages + statuses)",
    include_in_schema=False,
)
async def webhook_receive(request: Request, session: DBSession) -> dict[str, str]:
    """
    Persist inbound messages and apply status updates so the chat panel
    can render them in near real-time. Meta has a 5s timeout, so we
    quickly accept the body, hand it to the service, and respond.
    """
    try:
        body = await request.json()
    except Exception:
        body = {"_raw": (await request.body()).decode("utf-8", errors="replace")}

    logger.info("WhatsApp webhook payload: %s", body)

    if isinstance(body, dict):
        from app.services.whatsapp_chat_service import WhatsAppChatService

        chat_service = WhatsAppChatService(session)
        try:
            await chat_service.process_webhook_payload(body)
        except Exception as exc:
            logger.exception("Failed to process WhatsApp webhook: %s", exc)

    return {"status": "received"}
