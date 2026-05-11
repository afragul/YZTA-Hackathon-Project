"""Pydantic schemas for Email provider integration (Brevo)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.email_provider import EmailProviderCode, EmailProviderStatus


class EmailProviderCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider: EmailProviderCode = EmailProviderCode.BREVO
    api_key: str = Field(min_length=10, max_length=512)
    sender_name: str = Field(min_length=1, max_length=120)
    sender_email: str = Field(min_length=5, max_length=255)
    display_name: str | None = Field(default=None, max_length=80)
    enabled: bool = True

    @field_validator("api_key")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if v.lower().startswith("xsmtpsib-"):
            raise ValueError(
                "Bu bir SMTP anahtarı (xsmtpsib-…). Brevo transactional e-posta "
                "API'si için v3 API anahtarı gerekir (xkeysib-… ile başlar). "
                "Brevo panelinde 'API Keys' sekmesinden yeni bir API anahtarı "
                "oluşturun."
            )
        return v

    @field_validator("sender_email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Geçerli bir e-posta adresi girin.")
        return v


class EmailProviderUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    api_key: str | None = Field(default=None, min_length=10, max_length=512)
    sender_name: str | None = Field(default=None, min_length=1, max_length=120)
    sender_email: str | None = Field(default=None, min_length=5, max_length=255)
    display_name: str | None = Field(default=None, max_length=80)
    enabled: bool | None = None


class EmailProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    provider: EmailProviderCode
    display_name: str
    sender_name: str
    sender_email: str
    api_key_last4: str
    is_default: bool
    enabled: bool
    status: EmailProviderStatus
    last_error: str | None
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class EmailProviderTestResult(BaseModel):
    ok: bool
    detail: str | None = None


class EmailSendTestRequest(BaseModel):
    to_email: str = Field(min_length=5, max_length=255)
    subject: str = Field(default="YZTA Test E-postası", max_length=200)

    @field_validator("to_email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Geçerli bir e-posta adresi girin.")
        return v


class EmailSendTestResult(BaseModel):
    ok: bool
    message_id: str | None = None
    detail: str | None = None
