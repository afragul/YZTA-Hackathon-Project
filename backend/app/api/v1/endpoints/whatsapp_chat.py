"""
WhatsApp chat endpoints for the panel.

Routes
------
GET    /whatsapp/chat/conversations           — list, paginated
GET    /whatsapp/chat/stats                   — counts
GET    /whatsapp/chat/conversations/{id}      — single
GET    /whatsapp/chat/conversations/{id}/messages
POST   /whatsapp/chat/conversations/{id}/messages   — send text
PATCH  /whatsapp/chat/conversations/{id}/status     — status change
PATCH  /whatsapp/chat/conversations/{id}/read       — mark read
POST   /whatsapp/chat/conversations                 — start new (phone+text)

The webhook handler lives in `integrations_whatsapp.py` but now
delegates inbound persistence to this service.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DBSession
from app.models.user import User
from app.models.whatsapp_account import WhatsAppAccount
from app.models.whatsapp_chat import ConversationStatus
from app.schemas.whatsapp_chat import (
    WhatsAppChatMessageRead,
    WhatsAppConversationList,
    WhatsAppConversationRead,
    WhatsAppConversationStats,
    WhatsAppConversationStatusUpdate,
    WhatsAppCreateConversationRequest,
    WhatsAppMessageList,
    WhatsAppSendTextRequest,
)
from app.services.whatsapp_chat_service import WhatsAppChatService
from app.services.whatsapp_service import WhatsAppService


router = APIRouter(prefix="/whatsapp/chat", tags=["whatsapp:chat"])


def get_chat_service(session: DBSession) -> WhatsAppChatService:
    return WhatsAppChatService(session)


ChatServiceDep = Annotated[WhatsAppChatService, Depends(get_chat_service)]


async def _resolve_account_id(session) -> WhatsAppAccount:
    """
    The panel only ever shows the active account's chats. We use the
    existing service helper so the resolver stays consistent with the
    integration page.
    """
    service = WhatsAppService(session)
    account = await service.get_active()
    if account is None:
        # Will surface the same 412 as send_text would when chat ops happen
        # while disconnected, but here a 200 with empty list is friendlier.
        return None  # type: ignore[return-value]
    return account


# ─────────────────────────────────────────────────────────────────── reads


@router.get(
    "/conversations",
    response_model=WhatsAppConversationList,
    summary="List conversations for the connected WhatsApp account",
)
async def list_conversations(
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
    status_filter: ConversationStatus | None = Query(
        default=None, alias="status"
    ),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> WhatsAppConversationList:
    account = await _resolve_account_id(session)
    if account is None:
        return WhatsAppConversationList(data=[], total=0, unread_total=0)

    rows, total = await chat.list_conversations(
        account_id=account.id,
        status_filter=status_filter,
        search=search,
        page=page,
        limit=limit,
    )
    stats = await chat.get_stats(account_id=account.id)
    return WhatsAppConversationList(
        data=[WhatsAppConversationRead.model_validate(r) for r in rows],
        total=total,
        unread_total=stats.unread,
    )


@router.get(
    "/stats",
    response_model=WhatsAppConversationStats,
    summary="Conversation counts (open/pending/closed/unread)",
)
async def get_stats(
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppConversationStats:
    account = await _resolve_account_id(session)
    if account is None:
        return WhatsAppConversationStats(
            total=0, open=0, pending=0, closed=0, unread=0
        )
    return await chat.get_stats(account_id=account.id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=WhatsAppConversationRead,
    summary="Get a single conversation",
)
async def get_conversation(
    conversation_id: int,
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppConversationRead:
    account = await _resolve_account_id(session)
    # If no account, 404 the conversation cleanly
    if account is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    conv = await chat.get_conversation(
        account_id=account.id, conversation_id=conversation_id
    )
    return WhatsAppConversationRead.model_validate(conv)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=WhatsAppMessageList,
    summary="Get messages of a conversation (ascending by time)",
)
async def list_messages(
    conversation_id: int,
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> WhatsAppMessageList:
    account = await _resolve_account_id(session)
    if account is None:
        return WhatsAppMessageList(data=[], total=0)
    rows, total = await chat.list_messages(
        account_id=account.id,
        conversation_id=conversation_id,
        page=page,
        limit=limit,
    )
    return WhatsAppMessageList(
        data=[WhatsAppChatMessageRead.model_validate(r) for r in rows],
        total=total,
    )


# ───────────────────────────────────────────────────────────────── writes


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=WhatsAppChatMessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Send a text message in a conversation",
)
async def send_message(
    conversation_id: int,
    payload: WhatsAppSendTextRequest,
    current_user: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppChatMessageRead:
    from fastapi import HTTPException

    account = await _resolve_account_id(session)
    if account is None:
        raise HTTPException(
            status_code=412,
            detail="WhatsApp hesabı bağlı değil.",
        )
    msg = await chat.send_text(
        account_id=account.id,
        conversation_id=conversation_id,
        body=payload.body,
        sent_by_user_id=current_user.id,
    )
    return WhatsAppChatMessageRead.model_validate(msg)


@router.post(
    "/conversations",
    response_model=WhatsAppConversationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new conversation by phone + first message",
)
async def start_conversation(
    payload: WhatsAppCreateConversationRequest,
    current_user: CurrentUser,
    chat: ChatServiceDep,
) -> WhatsAppConversationRead:
    conv, _ = await chat.start_conversation_with_text(
        to_phone_e164=payload.to_phone_e164,
        body=payload.body,
        contact_name=payload.contact_name,
        sent_by_user_id=current_user.id,
    )
    return WhatsAppConversationRead.model_validate(conv)


@router.patch(
    "/conversations/{conversation_id}/status",
    response_model=WhatsAppConversationRead,
    summary="Update conversation status (open/pending/closed/spam)",
)
async def update_conversation_status(
    conversation_id: int,
    payload: WhatsAppConversationStatusUpdate,
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppConversationRead:
    from fastapi import HTTPException

    account = await _resolve_account_id(session)
    if account is None:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    conv = await chat.update_conversation_status(
        account_id=account.id,
        conversation_id=conversation_id,
        new_status=payload.status,
    )
    return WhatsAppConversationRead.model_validate(conv)


@router.patch(
    "/conversations/{conversation_id}/read",
    response_model=WhatsAppConversationRead,
    summary="Mark conversation as read (zero unread counter)",
)
async def mark_conversation_read(
    conversation_id: int,
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppConversationRead:
    from fastapi import HTTPException

    account = await _resolve_account_id(session)
    if account is None:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    conv = await chat.mark_read(
        account_id=account.id, conversation_id=conversation_id
    )
    return WhatsAppConversationRead.model_validate(conv)


@router.patch(
    "/conversations/{conversation_id}/ai-toggle",
    response_model=WhatsAppConversationRead,
    summary="Enable / disable AI agent for a conversation",
)
async def toggle_conversation_ai(
    conversation_id: int,
    payload: dict,  # { "ai_enabled": bool }
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
) -> WhatsAppConversationRead:
    from fastapi import HTTPException
    from sqlalchemy import select
    from app.models.whatsapp_chat import WhatsAppConversation

    enabled = bool(payload.get("ai_enabled", False))

    account = await _resolve_account_id(session)
    if account is None:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    result = await session.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.id == conversation_id,
            WhatsAppConversation.account_id == account.id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    conv.ai_enabled = enabled
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return WhatsAppConversationRead.model_validate(conv)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=204,
    summary="Delete a conversation and all its messages",
)
async def delete_conversation(
    conversation_id: int,
    _: CurrentUser,
    chat: ChatServiceDep,
    session: DBSession,
):
    from fastapi import HTTPException
    from fastapi.responses import Response

    account = await _resolve_account_id(session)
    if account is None:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı.")
    await chat.delete_conversation(
        account_id=account.id, conversation_id=conversation_id
    )
    return Response(status_code=204)
