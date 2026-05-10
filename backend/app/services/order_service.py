"""Order service — CRUD + business logic."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.stock_movement import StockMovement, StockMovementType
from app.schemas.order import OrderCreate, OrderUpdate


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, order_id: int) -> Order | None:
        result = await self.session.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.product))
            .where(Order.id == order_id)
        )
        return result.scalar_one_or_none()

    async def get_by_order_number(self, order_number: str) -> Order | None:
        result = await self.session.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.order_number == order_number)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        customer_id: int | None = None,
        status: OrderStatus | None = None,
        today_only: bool = False,
    ) -> list[Order]:
        stmt = (
            select(Order)
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
        )
        if customer_id:
            stmt = stmt.where(Order.customer_id == customer_id)
        if status:
            stmt = stmt.where(Order.status == status)
        if today_only:
            stmt = stmt.where(func.date(Order.created_at) == func.current_date())
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def _generate_order_number(self) -> str:
        """Generate next order number like ORD-2026-0001."""
        now = datetime.now(timezone.utc)
        year = now.year
        prefix = f"ORD-{year}-"
        result = await self.session.execute(
            select(func.count(Order.id)).where(Order.order_number.startswith(prefix))
        )
        count = result.scalar_one() or 0
        return f"{prefix}{count + 1:04d}"

    async def create(self, data: OrderCreate) -> Order:
        """Create order with items, calculate totals, deduct stock."""
        order_number = await self._generate_order_number()

        order = Order(
            order_number=order_number,
            customer_id=data.customer_id,
            status=OrderStatus.PENDING,
            note=data.note,
            total_amount=Decimal("0"),
        )
        self.session.add(order)
        await self.session.flush()  # get order.id

        total = Decimal("0")
        for item_data in data.items:
            # Fetch product for price snapshot
            product = await self.session.get(Product, item_data.product_id)
            if product is None:
                raise ValueError(f"Product {item_data.product_id} not found")

            unit_price = product.price
            subtotal = item_data.quantity * unit_price

            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=unit_price,
                subtotal=subtotal,
            )
            self.session.add(order_item)

            # Deduct stock
            product.stock -= item_data.quantity
            self.session.add(product)

            # Record stock movement
            movement = StockMovement(
                product_id=item_data.product_id,
                movement_type=StockMovementType.OUT,
                quantity=item_data.quantity,
                reason=f"order:{order.id}",
                order_id=order.id,
            )
            self.session.add(movement)

            total += subtotal

        order.total_amount = total
        await self.session.commit()
        await self.session.refresh(order)

        # Reload with items
        return await self.get_by_id(order.id)  # type: ignore[return-value]

    async def update_status(self, order: Order, data: OrderUpdate) -> Order:
        if data.status is not None:
            order.status = data.status
        if data.note is not None:
            order.note = data.note
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def delete(self, order: Order) -> None:
        await self.session.delete(order)
        await self.session.commit()
