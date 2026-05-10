"""
LangChain tools for the WhatsApp AI agents.

All tools accept an AsyncSession via factory closures and return JSON
strings (the LLM parses them as natural language context).
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.shipment import Shipment


# ─────────────────────────────────────────────────────────── helpers


def _serialize(obj: Any) -> Any:
    """JSON-friendly conversion for Decimal / datetime."""
    if isinstance(obj, Decimal):
        return float(obj)
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


def _dump(data: Any) -> str:
    return json.dumps(data, default=_serialize, ensure_ascii=False)


# ─────────────────────────────────────────────────────────── product tools


class SearchProductsArgs(BaseModel):
    query: str = Field(description="Ürün adı veya SKU")


class GetProductDetailsArgs(BaseModel):
    product_id_or_sku: str = Field(
        description="Ürün ID (sayı) veya SKU (örn: BAL-CICEK-1KG)"
    )


def _make_search_products(session: AsyncSession):
    async def _run(query: str) -> str:
        stmt = select(Product).where(Product.is_active.is_(True))
        if query.strip():
            stmt = stmt.where(
                Product.name.ilike(f"%{query}%")
                | Product.sku.ilike(f"%{query}%")
                | Product.category.ilike(f"%{query}%")
            )
        stmt = stmt.limit(10)
        result = await session.execute(stmt)
        items = result.scalars().all()
        # Filter to in-stock only
        in_stock = [p for p in items if float(p.stock) > 0]
        if not in_stock:
            return _dump({"results": [], "message": "Bu sorguya uygun stokta ürün bulunamadı."})
        return _dump({
            "results": [
                {
                    "id": p.id,
                    "sku": p.sku,
                    "name": p.name,
                    "category": p.category,
                    "unit": p.unit.value if p.unit else None,
                    "price_try": float(p.price),
                    "in_stock": float(p.stock) > 0,
                }
                for p in in_stock
            ]
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="search_products",
        description="Ürünleri isim, kategori veya SKU ile ara. Boş query ile çağırırsan tüm aktif ürünleri döner. En fazla 10 sonuç.",
        args_schema=SearchProductsArgs,
    )


def _make_get_product_details(session: AsyncSession):
    async def _run(product_id_or_sku: str) -> str:
        # Try numeric ID first, then SKU
        stmt = select(Product)
        try:
            pid = int(product_id_or_sku)
            stmt = stmt.where(Product.id == pid)
        except ValueError:
            stmt = stmt.where(Product.sku == product_id_or_sku)
        result = await session.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            return _dump({"error": "Ürün bulunamadı."})
        return _dump({
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "category": product.category,
            "unit": product.unit.value if product.unit else None,
            "price_try": float(product.price),
            "description": product.description,
            "in_stock": float(product.stock) > 0,
            "is_active": product.is_active,
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="get_product_details",
        description="Tek bir ürünün detaylarını getir (id veya SKU ile).",
        args_schema=GetProductDetailsArgs,
    )


def _make_list_low_stock_products(session: AsyncSession):
    async def _run() -> str:
        stmt = select(Product).where(
            Product.is_active.is_(True),
            Product.stock < Product.low_stock_threshold,
            Product.low_stock_threshold > 0,
        ).limit(20)
        result = await session.execute(stmt)
        items = result.scalars().all()
        return _dump({
            "low_stock_products": [
                {
                    "id": p.id,
                    "sku": p.sku,
                    "name": p.name,
                    "stock": float(p.stock),
                    "threshold": float(p.low_stock_threshold),
                    "unit": p.unit.value if p.unit else None,
                }
                for p in items
            ]
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="list_low_stock_products",
        description="Stoğu eşik değerinin altına düşmüş ürünleri listele.",
        args_schema=type("EmptyArgs", (BaseModel,), {}),
    )


# ─────────────────────────────────────────────────────────── order tools


class GetOrderStatusArgs(BaseModel):
    order_number: str = Field(
        description="Sipariş numarası (ör. ORD-2026-0001)"
    )


class LookupCustomerByPhoneArgs(BaseModel):
    phone: str = Field(
        description="Müşteri telefon numarası (whatsapp_id veya E.164 format)"
    )


class ListCustomerOrdersArgs(BaseModel):
    customer_id: int = Field(description="Müşteri ID (lookup_customer_by_phone'dan al)")


def _make_get_order_status(session: AsyncSession):
    async def _run(order_number: str) -> str:
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
        order = result.scalar_one_or_none()
        if not order:
            return _dump({"error": f"{order_number} numaralı sipariş bulunamadı."})

        shipment = order.shipment
        return _dump({
            "order_number": order.order_number,
            "status": order.status.value if order.status else None,
            "total_try": float(order.total_amount),
            "currency": order.currency,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "customer_name": order.customer.full_name if order.customer else None,
            "items": [
                {
                    "product_name": i.product.name if i.product else None,
                    "quantity": float(i.quantity),
                    "unit_price_try": float(i.unit_price),
                    "subtotal_try": float(i.subtotal),
                }
                for i in order.items
            ],
            "shipment": {
                "carrier": shipment.carrier,
                "tracking_number": shipment.tracking_number,
                "status": shipment.status.value if shipment.status else None,
                "expected_delivery": shipment.expected_delivery.isoformat()
                if shipment.expected_delivery else None,
                "delivered_at": shipment.delivered_at.isoformat()
                if shipment.delivered_at else None,
                "last_event": shipment.last_event,
            } if shipment else None,
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="get_order_status",
        description=(
            "Sipariş numarası ile sipariş durumunu, kalemleri ve kargo takip "
            "bilgilerini getir. Format: ORD-YYYY-NNNN"
        ),
        args_schema=GetOrderStatusArgs,
    )


def _make_lookup_customer_by_phone(session: AsyncSession):
    async def _run(phone: str) -> str:
        # Try variations: with/without leading +, 90 prefix, etc.
        variants = {phone}
        cleaned = phone.lstrip("+").replace(" ", "").replace("-", "")
        variants.add(cleaned)
        if cleaned.startswith("90"):
            variants.add("0" + cleaned[2:])
            variants.add(cleaned[2:])
        elif cleaned.startswith("0"):
            variants.add("90" + cleaned[1:])

        stmt = select(Customer).where(
            Customer.whatsapp_id.in_(variants) | Customer.phone.in_(variants)
        ).limit(1)
        result = await session.execute(stmt)
        customer = result.scalar_one_or_none()
        if not customer:
            return _dump({"found": False, "message": "Bu numarayla kayıtlı müşteri bulunamadı."})
        return _dump({
            "found": True,
            "id": customer.id,
            "full_name": customer.full_name,
            "phone": customer.phone,
            "whatsapp_id": customer.whatsapp_id,
            "city": customer.city,
            "email": customer.email,
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="lookup_customer_by_phone",
        description="Telefon numarasıyla müşteri kaydını bul.",
        args_schema=LookupCustomerByPhoneArgs,
    )


def _make_list_customer_orders(session: AsyncSession):
    async def _run(customer_id: int) -> str:
        stmt = (
            select(Order)
            .options(selectinload(Order.shipment))
            .where(Order.customer_id == customer_id)
            .order_by(Order.created_at.desc())
            .limit(10)
        )
        result = await session.execute(stmt)
        orders = result.scalars().unique().all()
        if not orders:
            return _dump({"orders": [], "message": "Bu müşteriye ait sipariş yok."})
        return _dump({
            "orders": [
                {
                    "order_number": o.order_number,
                    "status": o.status.value if o.status else None,
                    "total_try": float(o.total_amount),
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "shipment_status": (
                        o.shipment.status.value if o.shipment and o.shipment.status else None
                    ),
                    "tracking_number": o.shipment.tracking_number if o.shipment else None,
                    "carrier": o.shipment.carrier if o.shipment else None,
                }
                for o in orders
            ]
        })

    return StructuredTool.from_function(
        coroutine=_run,
        name="list_customer_orders",
        description="Müşterinin son 10 siparişini listele (durumu + kargo bilgisi ile).",
        args_schema=ListCustomerOrdersArgs,
    )


# ─────────────────────────────────────────────────────────── factories


def build_product_tools(session: AsyncSession) -> list[StructuredTool]:
    return [
        _make_search_products(session),
        _make_get_product_details(session),
        _make_list_low_stock_products(session),
    ]


def build_order_tools(session: AsyncSession) -> list[StructuredTool]:
    return [
        _make_lookup_customer_by_phone(session),
        _make_list_customer_orders(session),
        _make_get_order_status(session),
    ]
