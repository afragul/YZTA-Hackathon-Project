"""Pydantic schemas for Product CRUD."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.product import ProductUnit


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, max_length=80)
    unit: ProductUnit = ProductUnit.PIECE
    price: Decimal = Field(default=Decimal("0"), ge=0)
    low_stock_threshold: Decimal = Field(default=Decimal("0"), ge=0)
    is_active: bool = True
    image_key: str | None = Field(default=None, max_length=512)


class ProductCreate(ProductBase):
    stock: Decimal = Field(default=Decimal("0"), ge=0)


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, max_length=80)
    unit: ProductUnit | None = None
    price: Decimal | None = Field(default=None, ge=0)
    low_stock_threshold: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None
    image_key: str | None = Field(default=None, max_length=512)


class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock: Decimal
    created_at: datetime
    updated_at: datetime


class ProductDataCheckFaq(BaseModel):
    question: str
    data_status: str
    needs_business_action: bool = False
    action_note: str | None = None


class ProductDataCheckResult(BaseModel):
    product_id: int
    sku: str
    name: str
    summary: str
    strengths: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    faq: list[ProductDataCheckFaq] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    search_intents: list[str] = Field(default_factory=list)
    source: str = "ai"
