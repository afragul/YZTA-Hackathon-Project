"""Pydantic schemas for AI provider integration."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.ai_provider import AiProviderCode, AiProviderStatus


class AiModelInfo(BaseModel):
    id: str
    name: str
    provider: AiProviderCode
    context_window: int | None = None
    max_output_tokens: int | None = None


class AiProviderCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider: AiProviderCode
    model: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=10, max_length=512)
    max_tokens: int = Field(default=2048, ge=64, le=131072)
    display_name: str | None = Field(default=None, max_length=80)
    enabled: bool = True

    @field_validator("api_key")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if v.lower().startswith("bearer "):
            v = v[7:].strip()
        return v


class AiProviderUpdate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model: str | None = Field(default=None, min_length=1, max_length=120)
    api_key: str | None = Field(default=None, min_length=10, max_length=512)
    max_tokens: int | None = Field(default=None, ge=64, le=131072)
    display_name: str | None = Field(default=None, max_length=80)
    enabled: bool | None = None


class AiProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    provider: AiProviderCode
    display_name: str
    model: str
    max_tokens: int
    api_key_last4: str
    is_default: bool
    enabled: bool
    status: AiProviderStatus
    last_error: str | None
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AiProviderTestResult(BaseModel):
    ok: bool
    detail: str | None = None
    sample_text: str | None = None


class AiModelListResult(BaseModel):
    models: list[AiModelInfo]
    source: str  # "api" or "static"
