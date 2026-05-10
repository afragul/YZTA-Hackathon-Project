"""Product model — (2) Ürün & (4) Stok."""

import enum
from decimal import Decimal

from sqlalchemy import Boolean, Enum as SAEnum, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ProductUnit(str, enum.Enum):
    PIECE = "piece"
    KG = "kg"
    LT = "lt"
    PACK = "pack"


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    unit: Mapped[ProductUnit] = mapped_column(
        SAEnum(
            ProductUnit,
            name="product_unit",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=ProductUnit.PIECE,
        nullable=False,
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), nullable=False
    )
    stock: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), default=Decimal("0"), nullable=False
    )
    low_stock_threshold: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), default=Decimal("0"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    image_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Relationships
    stock_movements = relationship("StockMovement", back_populates="product", lazy="selectin")
    order_items = relationship("OrderItem", back_populates="product", lazy="selectin")

    __table_args__ = (
        Index("ix_products_category", "category"),
        Index("ix_products_is_active", "is_active"),
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} sku={self.sku} name={self.name}>"
