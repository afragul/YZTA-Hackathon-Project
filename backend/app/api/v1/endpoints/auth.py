from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import (
    CurrentToken,
    CurrentUser,
    TokenServiceDep,
    UserServiceDep,
    validate_refresh_token,
)
from app.core.rate_limit import login_limiter
from app.core.security import (
    ACCESS_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    parse_token,
    token_expiry,
)
from app.schemas.auth import AccessToken, RefreshRequest, TokenPair
from app.schemas.presenters import user_to_read
from app.schemas.user import UserCreate, UserRead


router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: UserCreate,
    user_service: UserServiceDep,
) -> UserRead:
    if await user_service.get_by_username(payload.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        )
    if await user_service.get_by_email(payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = await user_service.create(
        username=payload.username,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return user_to_read(user)


@router.post(
    "/login",
    response_model=TokenPair,
    status_code=status.HTTP_200_OK,
    summary="OAuth2 password login",
)
async def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    user_service: UserServiceDep,
) -> TokenPair:
    rate_key = f"{_client_ip(request)}:{form_data.username.lower()}"
    allowed, retry_after = await login_limiter.check(rate_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    user = await user_service.authenticate(form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = {"role": user.role.value, "username": user.username}
    return TokenPair(
        access_token=create_access_token(user.id, extra_claims=claims),
        refresh_token=create_refresh_token(user.id),
    )


@router.post(
    "/refresh",
    response_model=AccessToken,
    status_code=status.HTTP_200_OK,
    summary="Exchange refresh token for a new access token",
)
async def refresh_token(
    payload: RefreshRequest,
    user_service: UserServiceDep,
    token_service: TokenServiceDep,
) -> AccessToken:
    user, _ = await validate_refresh_token(
        payload.refresh_token, user_service, token_service
    )
    claims = {"role": user.role.value, "username": user.username}
    return AccessToken(access_token=create_access_token(user.id, extra_claims=claims))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current access token (and optionally a refresh token)",
)
async def logout(
    current_user: CurrentUser,
    current_token: CurrentToken,
    token_service: TokenServiceDep,
    payload: RefreshRequest | None = None,
) -> None:
    # Revoke access token's jti.
    try:
        access_payload = parse_token(current_token, ACCESS_TOKEN_TYPE)
    except Exception:
        # If the current token is unparseable we shouldn't have reached here,
        # but stay defensive — the dep already enforced validity.
        return

    await token_service.revoke(
        access_payload["jti"],
        current_user.id,
        token_expiry(access_payload),
    )

    # Optionally revoke a paired refresh token.
    if payload and payload.refresh_token:
        try:
            from app.core.security import REFRESH_TOKEN_TYPE

            refresh_payload = parse_token(payload.refresh_token, REFRESH_TOKEN_TYPE)
        except Exception:
            return
        if str(refresh_payload.get("sub")) == str(current_user.id):
            await token_service.revoke(
                refresh_payload["jti"],
                current_user.id,
                token_expiry(refresh_payload),
            )
