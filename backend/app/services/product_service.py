"""Product service — CRUD + stock management."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.stock_movement import StockMovementCreate


class ProductService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, product_id: int) -> Product | None:
        result = await self.session.execute(
            select(Product).where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Product | None:
        result = await self.session.execute(
            select(Product).where(Product.sku == sku)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        category: str | None = None,
        active_only: bool = True,
    ) -> list[Product]:
        stmt = select(Product).order_by(Product.name)
        if active_only:
            stmt = stmt.where(Product.is_active.is_(True))
        if category:
            stmt = stmt.where(Product.category == category)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                Product.name.ilike(pattern) | Product.sku.ilike(pattern)
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: ProductCreate) -> Product:
        product = Product(**data.model_dump())
        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(product)
        return product

    async def update(self, product: Product, data: ProductUpdate) -> Product:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(product)
        return product

    async def delete(self, product: Product) -> None:
        await self.session.delete(product)
        await self.session.commit()

    async def get_low_stock_products(self) -> list[Product]:
        """Get active products where stock is below threshold."""
        result = await self.session.execute(
            select(Product).where(
                Product.is_active.is_(True),
                Product.stock < Product.low_stock_threshold,
                Product.low_stock_threshold > 0,
            )
        )
        return list(result.scalars().all())

    async def record_stock_movement(self, data: StockMovementCreate) -> StockMovement:
        """Record a stock movement and update product stock atomically."""
        product = await self.get_by_id(data.product_id)
        if product is None:
            raise ValueError(f"Product {data.product_id} not found")

        movement = StockMovement(**data.model_dump())
        self.session.add(movement)

        # Update denormalized stock
        if data.movement_type == StockMovementType.IN:
            product.stock += data.quantity
        elif data.movement_type == StockMovementType.OUT:
            product.stock -= data.quantity
        elif data.movement_type == StockMovementType.ADJUSTMENT:
            # Adjustment sets absolute value — quantity is the new stock level
            product.stock = data.quantity

        self.session.add(product)
        await self.session.commit()
        await self.session.refresh(movement)
        return movement

    async def list_movements(
        self,
        product_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> list[StockMovement]:
        stmt = (
            select(StockMovement)
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
