"""
WhatsApp chat models.

Mirrors the WhatsApp Cloud API conversation/message domain at a
hackathon-friendly scope:

  - WhatsAppConversation  : 1 row per (account, customer phone)
  - WhatsAppChatMessage   : 1 row per inbound/outbound message

We don't try to model every WhatsApp message type — text and image
are first-class, anything else is stored with a `kind` discriminator
and the original payload preserved as JSON for replay/debugging.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ConversationStatus(str, enum.Enum):
    OPEN = "open"
    PENDING = "pending"
    CLOSED = "closed"
    SPAM = "spam"


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageKind(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    CONTACTS = "contacts"
    INTERACTIVE = "interactive"
    BUTTON = "button"
    REACTION = "reaction"
    SYSTEM = "system"
    OTHER = "other"


class MessageStatus(str, enum.Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    RECEIVED = "received"  # inbound default


class WhatsAppConversation(Base, TimestampMixin):
    __tablename__ = "whatsapp_conversations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)

    account_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # E.164 customer phone — Meta sends this as `wa_id` (without leading +)
    wa_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    contact_profile_pic_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    status: Mapped[ConversationStatus] = mapped_column(
        SAEnum(
            ConversationStatus,
            name="wa_conversation_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ConversationStatus.OPEN,
        nullable=False,
        index=True,
    )

    unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_message_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_message_direction: Mapped[MessageDirection | None] = mapped_column(
        SAEnum(
            MessageDirection,
            name="wa_message_direction",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=True,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    account = relationship("WhatsAppAccount", lazy="joined")
    messages = relationship(
        "WhatsAppChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="WhatsAppChatMessage.created_at.asc()",
        passive_deletes=True,
    )

    __table_args__ = (
        Index(
            "uq_whatsapp_conversation_account_wa_id",
            "account_id",
            "wa_id",
            unique=True,
        ),
        Index(
            "ix_whatsapp_conversations_account_last_msg",
            "account_id",
            "last_message_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<WhatsAppConversation id={self.id} account={self.account_id} "
            f"wa_id={self.wa_id}>"
        )


class WhatsAppChatMessage(Base, TimestampMixin):
    __tablename__ = "whatsapp_chat_messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)

    conversation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Meta wamid — unique when present (used to dedupe webhook replays)
    wamid: Mapped[str | None] = mapped_column(
        String(128), unique=True, index=True, nullable=True
    )

    direction: Mapped[MessageDirection] = mapped_column(
        SAEnum(MessageDirection, name="wa_message_direction"),
        nullable=False,
    )
    kind: Mapped[MessageKind] = mapped_column(
        SAEnum(
            MessageKind,
            name="wa_message_kind",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MessageKind.TEXT,
        nullable=False,
    )
    status: Mapped[MessageStatus] = mapped_column(
        SAEnum(
            MessageStatus,
            name="wa_message_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MessageStatus.RECEIVED,
        nullable=False,
    )

    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    media_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    sent_by_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    conversation = relationship(
        "WhatsAppConversation", back_populates="messages", lazy="joined"
    )
    sent_by = relationship("User", lazy="joined")

    __table_args__ = (
        Index(
            "ix_whatsapp_chat_messages_conv_created",
            "conversation_id",
            "created_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<WhatsAppChatMessage id={self.id} dir={self.direction} "
            f"kind={self.kind}>"
        )
