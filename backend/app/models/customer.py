"""Customer model — (1) Müşteri İletişimi & (2) Sipariş."""

from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    whatsapp_id: Mapped[str | None] = mapped_column(
        String(32), unique=True, index=True, nullable=True
    )
    whatsapp_profile_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    orders = relationship("Order", back_populates="customer", lazy="selectin")
    conversations = relationship(
        "AgentConversation", back_populates="customer", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_customers_phone", "phone"),
        Index("ix_customers_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<Customer id={self.id} name={self.full_name} wa_id={self.whatsapp_id}>"
