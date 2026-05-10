from fastapi import APIRouter

from app.api.v1.endpoints import (
    agents,
    auth,
    customers,
    integrations_ai,
    integrations_whatsapp,
    notifications,
    orders,
    products,
    shipments,
    tasks,
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
api_router.include_router(agents.router)
api_router.include_router(whatsapp_chat.router)
api_router.include_router(customers.router)
api_router.include_router(products.router)
api_router.include_router(orders.router)
api_router.include_router(shipments.router)
api_router.include_router(tasks.router)
api_router.include_router(notifications.router)
