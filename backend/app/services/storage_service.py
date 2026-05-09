import logging
from functools import lru_cache
from typing import Any
from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings


logger = logging.getLogger(__name__)


# Allowed prefix → (allowed content types, max size in bytes)
PREFIX_RULES: dict[str, dict[str, Any]] = {
    "avatars": {
        "content_types": {"image/png", "image/jpeg", "image/webp"},
        "max_size": 5 * 1024 * 1024,  # 5 MB
    },
    "products": {
        "content_types": {"image/png", "image/jpeg", "image/webp"},
        "max_size": 10 * 1024 * 1024,  # 10 MB
    },
    "misc": {
        "content_types": {
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/pdf",
        },
        "max_size": 10 * 1024 * 1024,  # 10 MB
    },
}


class StorageError(Exception):
    """Raised for storage validation problems (caller maps to 4xx)."""


class StorageService:
    def __init__(self) -> None:
        scheme = "https" if settings.MINIO_SECURE else "http"
        self._endpoint = f"{scheme}://{settings.MINIO_ENDPOINT}"
        self._public_endpoint = settings.MINIO_PUBLIC_ENDPOINT.rstrip("/")
        self._bucket = settings.MINIO_BUCKET
        self._client = boto3.client(
            "s3",
            endpoint_url=self._endpoint,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self._public_client = boto3.client(
            "s3",
            endpoint_url=self._public_endpoint,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    @property
    def bucket(self) -> str:
        return self._bucket

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "")
            if error_code in {"404", "NoSuchBucket"}:
                self._client.create_bucket(Bucket=self._bucket)
                logger.info("Created MinIO bucket: %s", self._bucket)
            else:
                raise
        self._apply_public_read_policy()

    def _apply_public_read_policy(self) -> None:
        import json

        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{self._bucket}/*"],
                }
            ],
        }
        try:
            self._client.put_bucket_policy(
                Bucket=self._bucket, Policy=json.dumps(policy)
            )
        except ClientError as exc:
            logger.warning("Could not apply public-read policy: %s", exc)

    @staticmethod
    def build_key(prefix: str, owner_id: int | str, filename: str) -> str:
        """Owner-scoped key so users cannot guess each other's keys."""
        safe = filename.replace("/", "_").replace("\\", "_")
        return f"{prefix.strip('/')}/{owner_id}/{uuid4().hex}-{safe}"

    @staticmethod
    def validate_upload(prefix: str, content_type: str, size: int | None = None) -> None:
        rules = PREFIX_RULES.get(prefix)
        if rules is None:
            raise StorageError(f"Invalid upload prefix: {prefix}")
        if content_type not in rules["content_types"]:
            allowed = ", ".join(sorted(rules["content_types"]))
            raise StorageError(
                f"Unsupported content type for prefix '{prefix}'. Allowed: {allowed}"
            )
        if size is not None and size > rules["max_size"]:
            raise StorageError(
                f"File too large for prefix '{prefix}'. Max {rules['max_size']} bytes."
            )

    def presigned_post(
        self,
        key: str,
        content_type: str,
        max_size: int,
        expires_in: int = 600,
    ) -> dict[str, Any]:
        """
        Generate an S3 POST policy. Browser MUST upload via multipart/form-data
        with the returned `fields` and append the file as the last `file` field.

        The policy enforces both Content-Type and Content-Length-Range, so
        clients cannot exceed the size or change the type after signing.
        """
        conditions = [
            {"bucket": self._bucket},
            ["eq", "$key", key],
            ["eq", "$Content-Type", content_type],
            ["content-length-range", 1, max_size],
        ]
        fields = {"key": key, "Content-Type": content_type}

        result = self._public_client.generate_presigned_post(
            Bucket=self._bucket,
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=expires_in,
        )
        return {
            "url": result["url"],
            "fields": result["fields"],
            "key": key,
            "expires_in": expires_in,
            "max_size": max_size,
        }

    def public_url(self, key: str) -> str:
        return f"{self._public_endpoint}/{self._bucket}/{key}"

    @staticmethod
    def is_owned_by(key: str, owner_id: int | str) -> bool:
        """Verify a key belongs to the given owner (for prefixes that are owner-scoped)."""
        try:
            _, owner_part, *_rest = key.split("/", 2)
        except ValueError:
            return False
        return owner_part == str(owner_id)


@lru_cache
def get_storage() -> StorageService:
    return StorageService()
