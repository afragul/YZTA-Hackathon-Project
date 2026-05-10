"""Shipment model — (3) Kargo."""

import enum
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, Enum as SAEnum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ShipmentStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    DELAYED = "delayed"
    FAILED = "failed"


class Shipment(Base, TimestampMixin):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("orders.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    carrier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    status: Mapped[ShipmentStatus] = mapped_column(
        SAEnum(
            ShipmentStatus,
            name="shipment_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ShipmentStatus.PENDING,
        nullable=False,
        index=True,
    )
    expected_delivery: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_event: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    order = relationship("Order", back_populates="shipment", lazy="joined")

    __table_args__ = (
        Index("ix_shipments_order_id", "order_id", unique=True),
        Index("ix_shipments_tracking_number", "tracking_number"),
        Index("ix_shipments_status", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Shipment id={self.id} order={self.order_id} "
            f"status={self.status} tracking={self.tracking_number}>"
        )
