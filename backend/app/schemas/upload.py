from pydantic import BaseModel, Field


class PresignedUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=255)
    prefix: str = Field(default="avatars", max_length=64)


class PresignedUploadResponse(BaseModel):
    """
    S3 POST policy. Browser uploads via multipart/form-data to `url`,
    sending all `fields` plus a final `file` field with the file body.
    """

    url: str
    fields: dict[str, str]
    key: str
    public_url: str
    expires_in: int
    max_size: int
