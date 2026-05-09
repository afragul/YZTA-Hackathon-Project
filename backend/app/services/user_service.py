from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.services.storage_service import StorageService


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def authenticate(self, username: str, password: str) -> User | None:
        user = await self.get_by_username(username)
        if user is None:
            return None
        if not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def create(
        self,
        *,
        username: str,
        email: str,
        password: str,
        role: UserRole = UserRole.USER,
        full_name: str | None = None,
        is_active: bool = True,
    ) -> User:
        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role=role,
            full_name=full_name,
            is_active=is_active,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_profile(
        self,
        user: User,
        *,
        full_name: str | None = None,
        avatar_key: str | None = None,
        unset_full_name: bool = False,
        unset_avatar: bool = False,
        owner_check_on_avatar: bool = False,
    ) -> User:
        if unset_full_name:
            user.full_name = None
        elif full_name is not None:
            user.full_name = full_name

        if unset_avatar:
            user.avatar_key = None
        elif avatar_key is not None:
            if owner_check_on_avatar and not StorageService.is_owned_by(
                avatar_key, user.id
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Avatar key does not belong to this user",
                )
            user.avatar_key = avatar_key

        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
