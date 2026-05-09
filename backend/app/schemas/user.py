from datetime import datetime
from typing import Annotated
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field

from app.models.user import UserRole


def _empty_to_none(v: object) -> object:
    if isinstance(v, str):
        stripped = v.strip()
        return stripped or None
    return v


# Optional[str] field where empty/whitespace becomes None.
# Used for "clear this value" semantics in PATCH payloads.
NullableStr = Annotated[str | None, BeforeValidator(_empty_to_none)]


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_\-\.]+$")
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=120)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: UserRole
    is_active: bool
    avatar_key: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime


class UserCreate(UserBase):
    """Public registration payload."""

    password: str = Field(min_length=8, max_length=128)


class UserUpdateMe(BaseModel):
    full_name: NullableStr = Field(default=None, max_length=120)
    avatar_key: NullableStr = Field(default=None, max_length=512)
