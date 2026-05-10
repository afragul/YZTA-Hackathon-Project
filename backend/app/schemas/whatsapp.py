"""Pydantic schemas for WhatsApp Business API integration."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.whatsapp_account import (
    WhatsAppAccountStatus,
    WhatsAppOnboardingMethod,
)


_PHONE_E164 = re.compile(r"^\+?[1-9]\d{7,14}$")
_VERIFY_TOKEN = re.compile(r"^[A-Za-z0-9_\-]{16,64}$")
_DIGIT_ID = re.compile(r"^\d{8,20}$")


class WhatsAppAccountCreate(BaseModel):
    """Payload from the panel modal."""

    display_name: str = Field(min_length=2, max_length=80)
    phone_e164: str = Field(min_length=8, max_length=20)
    phone_number_id: str = Field(min_length=8, max_length=64)
    business_account_id: str = Field(min_length=8, max_length=64)
    app_id: str = Field(min_length=8, max_length=32)
    access_token: str = Field(min_length=80, max_length=4096)
    app_secret: str = Field(min_length=16, max_length=128)
    verify_token: str = Field(min_length=16, max_length=64)
    api_version: str = Field(default="v21.0", pattern=r"^v\d+\.\d+$")
    default_language: Literal["tr", "en_US"] = "tr"

    @field_validator("phone_e164")
    @classmethod
    def _norm_phone(cls, v: str) -> str:
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if not cleaned.startswith("+"):
            cleaned = "+" + cleaned
        if not _PHONE_E164.match(cleaned):
            raise ValueError("phone_e164 must be in E.164 format (e.g. +905551234567)")
        return cleaned

    @field_validator("phone_number_id", "business_account_id", "app_id")
    @classmethod
    def _digits(cls, v: str) -> str:
        cleaned = "".join(v.split())
        if not _DIGIT_ID.match(cleaned):
            raise ValueError("must be a numeric ID (8-20 digits)")
        return cleaned

    @field_validator("access_token")
    @classmethod
    def _strip_bearer(cls, v: str) -> str:
        v = v.strip()
        if v.lower().startswith("bearer "):
            v = v[7:].strip()
        return v

    @field_validator("verify_token")
    @classmethod
    def _check_verify(cls, v: str) -> str:
        v = v.strip()
        if not _VERIFY_TOKEN.match(v):
            raise ValueError(
                "verify_token must be 16-64 chars of [A-Za-z0-9_-]"
            )
        return v


class WhatsAppAccountUpdate(BaseModel):
    """Partial update — only token rotation / display name."""

    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    access_token: str | None = Field(default=None, min_length=80, max_length=4096)
    app_secret: str | None = Field(default=None, min_length=16, max_length=128)
    verify_token: str | None = Field(default=None, min_length=16, max_length=64)


class WhatsAppAccountRead(BaseModel):
    """Safe representation returned to the UI (no plaintext secrets)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    phone_e164: str
    phone_number_id: str
    business_account_id: str
    app_id: str
    api_version: str
    default_language: str

    access_token_last4: str
    app_secret_last4: str

    onboarding_method: WhatsAppOnboardingMethod
    status: WhatsAppAccountStatus
    is_verified_credentials: bool
    is_verified_messaging: bool
    webhook_subscribed: bool
    last_error: str | None
    last_synced_at: datetime | None

    webhook_url: str
    created_at: datetime
    updated_at: datetime


class WhatsAppTestResult(BaseModel):
    ok: bool
    detail: str | None = None
    verified_phone_number: str | None = None


class WhatsAppSendTestRequest(BaseModel):
    to_phone_e164: str = Field(min_length=8, max_length=20)
    template_name: str = Field(default="hello_world", min_length=1, max_length=120)
    language: str = Field(default="en_US", min_length=2, max_length=10)

    @field_validator("to_phone_e164")
    @classmethod
    def _norm_phone(cls, v: str) -> str:
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if not cleaned.startswith("+"):
            cleaned = "+" + cleaned
        if not _PHONE_E164.match(cleaned):
            raise ValueError("phone must be E.164")
        return cleaned


class WhatsAppSendTestResult(BaseModel):
    ok: bool
    message_id: str | None = None
    detail: str | None = None
