"""Pydantic schemas for Shipment CRUD."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.shipment import ShipmentStatus


class ShipmentCreate(BaseModel):
    order_id: int
    carrier: str | None = Field(default=None, max_length=50)
    tracking_number: str | None = Field(default=None, max_length=80)
    expected_delivery: date | None = None


class ShipmentUpdate(BaseModel):
    carrier: str | None = Field(default=None, max_length=50)
    tracking_number: str | None = Field(default=None, max_length=80)
    status: ShipmentStatus | None = None
    expected_delivery: date | None = None
    last_event: str | None = None


class ShipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    carrier: str | None
    tracking_number: str | None
    status: ShipmentStatus
    expected_delivery: date | None
    delivered_at: datetime | None
    last_event: str | None
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime
