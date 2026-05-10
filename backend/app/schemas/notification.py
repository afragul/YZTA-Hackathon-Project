"""Pydantic schemas for Notification."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import NotificationSeverity, NotificationType


class NotificationCreate(BaseModel):
    user_id: int | None = None
    type: NotificationType
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1)
    severity: NotificationSeverity = NotificationSeverity.INFO
    payload: dict | None = None


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    type: NotificationType
    title: str
    message: str
    severity: NotificationSeverity
    is_read: bool
    payload: dict | None
    created_at: datetime
    read_at: datetime | None
