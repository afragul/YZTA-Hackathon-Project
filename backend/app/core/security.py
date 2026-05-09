from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid4()),
        "type": token_type,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(
    subject: str | int, extra_claims: dict[str, Any] | None = None
) -> str:
    return _create_token(
        str(subject),
        ACCESS_TOKEN_TYPE,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        extra_claims,
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(
        str(subject),
        REFRESH_TOKEN_TYPE,
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc


class TokenValidationError(ValueError):
    """Raised when a token fails type/subject/expiry validation."""


def parse_token(token: str, expected_type: str) -> dict[str, Any]:
    """
    Decode and validate a token's type, subject and jti.

    Returns the full payload on success.
    """
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise TokenValidationError("Invalid token") from exc

    if payload.get("type") != expected_type:
        raise TokenValidationError("Unexpected token type")

    if not payload.get("sub"):
        raise TokenValidationError("Missing subject")

    if not payload.get("jti"):
        raise TokenValidationError("Missing jti")

    return payload


def token_expiry(payload: dict[str, Any]) -> datetime:
    exp = payload.get("exp")
    if exp is None:
        raise TokenValidationError("Missing exp claim")
    return datetime.fromtimestamp(int(exp), tz=timezone.utc)
