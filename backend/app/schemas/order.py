"""Pydantic schemas for Order & OrderItem CRUD."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    product_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal


class OrderCreate(BaseModel):
    customer_id: int
    note: str | None = None
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    note: str | None = None


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_number: str
    customer_id: int
    status: OrderStatus
    total_amount: Decimal
    currency: str
    note: str | None
    items: list[OrderItemRead] = []
    created_at: datetime
    updated_at: datetime
