"""
Database seeder — populates all tables from seed_data.py.

Usage:
    python -m app.db.seeder          (from backend/ directory)

Idempotent: checks if data already exists before inserting.
"""

import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.seed_data import SEED
from app.db.session import database
from app.models.agent import (
    AgentConversation,
    AgentConversationStatus,
    AgentMessage,
    AgentMessageStatus,
    ConversationChannel,
    MessageDirection,
    MessageProvider,
    MessageRole,
    MessageType,
)
from app.models.customer import Customer
from app.models.notification import Notification, NotificationSeverity, NotificationType
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product, ProductUnit
from app.models.shipment import Shipment, ShipmentStatus
from app.models.stock_movement import StockMovement, StockMovementType
from app.models.task import Task, TaskPriority, TaskStatus, TaskType
from app.models.user import User, UserRole
from app.models.whatsapp import (
    TemplateCategory,
    TemplateStatus,
    WhatsAppTemplate,
)

logger = logging.getLogger(__name__)


async def _is_seeded(session: AsyncSession) -> bool:
    """Check if seed data already exists."""
    result = await session.execute(select(func.count(Customer.id)))
    count = result.scalar_one()
    return count > 0


async def seed_all(session: AsyncSession) -> None:
    """Seed all tables in dependency order."""
    if await _is_seeded(session):
        logger.info("Database already seeded, skipping.")
        return

    logger.info("Seeding database with demo data...")

    # 1. Users
    user_map: dict[str, User] = {}
    for u in SEED["users"]:
        existing = await session.execute(
            select(User).where(User.username == u["username"])
        )
        user = existing.scalar_one_or_none()
        if user is None:
            user = User(
                username=u["username"],
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                role=UserRole(u["role"]),
                full_name=u["full_name"],
                is_active=True,
            )
            session.add(user)
        user_map[u["username"]] = user
    await session.flush()
    logger.info("  ✓ Users: %d", len(SEED["users"]))

    # 2. Customers
    customers: list[Customer] = []
    for c in SEED["customers"]:
        customer = Customer(
            full_name=c["full_name"],
            phone=c["phone"],
            whatsapp_id=c["whatsapp_id"],
            whatsapp_profile_name=c["whatsapp_profile_name"],
            whatsapp_opt_in=c["whatsapp_opt_in"],
            email=c["email"],
            address=c["address"],
            city=c["city"],
            notes=c["notes"],
        )
        session.add(customer)
        customers.append(customer)
    await session.flush()
    logger.info("  ✓ Customers: %d", len(customers))

    # 3. Products
    products: list[Product] = []
    for p in SEED["products"]:
        product = Product(
            sku=p["sku"],
            name=p["name"],
            description=p["description"],
            category=p["category"],
            unit=ProductUnit(p["unit"]),
            price=Decimal(p["price"]),
            stock=Decimal(p["stock"]),
            low_stock_threshold=Decimal(p["low_stock_threshold"]),
            is_active=p["is_active"],
        )
        session.add(product)
        products.append(product)
    await session.flush()
    logger.info("  ✓ Products: %d", len(products))

    # 4. Orders + OrderItems
    orders: list[Order] = []
    for o in SEED["orders"]:
        customer = customers[o["customer_index"]]
        order = Order(
            order_number=o["order_number"],
            customer_id=customer.id,
            status=OrderStatus(o["status"]),
            currency=o["currency"],
            note=o["note"],
            total_amount=Decimal("0"),
        )
        session.add(order)
        await session.flush()

        total = Decimal("0")
        for item in o["items"]:
            product = products[item["product_index"]]
            qty = Decimal(item["quantity"])
            unit_price = product.price
            subtotal = qty * unit_price
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            )
            session.add(order_item)
            total += subtotal

        order.total_amount = total
        orders.append(order)
    await session.flush()
    logger.info("  ✓ Orders: %d", len(orders))

    # 5. Shipments
    for s in SEED["shipments"]:
        order = orders[s["order_index"]]
        shipment = Shipment(
            order_id=order.id,
            carrier=s["carrier"],
            tracking_number=s["tracking_number"],
            status=ShipmentStatus(s["status"]),
            expected_delivery=(
                datetime.strptime(s["expected_delivery"], "%Y-%m-%d").date()
                if s["expected_delivery"]
                else None
            ),
            delivered_at=(
                datetime.fromisoformat(s["delivered_at"])
                if s["delivered_at"]
                else None
            ),
            last_event=s["last_event"],
        )
        session.add(shipment)
    await session.flush()
    logger.info("  ✓ Shipments: %d", len(SEED["shipments"]))

    # 6. Stock Movements
    for sm in SEED["stock_movements"]:
        product = products[sm["product_index"]]
        movement = StockMovement(
            product_id=product.id,
            movement_type=StockMovementType(sm["movement_type"]),
            quantity=Decimal(sm["quantity"]),
            reason=sm["reason"],
            order_id=orders[sm["order_index"]].id if sm["order_index"] is not None else None,
        )
        session.add(movement)
    await session.flush()
    logger.info("  ✓ Stock Movements: %d", len(SEED["stock_movements"]))

    # 7. Tasks
    for t in SEED["tasks"]:
        assignee = user_map.get(t["assignee_username"])
        task = Task(
            title=t["title"],
            description=t["description"],
            task_type=TaskType(t["task_type"]),
            status=TaskStatus(t["status"]),
            priority=TaskPriority(t["priority"]),
            assignee_id=assignee.id if assignee else None,
            related_order_id=orders[t["order_index"]].id if t["order_index"] is not None else None,
            due_at=(
                datetime.fromisoformat(t["due_at"]) if t["due_at"] else None
            ),
        )
        session.add(task)
    await session.flush()
    logger.info("  ✓ Tasks: %d", len(SEED["tasks"]))

    # 8. Notifications
    for n in SEED["notifications"]:
        user_id = None
        if n["user_username"]:
            user = user_map.get(n["user_username"])
            user_id = user.id if user else None
        notification = Notification(
            user_id=user_id,
            type=NotificationType(n["type"]),
            title=n["title"],
            message=n["message"],
            severity=NotificationSeverity(n["severity"]),
            is_read=n["is_read"],
            payload=n["payload"],
        )
        session.add(notification)
    await session.flush()
    logger.info("  ✓ Notifications: %d", len(SEED["notifications"]))

    # 9. WhatsApp Templates
    templates: list[WhatsAppTemplate] = []
    for wt in SEED["whatsapp_templates"]:
        template = WhatsAppTemplate(
            name=wt["name"],
            language=wt["language"],
            category=TemplateCategory(wt["category"]),
            status=TemplateStatus(wt["status"]),
            body=wt["body"],
            variables_schema=wt["variables_schema"],
        )
        session.add(template)
        templates.append(template)
    await session.flush()
    logger.info("  ✓ WhatsApp Templates: %d", len(templates))

    # 10. Agent Conversations
    conversations: list[AgentConversation] = []
    for ac in SEED["agent_conversations"]:
        customer = customers[ac["customer_index"]]
        handled_by_id = None
        if ac["handled_by_user_username"]:
            handled_user = user_map.get(ac["handled_by_user_username"])
            handled_by_id = handled_user.id if handled_user else None
        conv = AgentConversation(
            customer_id=customer.id,
            channel=ConversationChannel(ac["channel"]),
            external_thread_id=ac["external_thread_id"],
            wa_phone_number_id=ac["wa_phone_number_id"],
            status=AgentConversationStatus(ac["status"]),
            handled_by_user_id=handled_by_id,
            unread_count=ac["unread_count"],
            summary=ac["summary"],
            last_message_at=datetime.now(timezone.utc),
            last_inbound_at=datetime.now(timezone.utc),
        )
        session.add(conv)
        conversations.append(conv)
    await session.flush()
    logger.info("  ✓ Agent Conversations: %d", len(conversations))

    # 11. Agent Messages
    for am in SEED["agent_messages"]:
        conv = conversations[am["conversation_index"]]
        msg = AgentMessage(
            conversation_id=conv.id,
            direction=MessageDirection(am["direction"]),
            role=MessageRole(am["role"]),
            message_type=MessageType(am["message_type"]),
            content=am["content"],
            provider=MessageProvider(am["provider"]),
            provider_message_id=am.get("provider_message_id"),
            status=AgentMessageStatus(am["status"]),
            tool_name=am.get("tool_name"),
            tool_payload=am.get("tool_payload"),
        )
        session.add(msg)
    await session.flush()
    logger.info("  ✓ Agent Messages: %d", len(SEED["agent_messages"]))

    await session.commit()
    logger.info("✅ Seed complete!")


async def run_seeder() -> None:
    """Entry point for running seeder standalone."""
    from app.db.init_db import run_migrations

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    await run_migrations()
    async with database.session_factory() as session:
        await seed_all(session)


if __name__ == "__main__":
    asyncio.run(run_seeder())
