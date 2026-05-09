from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    TokenValidationError,
    parse_token,
)
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.token_service import TokenBlocklistService
from app.services.user_service import UserService


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    auto_error=True,
)

DBSession = Annotated[AsyncSession, Depends(get_db)]


def get_user_service(session: DBSession) -> UserService:
    return UserService(session)


def get_token_service(session: DBSession) -> TokenBlocklistService:
    return TokenBlocklistService(session)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
TokenServiceDep = Annotated[TokenBlocklistService, Depends(get_token_service)]


CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def _resolve_user_from_token(
    token: str,
    expected_type: str,
    user_service: UserService,
    token_service: TokenBlocklistService,
) -> tuple[User, dict]:
    try:
        payload = parse_token(token, expected_type)
    except TokenValidationError:
        raise CREDENTIALS_EXC

    if await token_service.is_revoked(payload["jti"]):
        raise CREDENTIALS_EXC

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise CREDENTIALS_EXC

    user = await user_service.get_by_id(user_id)
    if user is None or not user.is_active:
        raise CREDENTIALS_EXC
    return user, payload


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    user_service: UserServiceDep,
    token_service: TokenServiceDep,
) -> User:
    user, _ = await _resolve_user_from_token(
        token, ACCESS_TOKEN_TYPE, user_service, token_service
    )
    return user


async def get_current_token(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> str:
    """Expose the raw access token for handlers that need the jti (e.g. logout)."""
    return token


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentToken = Annotated[str, Depends(get_current_token)]


async def validate_refresh_token(
    raw_token: str,
    user_service: UserService,
    token_service: TokenBlocklistService,
) -> tuple[User, dict]:
    """Shared validation logic for /auth/refresh and /auth/logout."""
    return await _resolve_user_from_token(
        raw_token, REFRESH_TOKEN_TYPE, user_service, token_service
    )


def require_roles(*roles: UserRole):
    async def _checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _checker


require_admin = require_roles(UserRole.ADMIN)
