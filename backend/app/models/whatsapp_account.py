"""
WhatsApp Business Cloud API account integration model.

Stores per-business connection metadata for the Meta Graph API.
Sensitive fields (access token, app secret, verify token) are kept
as Fernet ciphertext; only the last 4 chars are kept in plaintext
for UI display ("•••• ABCD").
"""

import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WhatsAppOnboardingMethod(str, enum.Enum):
    MANUAL = "manual"
    EMBEDDED_SIGNUP = "embedded_signup"


class WhatsAppAccountStatus(str, enum.Enum):
    PENDING = "pending"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class WhatsAppAccount(Base, TimestampMixin):
    __tablename__ = "whatsapp_accounts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)

    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    phone_number_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    business_account_id: Mapped[str] = mapped_column(String(64), nullable=False)
    app_id: Mapped[str] = mapped_column(String(32), nullable=False)
    api_version: Mapped[str] = mapped_column(String(10), nullable=False, default="v21.0")
    default_language: Mapped[str] = mapped_column(String(10), nullable=False, default="tr")

    # Encrypted credentials
    access_token_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    app_secret_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    app_secret_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    verify_token_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)

    onboarding_method: Mapped[WhatsAppOnboardingMethod] = mapped_column(
        SAEnum(
            WhatsAppOnboardingMethod,
            name="wa_onboarding_method",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=WhatsAppOnboardingMethod.MANUAL,
        nullable=False,
    )
    status: Mapped[WhatsAppAccountStatus] = mapped_column(
        SAEnum(
            WhatsAppAccountStatus,
            name="wa_account_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=WhatsAppAccountStatus.PENDING,
        nullable=False,
        index=True,
    )

    is_verified_credentials: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified_messaging: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    webhook_subscribed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    connected_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    connected_by = relationship("User", lazy="joined")

    def __repr__(self) -> str:
        return (
            f"<WhatsAppAccount id={self.id} phone_number_id={self.phone_number_id} "
            f"status={self.status}>"
        )
