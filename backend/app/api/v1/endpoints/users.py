from fastapi import APIRouter, Depends, status

from app.api.deps import CurrentUser, UserServiceDep, require_admin
from app.models.user import User
from app.schemas.presenters import user_to_read
from app.schemas.user import UserRead, UserUpdateMe


router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "",
    response_model=list[UserRead],
    status_code=status.HTTP_200_OK,
    summary="List all users",
)
async def list_users(
    current_user: CurrentUser,
    user_service: UserServiceDep,
) -> list[UserRead]:
    users = await user_service.list_all()
    return [user_to_read(u) for u in users]


@router.get(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user",
)
async def read_me(current_user: CurrentUser) -> UserRead:
    return user_to_read(current_user)


@router.patch(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
async def update_me(
    payload: UserUpdateMe,
    current_user: CurrentUser,
    user_service: UserServiceDep,
) -> UserRead:
    fields = payload.model_fields_set

    updated = await user_service.update_profile(
        current_user,
        full_name=payload.full_name if "full_name" in fields else None,
        avatar_key=payload.avatar_key,
        unset_full_name="full_name" in fields and payload.full_name is None,
        unset_avatar="avatar_key" in fields and payload.avatar_key is None,
        owner_check_on_avatar=True,
    )
    return user_to_read(updated)
