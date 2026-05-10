from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    integrations_ai,
    integrations_whatsapp,
    uploads,
    users,
    whatsapp_chat,
)


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(uploads.router)
api_router.include_router(integrations_whatsapp.router)
api_router.include_router(integrations_ai.router)
api_router.include_router(whatsapp_chat.router)
