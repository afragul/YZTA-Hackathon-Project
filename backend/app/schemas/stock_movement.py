"""Pydantic schemas for StockMovement."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.stock_movement import StockMovementType


class StockMovementCreate(BaseModel):
    product_id: int
    movement_type: StockMovementType
    quantity: Decimal = Field(gt=0)
    reason: str | None = Field(default=None, max_length=120)
    order_id: int | None = None


class StockMovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    movement_type: StockMovementType
    quantity: Decimal
    reason: str | None
    order_id: int | None
    created_at: datetime
