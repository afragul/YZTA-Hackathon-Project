from app.schemas.ai_provider import (
    AiModelInfo,
    AiModelListResult,
    AiProviderCreate,
    AiProviderRead,
    AiProviderTestResult,
    AiProviderUpdate,
)
from app.schemas.auth import AccessToken, RefreshRequest, TokenPair
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate
from app.schemas.notification import NotificationCreate, NotificationRead
from app.schemas.order import OrderCreate, OrderItemCreate, OrderItemRead, OrderRead, OrderUpdate
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.shipment import ShipmentCreate, ShipmentRead, ShipmentUpdate
from app.schemas.stock_movement import StockMovementCreate, StockMovementRead
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.schemas.user import UserBase, UserCreate, UserRead, UserUpdateMe
from app.schemas.whatsapp import (
    WhatsAppAccountCreate,
    WhatsAppAccountRead,
    WhatsAppAccountUpdate,
    WhatsAppSendTestRequest,
    WhatsAppSendTestResult,
    WhatsAppTestResult,
)

__all__ = [
    "AccessToken",
    "AiModelInfo",
    "AiModelListResult",
    "AiProviderCreate",
    "AiProviderRead",
    "AiProviderTestResult",
    "AiProviderUpdate",
    # Customer
    "CustomerCreate",
    "CustomerRead",
    "CustomerUpdate",
    # Notification
    "NotificationCreate",
    "NotificationRead",
    # Order
    "OrderCreate",
    "OrderItemCreate",
    "OrderItemRead",
    "OrderRead",
    "OrderUpdate",
    # Product
    "ProductCreate",
    "ProductRead",
    "ProductUpdate",
    "RefreshRequest",
    # Shipment
    "ShipmentCreate",
    "ShipmentRead",
    "ShipmentUpdate",
    # Stock Movement
    "StockMovementCreate",
    "StockMovementRead",
    # Task
    "TaskCreate",
    "TaskRead",
    "TaskUpdate",
    "TokenPair",
    "UserBase",
    "UserCreate",
    "UserRead",
    "UserUpdateMe",
    "WhatsAppAccountCreate",
    "WhatsAppAccountRead",
    "WhatsAppAccountUpdate",
    "WhatsAppSendTestRequest",
    "WhatsAppSendTestResult",
    "WhatsAppTestResult",
]
