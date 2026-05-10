"""StockMovement model — (4) Envanter Hareketleri."""

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Enum as SAEnum, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StockMovementType(str, enum.Enum):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    movement_type: Mapped[StockMovementType] = mapped_column(
        SAEnum(
            StockMovementType,
            name="stock_movement_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(120), nullable=True)
    order_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    product = relationship("Product", back_populates="stock_movements", lazy="joined")
    order = relationship("Order", back_populates="stock_movements", lazy="joined")

    __table_args__ = (
        Index("ix_stock_movements_product_created", "product_id", "created_at"),
        Index("ix_stock_movements_order_id", "order_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<StockMovement id={self.id} product={self.product_id} "
            f"type={self.movement_type} qty={self.quantity}>"
        )
