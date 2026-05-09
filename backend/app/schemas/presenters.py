"""
Light "presenter" helpers that convert ORM models to response schemas
when extra computed fields (e.g. avatar_url) are needed.
"""
from app.models.user import User
from app.schemas.user import UserRead
from app.services.storage_service import get_storage


def user_to_read(user: User) -> UserRead:
    storage = get_storage()
    data = UserRead.model_validate(user)
    data.avatar_url = (
        storage.public_url(user.avatar_key) if user.avatar_key else None
    )
    return data
