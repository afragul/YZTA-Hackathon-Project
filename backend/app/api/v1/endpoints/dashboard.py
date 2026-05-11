"""Dashboard stats endpoint — real-time KPIs from DB."""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, status
from sqlalchemy import func, select, case

from app.api.deps import CurrentUser, DBSession
from app.models.customer import Customer
from app.models.notification import Notification
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.shipment import Shipment, ShipmentStatus
from app.models.task import Task, TaskStatus


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/stats",
    summary="Dashboard KPI stats",
    status_code=status.HTTP_200_OK,
)
async def get_dashboard_stats(
    _: CurrentUser,
    session: DBSession,
) -> dict:
    # Orders stats
    order_result = await session.execute(
        select(
            func.count(Order.id).label("total_orders"),
            func.coalesce(func.sum(Order.total_amount), 0).label("total_sales"),
            func.count(case((Order.status == OrderStatus.CANCELLED, 1))).label("cancellations"),
            func.count(case((Order.status == OrderStatus.PENDING, 1))).label("pending_orders"),
            func.count(case((Order.status == OrderStatus.SHIPPED, 1))).label("shipped_orders"),
            func.count(case((Order.status == OrderStatus.DELIVERED, 1))).label("delivered_orders"),
        )
    )
    row = order_result.one()
    total_orders = row.total_orders or 0
    total_sales = float(row.total_sales or 0)
    cancellations = row.cancellations or 0
    pending_orders = row.pending_orders or 0
    shipped_orders = row.shipped_orders or 0
    delivered_orders = row.delivered_orders or 0

    avg_basket = total_sales / total_orders if total_orders > 0 else 0

    # Customers count
    customer_count = (await session.execute(select(func.count(Customer.id)))).scalar_one()

    # Products count
    product_count = (await session.execute(
        select(func.count(Product.id)).where(Product.is_active.is_(True))
    )).scalar_one()

    # Low stock products
    low_stock_result = await session.execute(
        select(Product.id, Product.name, Product.sku, Product.stock, Product.low_stock_threshold)
        .where(
            Product.is_active.is_(True),
            Product.stock < Product.low_stock_threshold,
            Product.low_stock_threshold > 0,
        )
        .order_by(Product.stock)
        .limit(5)
    )
    low_stock = [
        {
            "id": r.id,
            "name": r.name,
            "sku": r.sku,
            "stock": float(r.stock),
            "threshold": float(r.low_stock_threshold),
        }
        for r in low_stock_result.all()
    ]

    # Top products by revenue (from order_items)
    top_products_result = await session.execute(
        select(
            Product.id,
            Product.name,
            Product.sku,
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.subtotal).label("revenue"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .group_by(Product.id, Product.name, Product.sku)
        .order_by(func.sum(OrderItem.subtotal).desc())
        .limit(5)
    )
    top_products = [
        {
            "id": r.id,
            "name": r.name,
            "sku": r.sku,
            "units": float(r.units_sold),
            "revenue": float(r.revenue),
        }
        for r in top_products_result.all()
    ]

    # Shipments stats
    shipment_result = await session.execute(
        select(
            func.count(Shipment.id).label("total"),
            func.count(case((Shipment.status == ShipmentStatus.DELAYED, 1))).label("delayed"),
            func.count(case((Shipment.status == ShipmentStatus.IN_TRANSIT, 1))).label("in_transit"),
            func.count(case((Shipment.status == ShipmentStatus.DELIVERED, 1))).label("delivered"),
        )
    )
    ship_row = shipment_result.one()

    # Tasks stats
    tasks_result = await session.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(case((Task.status == TaskStatus.TODO, 1))).label("todo"),
            func.count(case((Task.status == TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
        )
    )
    task_row = tasks_result.one()

    # Unread notifications
    unread_notifs = (await session.execute(
        select(func.count(Notification.id)).where(Notification.is_read.is_(False))
    )).scalar_one()

    return {
        "kpi": {
            "total_sales": total_sales,
            "total_orders": total_orders,
            "avg_basket": round(avg_basket, 2),
            "cancellations": cancellations,
            "pending_orders": pending_orders,
            "shipped_orders": shipped_orders,
            "delivered_orders": delivered_orders,
            "customers": customer_count,
            "products": product_count,
        },
        "shipments": {
            "total": ship_row.total or 0,
            "delayed": ship_row.delayed or 0,
            "in_transit": ship_row.in_transit or 0,
            "delivered": ship_row.delivered or 0,
        },
        "tasks": {
            "total": task_row.total or 0,
            "todo": task_row.todo or 0,
            "in_progress": task_row.in_progress or 0,
        },
        "unread_notifications": unread_notifs,
        "top_products": top_products,
        "low_stock": low_stock,
    }
