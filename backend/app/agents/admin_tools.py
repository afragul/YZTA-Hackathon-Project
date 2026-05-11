"""
Admin assistant tools — full system access for the panel owner.

Unlike customer-facing tools, these have no ownership restrictions.
The admin can query any customer, order, shipment, task, notification.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.notification import Notification
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.shipment import Shipment, ShipmentStatus
from app.models.stock_movement import StockMovement
from app.models.task import Task, TaskStatus


def _serialize(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return float(obj)
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


def _dump(data: Any) -> str:
    return json.dumps(data, default=_serialize, ensure_ascii=False)


# ─────────────────────────────────────── Args schemas


class EmptyArgs(BaseModel):
    pass


class SearchArgs(BaseModel):
    query: str = Field(default="", description="Arama terimi (boş bırakılabilir)")


class OrderNumberArgs(BaseModel):
    order_number: str = Field(description="Sipariş numarası (ör: ORD-2026-0001)")


class CustomerSearchArgs(BaseModel):
    query: str = Field(description="Müşteri adı, telefon veya whatsapp_id")


class StatusFilterArgs(BaseModel):
    status: str = Field(default="", description="Durum filtresi (boş=tümü)")


# ─────────────────────────────────────── Tool factories


def build_admin_tools(session: AsyncSession) -> list[StructuredTool]:
    """Build all admin-level tools with full system access."""

    # ── Dashboard / Overview ──

    async def _get_overview() -> str:
        orders_r = await session.execute(
            select(
                func.count(Order.id).label("total"),
                func.coalesce(func.sum(Order.total_amount), 0).label("sales"),
                func.count(case((Order.status == OrderStatus.PENDING, 1))).label("pending"),
                func.count(case((Order.status == OrderStatus.PREPARING, 1))).label("preparing"),
                func.count(case((Order.status == OrderStatus.SHIPPED, 1))).label("shipped"),
                func.count(case((Order.status == OrderStatus.DELIVERED, 1))).label("delivered"),
                func.count(case((Order.status == OrderStatus.CANCELLED, 1))).label("cancelled"),
            )
        )
        o = orders_r.one()
        customers = (await session.execute(select(func.count(Customer.id)))).scalar_one()
        products = (await session.execute(select(func.count(Product.id)).where(Product.is_active.is_(True)))).scalar_one()
        delayed = (await session.execute(
            select(func.count(Shipment.id)).where(Shipment.status == ShipmentStatus.DELAYED)
        )).scalar_one()
        low_stock = (await session.execute(
            select(func.count(Product.id)).where(
                Product.is_active.is_(True),
                Product.stock < Product.low_stock_threshold,
                Product.low_stock_threshold > 0,
            )
        )).scalar_one()
        tasks_todo = (await session.execute(
            select(func.count(Task.id)).where(Task.status == TaskStatus.TODO)
        )).scalar_one()
        unread = (await session.execute(
            select(func.count(Notification.id)).where(Notification.is_read.is_(False))
        )).scalar_one()

        return _dump({
            "toplam_siparis": o.total,
            "toplam_satis_tl": float(o.sales),
            "bekleyen_siparis": o.pending,
            "hazirlanan_siparis": o.preparing,
            "kargodaki_siparis": o.shipped,
            "teslim_edilen": o.delivered,
            "iptal_edilen": o.cancelled,
            "toplam_musteri": customers,
            "aktif_urun": products,
            "geciken_kargo": delayed,
            "dusuk_stok_urun": low_stock,
            "yapilacak_gorev": tasks_todo,
            "okunmamis_bildirim": unread,
        })

    get_overview = StructuredTool.from_function(
        coroutine=_get_overview,
        name="get_system_overview",
        description="Sistemin genel durumunu getir: sipariş sayıları, satış toplamı, müşteri/ürün sayısı, geciken kargolar, düşük stok, bekleyen görevler.",
        args_schema=EmptyArgs,
    )

    # ── Orders ──

    async def _list_orders(status: str = "") -> str:
        stmt = select(Order).options(selectinload(Order.shipment)).order_by(Order.created_at.desc()).limit(20)
        if status:
            try:
                stmt = stmt.where(Order.status == OrderStatus(status))
            except ValueError:
                pass
        result = await session.execute(stmt)
        orders = result.scalars().unique().all()
        return _dump({
            "orders": [
                {
                    "order_number": o.order_number,
                    "status": o.status.value,
                    "total_tl": float(o.total_amount),
                    "customer_id": o.customer_id,
                    "note": o.note,
                    "created_at": o.created_at,
                    "shipment_status": o.shipment.status.value if o.shipment else None,
                    "carrier": o.shipment.carrier if o.shipment else None,
                    "tracking": o.shipment.tracking_number if o.shipment else None,
                }
                for o in orders
            ]
        })

    list_orders = StructuredTool.from_function(
        coroutine=_list_orders,
        name="list_orders",
        description="Siparişleri listele. Opsiyonel status filtresi: pending, confirmed, preparing, shipped, delivered, cancelled. Boş bırakırsan son 20 siparişi getirir.",
        args_schema=StatusFilterArgs,
    )

    async def _get_order_detail(order_number: str) -> str:
        stmt = (
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.product),
                selectinload(Order.shipment),
                selectinload(Order.customer),
            )
            .where(Order.order_number == order_number)
        )
        result = await session.execute(stmt)
        o = result.scalar_one_or_none()
        if not o:
            return _dump({"error": f"{order_number} bulunamadı"})
        return _dump({
            "order_number": o.order_number,
            "status": o.status.value,
            "total_tl": float(o.total_amount),
            "note": o.note,
            "created_at": o.created_at,
            "customer": {"id": o.customer.id, "name": o.customer.full_name, "phone": o.customer.phone} if o.customer else None,
            "items": [{"name": i.product.name if i.product else "?", "qty": float(i.quantity), "price": float(i.unit_price)} for i in o.items],
            "shipment": {
                "carrier": o.shipment.carrier,
                "tracking": o.shipment.tracking_number,
                "status": o.shipment.status.value,
                "expected": o.shipment.expected_delivery,
                "delivered_at": o.shipment.delivered_at,
                "last_event": o.shipment.last_event,
            } if o.shipment else None,
        })

    get_order_detail = StructuredTool.from_function(
        coroutine=_get_order_detail,
        name="get_order_detail",
        description="Sipariş numarasıyla detaylı bilgi getir: kalemler, müşteri, kargo durumu.",
        args_schema=OrderNumberArgs,
    )

    # ── Customers ──

    async def _list_customers(query: str = "") -> str:
        stmt = select(Customer).order_by(Customer.created_at.desc()).limit(20)
        if query.strip():
            pattern = f"%{query}%"
            stmt = stmt.where(
                Customer.full_name.ilike(pattern)
                | Customer.phone.ilike(pattern)
                | Customer.whatsapp_id.ilike(pattern)
                | Customer.city.ilike(pattern)
            )
        result = await session.execute(stmt)
        customers = result.scalars().all()
        return _dump({
            "customers": [
                {
                    "id": c.id,
                    "name": c.full_name,
                    "phone": c.phone,
                    "whatsapp_id": c.whatsapp_id,
                    "city": c.city,
                    "email": c.email,
                }
                for c in customers
            ]
        })

    list_customers = StructuredTool.from_function(
        coroutine=_list_customers,
        name="list_customers",
        description="Müşterileri listele veya ara (isim, telefon, şehir ile). Boş query tüm müşterileri getirir.",
        args_schema=CustomerSearchArgs,
    )

    # ── Products & Stock ──

    async def _search_products(query: str = "") -> str:
        stmt = select(Product).where(Product.is_active.is_(True))
        if query.strip():
            stmt = stmt.where(
                Product.name.ilike(f"%{query}%")
                | Product.sku.ilike(f"%{query}%")
                | Product.category.ilike(f"%{query}%")
            )
        stmt = stmt.limit(15)
        result = await session.execute(stmt)
        products = result.scalars().all()
        return _dump({
            "products": [
                {
                    "id": p.id,
                    "sku": p.sku,
                    "name": p.name,
                    "category": p.category,
                    "price_tl": float(p.price),
                    "stock": float(p.stock),
                    "threshold": float(p.low_stock_threshold),
                    "unit": p.unit.value,
                }
                for p in products
            ]
        })

    search_products = StructuredTool.from_function(
        coroutine=_search_products,
        name="search_products",
        description="Ürünleri ara (isim, SKU, kategori). Boş query tüm aktif ürünleri getirir. Stok ve fiyat bilgisi dahil.",
        args_schema=SearchArgs,
    )

    async def _get_low_stock() -> str:
        result = await session.execute(
            select(Product)
            .where(
                Product.is_active.is_(True),
                Product.stock < Product.low_stock_threshold,
                Product.low_stock_threshold > 0,
            )
            .order_by(Product.stock)
        )
        products = result.scalars().all()
        return _dump({
            "low_stock_products": [
                {"name": p.name, "sku": p.sku, "stock": float(p.stock), "threshold": float(p.low_stock_threshold), "unit": p.unit.value}
                for p in products
            ]
        })

    get_low_stock = StructuredTool.from_function(
        coroutine=_get_low_stock,
        name="get_low_stock_products",
        description="Stoğu eşik değerinin altına düşmüş ürünleri getir.",
        args_schema=EmptyArgs,
    )

    # ── Shipments ──

    async def _list_shipments(status: str = "") -> str:
        stmt = select(Shipment).options(selectinload(Shipment.order)).order_by(Shipment.created_at.desc()).limit(20)
        if status:
            try:
                stmt = stmt.where(Shipment.status == ShipmentStatus(status))
            except ValueError:
                pass
        result = await session.execute(stmt)
        shipments = result.scalars().all()
        return _dump({
            "shipments": [
                {
                    "order_number": s.order.order_number if s.order else None,
                    "carrier": s.carrier,
                    "tracking": s.tracking_number,
                    "status": s.status.value,
                    "expected": s.expected_delivery,
                    "last_event": s.last_event,
                }
                for s in shipments
            ]
        })

    list_shipments = StructuredTool.from_function(
        coroutine=_list_shipments,
        name="list_shipments",
        description="Kargoları listele. Opsiyonel status: pending, in_transit, out_for_delivery, delivered, delayed, failed.",
        args_schema=StatusFilterArgs,
    )

    # ── Tasks ──

    async def _list_tasks(status: str = "") -> str:
        stmt = select(Task).order_by(Task.created_at.desc()).limit(20)
        if status:
            try:
                stmt = stmt.where(Task.status == TaskStatus(status))
            except ValueError:
                pass
        result = await session.execute(stmt)
        tasks = result.scalars().all()
        return _dump({
            "tasks": [
                {
                    "title": t.title,
                    "type": t.task_type.value,
                    "status": t.status.value,
                    "priority": t.priority.value,
                    "due_at": t.due_at,
                    "assignee_id": t.assignee_id,
                }
                for t in tasks
            ]
        })

    list_tasks = StructuredTool.from_function(
        coroutine=_list_tasks,
        name="list_tasks",
        description="Görevleri listele. Opsiyonel status: todo, in_progress, done, cancelled.",
        args_schema=StatusFilterArgs,
    )

    # ── Notifications ──

    async def _list_notifications() -> str:
        result = await session.execute(
            select(Notification)
            .where(Notification.is_read.is_(False))
            .order_by(Notification.created_at.desc())
            .limit(10)
        )
        notifs = result.scalars().all()
        return _dump({
            "unread_notifications": [
                {
                    "title": n.title,
                    "message": n.message,
                    "type": n.type.value,
                    "severity": n.severity.value,
                    "created_at": n.created_at,
                }
                for n in notifs
            ]
        })

    list_notifications = StructuredTool.from_function(
        coroutine=_list_notifications,
        name="list_unread_notifications",
        description="Okunmamış bildirimleri getir (düşük stok, kargo gecikmesi, yeni sipariş vb.).",
        args_schema=EmptyArgs,
    )

    return [
        get_overview,
        list_orders,
        get_order_detail,
        list_customers,
        search_products,
        get_low_stock,
        list_shipments,
        list_tasks,
        list_notifications,
    ]
