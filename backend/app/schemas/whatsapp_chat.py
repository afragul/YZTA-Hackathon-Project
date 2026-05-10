"""Pydantic schemas for the WhatsApp chat panel."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.whatsapp_chat import (
    ConversationStatus,
    MessageDirection,
    MessageKind,
    MessageStatus,
)


_PHONE_DIGITS = re.compile(r"^\+?[1-9]\d{7,14}$")


# ────────────────────────────────────────────────────────────────── messages


class WhatsAppChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    wamid: str | None
    direction: MessageDirection
    kind: MessageKind
    status: MessageStatus
    body: str | None
    media_url: str | None
    media_mime_type: str | None
    error_message: str | None
    sent_by_user_id: int | None
    is_ai_generated: bool = False
    created_at: datetime
    updated_at: datetime


class WhatsAppMessageList(BaseModel):
    data: list[WhatsAppChatMessageRead]
    total: int


# ─────────────────────────────────────────────────────────── conversations


class WhatsAppConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    wa_id: str
    contact_name: str | None
    contact_profile_pic_url: str | None
    status: ConversationStatus
    unread_count: int
    last_message_text: str | None
    last_message_at: datetime | None
    last_message_direction: MessageDirection | None
    is_pinned: bool
    ai_enabled: bool = False
    created_at: datetime
    updated_at: datetime


class WhatsAppConversationList(BaseModel):
    data: list[WhatsAppConversationRead]
    total: int
    unread_total: int


class WhatsAppConversationStats(BaseModel):
    total: int
    open: int
    pending: int
    closed: int
    unread: int


class WhatsAppConversationStatusUpdate(BaseModel):
    status: ConversationStatus


# ─────────────────────────────────────────────────────────────── send msg


class WhatsAppSendTextRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4096)


class WhatsAppCreateConversationRequest(BaseModel):
    """
    Start a new conversation by phone number. The customer must have
    messaged the business in the last 24h or be a registered test
    number for a free-form text message to land — otherwise the API
    will reject it. We surface the error verbatim.
    """

    to_phone_e164: str = Field(min_length=8, max_length=20)
    body: str = Field(min_length=1, max_length=4096)
    contact_name: str | None = Field(default=None, max_length=120)

    @field_validator("to_phone_e164")
    @classmethod
    def _norm_phone(cls, v: str) -> str:
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if not cleaned.startswith("+"):
            cleaned = "+" + cleaned
        if not _PHONE_DIGITS.match(cleaned):
            raise ValueError("phone must be E.164")
        return cleaned


# ────────────────────────────────────────────────────────────── webhook


class WhatsAppWebhookEnvelope(BaseModel):
    """Loose envelope — Meta's payload is rich; we accept anything."""

    object: str | None = None
    entry: list[dict[str, Any]] | None = None
