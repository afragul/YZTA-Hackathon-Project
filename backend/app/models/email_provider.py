"""
Email provider integration model (Brevo / Sendinblue).

Stores per-business email provider configuration. Sensitive fields
(API key) are kept as Fernet ciphertext; only the last 4 chars are
kept in plaintext for UI display.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class EmailProviderCode(str, enum.Enum):
    BREVO = "brevo"


class EmailProviderStatus(str, enum.Enum):
    PENDING = "pending"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class EmailProvider(Base, TimestampMixin):
    __tablename__ = "email_providers"
    __table_args__ = (
        UniqueConstraint("provider", name="uq_email_providers_provider"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    provider: Mapped[EmailProviderCode] = mapped_column(
        SAEnum(
            EmailProviderCode,
            name="email_provider_code",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)

    # Sender info
    sender_name: Mapped[str] = mapped_column(String(120), nullable=False)
    sender_email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Encrypted API key
    api_key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_last4: Mapped[str] = mapped_column(String(4), nullable=False)

    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    status: Mapped[EmailProviderStatus] = mapped_column(
        SAEnum(
            EmailProviderStatus,
            name="email_provider_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=EmailProviderStatus.PENDING,
        nullable=False,
        index=True,
    )

    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Audit
    connected_by_user_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
