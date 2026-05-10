"""
Symmetric encryption helpers for sensitive integration credentials.

Stores never see plaintext on disk: Fernet (AES-128-CBC + HMAC-SHA256)
ciphertext is persisted, the key is derived from settings (or supplied
via WHATSAPP_ENCRYPTION_KEY).
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _derive_key() -> bytes:
    if settings.WHATSAPP_ENCRYPTION_KEY:
        # Already a valid Fernet url-safe base64 32-byte key.
        return settings.WHATSAPP_ENCRYPTION_KEY.encode()
    # Derive deterministic 32-byte key from SECRET_KEY for dev/hackathon.
    digest = hashlib.sha256(
        f"whatsapp::{settings.SECRET_KEY}".encode("utf-8")
    ).digest()
    return base64.urlsafe_b64encode(digest)


_FERNET = Fernet(_derive_key())


def encrypt_secret(plain: str) -> str:
    """Encrypt a secret string. Returns url-safe base64 ciphertext."""
    if plain is None:
        raise ValueError("Cannot encrypt None")
    return _FERNET.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    """Decrypt a Fernet ciphertext. Raises ValueError on invalid token."""
    try:
        return _FERNET.decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Invalid ciphertext") from exc


def last4(value: str) -> str:
    return value[-4:] if value and len(value) >= 4 else value or ""
