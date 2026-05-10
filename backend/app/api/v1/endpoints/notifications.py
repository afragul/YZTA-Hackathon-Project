"""Notification API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.notification import NotificationCreate, NotificationRead
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_notification_service(session: DBSession) -> NotificationService:
    return NotificationService(session)


NotificationServiceDep = Annotated[NotificationService, Depends(get_notification_service)]


@router.get(
    "",
    response_model=list[NotificationRead],
    summary="List notifications for current user",
)
async def list_notifications(
    current_user: CurrentUser,
    service: NotificationServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = False,
) -> list[NotificationRead]:
    notifications = await service.list_for_user(
        current_user.id, skip=skip, limit=limit, unread_only=unread_only
    )
    return [NotificationRead.model_validate(n) for n in notifications]


@router.post(
    "",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create notification",
)
async def create_notification(
    payload: NotificationCreate,
    _: CurrentUser,
    service: NotificationServiceDep,
) -> NotificationRead:
    notification = await service.create(payload)
    return NotificationRead.model_validate(notification)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationRead,
    summary="Mark notification as read",
)
async def mark_notification_read(
    notification_id: int,
    _: CurrentUser,
    service: NotificationServiceDep,
) -> NotificationRead:
    notification = await service.get_by_id(notification_id)
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    updated = await service.mark_as_read(notification)
    return NotificationRead.model_validate(updated)


@router.post(
    "/mark-all-read",
    summary="Mark all notifications as read",
)
async def mark_all_read(
    current_user: CurrentUser,
    service: NotificationServiceDep,
) -> dict:
    count = await service.mark_all_read(current_user.id)
    return {"marked_count": count}
