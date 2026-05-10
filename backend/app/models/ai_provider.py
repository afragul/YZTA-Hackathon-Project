"""
AI provider integration model (LangChain-based).

Mirrors the store project's pattern: a single row per provider holds
the API key (encrypted), the selected model and max_tokens. The first
provider with `is_default=True` is the active one used by agents.

Schema is multi-provider ready (`openai`, `google`, `anthropic`)
even though only Gemini is wired today; only enum values are reserved.
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


class AiProviderCode(str, enum.Enum):
    GOOGLE = "google"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class AiProviderStatus(str, enum.Enum):
    PENDING = "pending"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class AiProvider(Base, TimestampMixin):
    __tablename__ = "ai_providers"
    __table_args__ = (
        UniqueConstraint("provider", name="uq_ai_providers_provider"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    provider: Mapped[AiProviderCode] = mapped_column(
        SAEnum(
            AiProviderCode,
            name="ai_provider_code",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=2048)

    # Encrypted API key
    api_key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    api_key_last4: Mapped[str] = mapped_column(String(4), nullable=False)

    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    status: Mapped[AiProviderStatus] = mapped_column(
        SAEnum(
            AiProviderStatus,
            name="ai_provider_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AiProviderStatus.PENDING,
        nullable=False,
        index=True,
    )

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
            f"<AiProvider id={self.id} provider={self.provider} "
            f"model={self.model} status={self.status}>"
        )
