"""WhatsApp-specific models — Media, Templates, Webhook Events."""

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
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


# --- Enums ---


class MediaDownloadStatus(str, enum.Enum):
    PENDING = "pending"
    DOWNLOADED = "downloaded"
    FAILED = "failed"


class TemplateCategory(str, enum.Enum):
    MARKETING = "marketing"
    UTILITY = "utility"
    AUTHENTICATION = "authentication"


class TemplateStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAUSED = "paused"


class WAEventType(str, enum.Enum):
    MESSAGE = "message"
    STATUS = "status"
    ERROR = "error"
    UNKNOWN = "unknown"


# --- Models ---


class WhatsAppMedia(Base):
    __tablename__ = "whatsapp_media"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("agent_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wa_media_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_status: Mapped[MediaDownloadStatus] = mapped_column(
        SAEnum(
            MediaDownloadStatus,
            name="media_download_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MediaDownloadStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    message = relationship("AgentMessage", back_populates="media_attachments")

    __table_args__ = (
        Index("ix_whatsapp_media_message_id", "message_id"),
        Index("ix_whatsapp_media_wa_media_id", "wa_media_id"),
    )

    def __repr__(self) -> str:
        return f"<WhatsAppMedia id={self.id} mime={self.mime_type} status={self.download_status}>"


class WhatsAppTemplate(Base, TimestampMixin):
    __tablename__ = "whatsapp_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False)
    category: Mapped[TemplateCategory] = mapped_column(
        SAEnum(
            TemplateCategory,
            name="template_category",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    status: Mapped[TemplateStatus] = mapped_column(
        SAEnum(
            TemplateStatus,
            name="template_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=TemplateStatus.PENDING,
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    variables_schema: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint("name", "language", name="uq_whatsapp_templates_name_lang"),
    )

    def __repr__(self) -> str:
        return f"<WhatsAppTemplate id={self.id} name={self.name} lang={self.language}>"


class WhatsAppWebhookEvent(Base):
    __tablename__ = "whatsapp_webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    event_type: Mapped[WAEventType] = mapped_column(
        SAEnum(
            WAEventType,
            name="wa_event_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    wa_phone_number_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    wa_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    signature: Mapped[str | None] = mapped_column(String(256), nullable=True)
    processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_wa_webhook_events_message_id", "wa_message_id"),
        Index("ix_wa_webhook_events_processed_received", "processed", "received_at"),
        Index("ix_wa_webhook_events_type_received", "event_type", "received_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<WhatsAppWebhookEvent id={self.id} type={self.event_type} "
            f"processed={self.processed}>"
        )
