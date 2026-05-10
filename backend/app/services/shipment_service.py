"""Shipment service — CRUD + delay detection."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shipment import Shipment, ShipmentStatus
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate


class ShipmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, shipment_id: int) -> Shipment | None:
        result = await self.session.execute(
            select(Shipment).where(Shipment.id == shipment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_order_id(self, order_id: int) -> Shipment | None:
        result = await self.session.execute(
            select(Shipment).where(Shipment.order_id == order_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        status: ShipmentStatus | None = None,
    ) -> list[Shipment]:
        stmt = select(Shipment).order_by(Shipment.created_at.desc())
        if status:
            stmt = stmt.where(Shipment.status == status)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: ShipmentCreate) -> Shipment:
        shipment = Shipment(
            order_id=data.order_id,
            carrier=data.carrier,
            tracking_number=data.tracking_number,
            expected_delivery=data.expected_delivery,
            status=ShipmentStatus.PENDING,
        )
        self.session.add(shipment)
        await self.session.commit()
        await self.session.refresh(shipment)
        return shipment

    async def update(self, shipment: Shipment, data: ShipmentUpdate) -> Shipment:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(shipment, field, value)

        # Auto-set delivered_at when status changes to delivered
        if data.status == ShipmentStatus.DELIVERED and shipment.delivered_at is None:
            shipment.delivered_at = datetime.now(timezone.utc)

        self.session.add(shipment)
        await self.session.commit()
        await self.session.refresh(shipment)
        return shipment

    async def detect_delayed_shipments(self) -> list[Shipment]:
        """Mark in-transit shipments past expected delivery as delayed."""
        today = date.today()
        stmt = (
            select(Shipment)
            .where(
                Shipment.status == ShipmentStatus.IN_TRANSIT,
                Shipment.expected_delivery < today,
            )
        )
        result = await self.session.execute(stmt)
        delayed = list(result.scalars().all())

        if delayed:
            ids = [s.id for s in delayed]
            await self.session.execute(
                update(Shipment)
                .where(Shipment.id.in_(ids))
                .values(status=ShipmentStatus.DELAYED)
            )
            await self.session.commit()
            # Refresh objects
            for s in delayed:
                await self.session.refresh(s)

        return delayed
