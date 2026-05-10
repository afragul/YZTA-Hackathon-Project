from functools import lru_cache
from typing import List

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Hackathon API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str

    SECRET_KEY: str = Field(min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: str = ""

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_PUBLIC_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "kobai-uploads"
    MINIO_SECURE: bool = False

    FIRST_ADMIN_USERNAME: str = "yzta-admin"
    FIRST_ADMIN_EMAIL: str = "admin@yzta.dev"
    FIRST_ADMIN_PASSWORD: str = "Yzta123!"

    FIRST_USER_USERNAME: str = "yzta-user"
    FIRST_USER_EMAIL: str = "user@yzta.dev"
    FIRST_USER_PASSWORD: str = "Yzta123!"

    # WhatsApp Cloud API
    WHATSAPP_GRAPH_BASE_URL: str = "https://graph.facebook.com"
    WHATSAPP_DEFAULT_API_VERSION: str = "v21.0"
    WHATSAPP_ENCRYPTION_KEY: str = ""  # url-safe b64, 32 bytes; empty = derive from SECRET_KEY
    WHATSAPP_PUBLIC_WEBHOOK_BASE: str = "http://localhost:8000"  # used for displaying webhook URL in UI

    # AI Providers
    AI_DEFAULT_PROVIDER: str = "google"
    AI_DEFAULT_MODEL: str = "gemini-2.5-flash"
    AI_DEFAULT_MAX_TOKENS: int = 2048
    GOOGLE_GENAI_BASE_URL: str = "https://generativelanguage.googleapis.com"

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
