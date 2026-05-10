"""Pydantic schemas for Customer CRUD."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CustomerBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    whatsapp_id: str | None = Field(default=None, max_length=32)
    whatsapp_profile_name: str | None = Field(default=None, max_length=120)
    whatsapp_opt_in: bool = False
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=80)
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    whatsapp_id: str | None = Field(default=None, max_length=32)
    whatsapp_profile_name: str | None = Field(default=None, max_length=120)
    whatsapp_opt_in: bool | None = None
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None
    city: str | None = Field(default=None, max_length=80)
    notes: str | None = None


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
