"""Customer service — CRUD operations."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, customer_id: int) -> Customer | None:
        result = await self.session.execute(
            select(Customer).where(Customer.id == customer_id)
        )
        return result.scalar_one_or_none()

    async def get_by_whatsapp_id(self, whatsapp_id: str) -> Customer | None:
        result = await self.session.execute(
            select(Customer).where(Customer.whatsapp_id == whatsapp_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
    ) -> list[Customer]:
        stmt = select(Customer).order_by(Customer.created_at.desc())
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                Customer.full_name.ilike(pattern)
                | Customer.phone.ilike(pattern)
                | Customer.whatsapp_id.ilike(pattern)
                | Customer.email.ilike(pattern)
            )
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: CustomerCreate) -> Customer:
        customer = Customer(**data.model_dump())
        self.session.add(customer)
        await self.session.commit()
        await self.session.refresh(customer)
        return customer

    async def update(self, customer: Customer, data: CustomerUpdate) -> Customer:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)
        self.session.add(customer)
        await self.session.commit()
        await self.session.refresh(customer)
        return customer

    async def delete(self, customer: Customer) -> None:
        await self.session.delete(customer)
        await self.session.commit()

    async def upsert_by_whatsapp_id(
        self, whatsapp_id: str, full_name: str, profile_name: str | None = None
    ) -> Customer:
        """Upsert customer by whatsapp_id — used by webhook handler."""
        existing = await self.get_by_whatsapp_id(whatsapp_id)
        if existing:
            existing.whatsapp_profile_name = profile_name or existing.whatsapp_profile_name
            self.session.add(existing)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        customer = Customer(
            full_name=full_name,
            whatsapp_id=whatsapp_id,
            whatsapp_profile_name=profile_name,
            phone=whatsapp_id,
        )
        self.session.add(customer)
        await self.session.commit()
        await self.session.refresh(customer)
        return customer
