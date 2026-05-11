"""Dashboard stats endpoint — real-time KPIs from DB."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DBSession, require_admin
from app.core.secrets import decrypt_secret
from app.models.customer import Customer
from app.models.email_provider import EmailProvider, EmailProviderStatus
from app.models.notification import Notification
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.shipment import Shipment, ShipmentStatus
from app.models.task import Task, TaskStatus
from app.models.user import User

import httpx
import logging

logger = logging.getLogger("app.dashboard")

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

AdminUser = Annotated[User, Depends(require_admin)]


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


# ----------------------------------------------------------------- Delayed Shipments Detail


@router.get(
    "/delayed-shipments",
    summary="List delayed shipments with customer info",
    status_code=status.HTTP_200_OK,
)
async def get_delayed_shipments(
    _: CurrentUser,
    session: DBSession,
) -> list[dict]:
    """Return delayed shipments joined with order + customer data."""
    result = await session.execute(
        select(Shipment)
        .where(Shipment.status == ShipmentStatus.DELAYED)
        .options(
            joinedload(Shipment.order).joinedload(Order.customer)
        )
        .order_by(Shipment.expected_delivery)
    )
    shipments = result.scalars().unique().all()

    items = []
    for s in shipments:
        order = s.order
        customer = order.customer if order else None
        items.append({
            "shipment_id": s.id,
            "tracking_number": s.tracking_number,
            "carrier": s.carrier,
            "expected_delivery": str(s.expected_delivery) if s.expected_delivery else None,
            "last_event": s.last_event,
            "order_id": order.id if order else None,
            "order_number": order.order_number if order else None,
            "order_total": float(order.total_amount) if order else 0,
            "customer_id": customer.id if customer else None,
            "customer_name": customer.full_name if customer else None,
            "customer_email": customer.email if customer else None,
            "customer_phone": customer.phone if customer else None,
        })
    return items


# ----------------------------------------------------------------- Notify Customers


class DelayedShipmentNotifyRequest(BaseModel):
    customer_ids: list[int]
    subject: str = "Kargonuz Gecikti — Bilgilendirme"
    message: str | None = None


class DelayedShipmentNotifyResult(BaseModel):
    sent_count: int
    failed_count: int
    details: list[dict]


BREVO_API_BASE = "https://api.brevo.com/v3"


@router.post(
    "/delayed-shipments/notify",
    response_model=DelayedShipmentNotifyResult,
    summary="Send delay notification emails to customers",
    status_code=status.HTTP_200_OK,
)
async def notify_delayed_customers(
    body: DelayedShipmentNotifyRequest,
    admin: AdminUser,
    session: DBSession,
) -> DelayedShipmentNotifyResult:
    """Send email notifications to customers about their delayed shipments."""

    # Get active email provider
    provider_result = await session.execute(
        select(EmailProvider).where(
            EmailProvider.enabled.is_(True),
            EmailProvider.status == EmailProviderStatus.CONNECTED,
        ).limit(1)
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-posta sağlayıcısı yapılandırılmamış veya bağlı değil.",
        )

    api_key = decrypt_secret(provider.api_key_ciphertext)

    # Get customers with their delayed shipments
    result = await session.execute(
        select(Customer)
        .where(Customer.id.in_(body.customer_ids))
    )
    customers = list(result.scalars().all())

    if not customers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seçili müşteri bulunamadı.",
        )

    # Get delayed shipments for these customers
    shipment_result = await session.execute(
        select(Shipment)
        .join(Order, Shipment.order_id == Order.id)
        .where(
            Shipment.status == ShipmentStatus.DELAYED,
            Order.customer_id.in_(body.customer_ids),
        )
        .options(joinedload(Shipment.order))
    )
    shipments_by_customer: dict[int, list] = {}
    for s in shipment_result.scalars().unique().all():
        cid = s.order.customer_id
        shipments_by_customer.setdefault(cid, []).append(s)

    sent_count = 0
    failed_count = 0
    details = []

    async with httpx.AsyncClient(timeout=15) as client:
        for customer in customers:
            if not customer.email:
                details.append({
                    "customer_id": customer.id,
                    "customer_name": customer.full_name,
                    "status": "skipped",
                    "detail": "E-posta adresi yok.",
                })
                failed_count += 1
                continue

            # Build email content
            customer_shipments = shipments_by_customer.get(customer.id, [])
            shipment_rows = ""
            for s in customer_shipments:
                shipment_rows += (
                    f"<tr>"
                    f"<td style='padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;'>{s.order.order_number}</td>"
                    f"<td style='padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;'>{s.carrier or '-'}</td>"
                    f"<td style='padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-family:monospace;'>{s.tracking_number or '-'}</td>"
                    f"<td style='padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#dc2626;font-weight:600;'>{s.expected_delivery or '-'}</td>"
                    f"</tr>"
                )

            custom_message = body.message or (
                "Siparişinizin kargosunda bir gecikme yaşandığını bildirmek isteriz. "
                "Kargo firması ile iletişime geçilmiş olup, teslimatın en kısa sürede "
                "gerçekleştirilmesi için takip edilmektedir."
            )

            html_content = (
                f"<!DOCTYPE html>"
                f"<html><head><meta charset='utf-8'></head>"
                f"<body style='margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;'>"
                f"<table width='100%' cellpadding='0' cellspacing='0' style='background-color:#f8fafc;padding:32px 0;'>"
                f"<tr><td align='center'>"
                f"<table width='600' cellpadding='0' cellspacing='0' style='background-color:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;'>"
                # Header
                f"<tr><td style='background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px 40px;'>"
                f"<h1 style='margin:0;color:#ffffff;font-size:20px;font-weight:600;'>{provider.sender_name}</h1>"
                f"<p style='margin:8px 0 0;color:#94a3b8;font-size:13px;'>Kargo Gecikme Bildirimi</p>"
                f"</td></tr>"
                # Body
                f"<tr><td style='padding:32px 40px;'>"
                f"<p style='margin:0 0 20px;font-size:16px;color:#1e293b;'>Sayın <strong>{customer.full_name}</strong>,</p>"
                f"<p style='margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;'>{custom_message}</p>"
            )

            if shipment_rows:
                html_content += (
                    f"<table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 24px;'>"
                    f"<thead><tr style='background-color:#f8fafc;'>"
                    f"<th style='padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Sipariş</th>"
                    f"<th style='padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Kargo</th>"
                    f"<th style='padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Takip No</th>"
                    f"<th style='padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;'>Beklenen Teslim</th>"
                    f"</tr></thead><tbody>{shipment_rows}</tbody></table>"
                )

            html_content += (
                f"<div style='background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:0 0 24px;'>"
                f"<p style='margin:0;font-size:13px;color:#991b1b;'>"
                f"⚠️ Gecikme için özür dileriz. Kargonuzun durumunu takip numaranız ile kargo firmasının web sitesinden sorgulayabilirsiniz."
                f"</p></div>"
                f"<p style='margin:0;font-size:14px;color:#475569;line-height:1.6;'>"
                f"Herhangi bir sorunuz olursa bizimle iletişime geçmekten çekinmeyin.</p>"
                f"</td></tr>"
                # Footer
                f"<tr><td style='background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;'>"
                f"<p style='margin:0;font-size:12px;color:#94a3b8;'>Bu e-posta {provider.sender_name} tarafından otomatik olarak gönderilmiştir.</p>"
                f"<p style='margin:4px 0 0;font-size:12px;color:#94a3b8;'>{provider.sender_email}</p>"
                f"</td></tr>"
                f"</table></td></tr></table></body></html>"
            )

            email_body = {
                "sender": {"name": provider.sender_name, "email": provider.sender_email},
                "to": [{"email": customer.email, "name": customer.full_name}],
                "subject": body.subject,
                "htmlContent": html_content,
            }

            try:
                resp = await client.post(
                    f"{BREVO_API_BASE}/smtp/email",
                    headers={
                        "api-key": api_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=email_body,
                )
                if resp.status_code in (200, 201):
                    sent_count += 1
                    details.append({
                        "customer_id": customer.id,
                        "customer_name": customer.full_name,
                        "email": customer.email,
                        "status": "sent",
                        "detail": None,
                    })
                else:
                    err = resp.json().get("message", resp.text[:200])
                    failed_count += 1
                    details.append({
                        "customer_id": customer.id,
                        "customer_name": customer.full_name,
                        "email": customer.email,
                        "status": "failed",
                        "detail": f"Brevo hatası ({resp.status_code}): {err}",
                    })
            except Exception as exc:
                failed_count += 1
                details.append({
                    "customer_id": customer.id,
                    "customer_name": customer.full_name,
                    "email": customer.email,
                    "status": "failed",
                    "detail": str(exc)[:150],
                })

    return DelayedShipmentNotifyResult(
        sent_count=sent_count,
        failed_count=failed_count,
        details=details,
    )
