from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser
from app.schemas.upload import PresignedUploadRequest, PresignedUploadResponse
from app.services.storage_service import (
    PREFIX_RULES,
    StorageError,
    get_storage,
)


router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post(
    "/presigned",
    response_model=PresignedUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a presigned POST policy for direct browser upload",
)
async def create_presigned_upload(
    payload: PresignedUploadRequest,
    current_user: CurrentUser,
) -> PresignedUploadResponse:
    storage = get_storage()
    try:
        storage.validate_upload(payload.prefix, payload.content_type)
    except StorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    rules = PREFIX_RULES[payload.prefix]
    key = storage.build_key(payload.prefix, current_user.id, payload.filename)
    info = storage.presigned_post(
        key=key,
        content_type=payload.content_type,
        max_size=rules["max_size"],
    )

    return PresignedUploadResponse(
        **info,
        public_url=storage.public_url(key),
    )
