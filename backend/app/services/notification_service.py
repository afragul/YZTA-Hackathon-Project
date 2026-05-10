"""Notification service — CRUD operations."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.schemas.notification import NotificationCreate


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, notification_id: int) -> Notification | None:
        result = await self.session.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False,
    ) -> list[Notification]:
        """Get notifications for a user (including broadcasts where user_id is NULL)."""
        stmt = (
            select(Notification)
            .where(
                or_(Notification.user_id == user_id, Notification.user_id.is_(None))
            )
            .order_by(Notification.created_at.desc())
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: NotificationCreate) -> Notification:
        notification = Notification(**data.model_dump())
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def mark_as_read(self, notification: Notification) -> Notification:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def mark_all_read(self, user_id: int) -> int:
        """Mark all unread notifications for a user as read. Returns count."""
        now = datetime.now(timezone.utc)
        result = await self.session.execute(
            update(Notification)
            .where(
                or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        await self.session.commit()
        return result.rowcount  # type: ignore[return-value]
