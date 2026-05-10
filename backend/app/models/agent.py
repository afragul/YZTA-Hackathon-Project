"""Agent conversation & message models — (1) Müşteri İletişim Otomasyonu."""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
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


class ConversationChannel(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    WEB = "web"
    TELEGRAM = "telegram"


class AgentConversationStatus(str, enum.Enum):
    OPEN = "open"
    HANDLED_BY_AI = "handled_by_ai"
    ESCALATED = "escalated"
    CLOSED = "closed"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"
    SYSTEM = "system"


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    LOCATION = "location"
    STICKER = "sticker"
    TEMPLATE = "template"
    INTERACTIVE = "interactive"
    TOOL_CALL = "tool_call"


class MessageProvider(str, enum.Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    WEB = "web"
    TELEGRAM = "telegram"
    INTERNAL = "internal"


class AgentMessageStatus(str, enum.Enum):
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class AgentConversation(Base, TimestampMixin):
    __tablename__ = "agent_conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    channel: Mapped[ConversationChannel] = mapped_column(
        SAEnum(
            ConversationChannel,
            name="conversation_channel",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    external_thread_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    wa_phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[AgentConversationStatus] = mapped_column(
        SAEnum(
            AgentConversationStatus,
            name="agent_conversation_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AgentConversationStatus.OPEN,
        nullable=False,
    )
    handled_by_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_inbound_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    customer = relationship("Customer", back_populates="conversations", lazy="joined")
    handled_by = relationship("User", lazy="joined")
    messages = relationship(
        "AgentMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AgentMessage.created_at.asc()",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_agent_conversations_customer_last_msg",
            "customer_id",
            "last_message_at",
        ),
        Index(
            "uq_agent_conversations_channel_thread",
            "channel",
            "external_thread_id",
            unique=True,
        ),
        Index(
            "ix_agent_conversations_status_last_msg",
            "status",
            "last_message_at",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<AgentConversation id={self.id} channel={self.channel} "
            f"status={self.status}>"
        )


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("agent_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    direction: Mapped[MessageDirection] = mapped_column(
        SAEnum(
            MessageDirection,
            name="agent_message_direction",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(
            MessageRole,
            name="message_role",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    message_type: Mapped[MessageType] = mapped_column(
        SAEnum(
            MessageType,
            name="agent_message_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MessageType.TEXT,
        nullable=False,
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[MessageProvider] = mapped_column(
        SAEnum(
            MessageProvider,
            name="message_provider",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    provider_message_id: Mapped[str | None] = mapped_column(
        String(128), unique=True, nullable=True
    )
    reply_to_message_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("agent_messages.id", ondelete="SET NULL"), nullable=True
    )
    wa_template_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("whatsapp_templates.id", ondelete="SET NULL"), nullable=True
    )
    wa_interactive_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[AgentMessageStatus] = mapped_column(
        SAEnum(
            AgentMessageStatus,
            name="agent_message_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AgentMessageStatus.QUEUED,
        nullable=False,
    )
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tool_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    # Relationships
    conversation = relationship("AgentConversation", back_populates="messages")
    reply_to = relationship("AgentMessage", remote_side="AgentMessage.id", lazy="joined")
    template = relationship("WhatsAppTemplate", lazy="joined")
    media_attachments = relationship(
        "WhatsAppMedia", back_populates="message", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_agent_messages_conv_created", "conversation_id", "created_at"),
        Index("ix_agent_messages_provider_msg_id", "provider_message_id"),
        Index("ix_agent_messages_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<AgentMessage id={self.id} dir={self.direction} "
            f"role={self.role} type={self.message_type}>"
        )
