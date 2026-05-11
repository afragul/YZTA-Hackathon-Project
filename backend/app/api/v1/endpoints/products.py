"""Product & Stock Movement API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.schemas.stock_movement import StockMovementCreate, StockMovementRead
from app.services.product_service import ProductService
from app.services.analytics_agent_service import AnalyticsAgentService

router = APIRouter(prefix="/products", tags=["products"])


def get_product_service(session: DBSession) -> ProductService:
    return ProductService(session)


ProductServiceDep = Annotated[ProductService, Depends(get_product_service)]


@router.get(
    "",
    response_model=list[ProductRead],
    summary="List products",
)
async def list_products(
    _: CurrentUser,
    service: ProductServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = None,
    category: str | None = None,
    active_only: bool = True,
) -> list[ProductRead]:
    products = await service.list(
        skip=skip, limit=limit, search=search, category=category, active_only=active_only
    )
    return [ProductRead.model_validate(p) for p in products]


@router.get(
    "/low-stock",
    response_model=list[ProductRead],
    summary="Get products below stock threshold",
)
async def get_low_stock_products(
    _: CurrentUser,
    service: ProductServiceDep,
) -> list[ProductRead]:
    products = await service.get_low_stock_products()
    return [ProductRead.model_validate(p) for p in products]

@router.get(
    "/ai-stock-suggestions",
    summary="Get AI stock order suggestions for low stock products",
)
async def get_ai_stock_suggestions(
    _: CurrentUser,
    service: ProductServiceDep,
    session: DBSession,
) -> list[dict]:
    products = await service.get_low_stock_products()
    analytics_agent = AnalyticsAgentService(session)

    demo_sales_data = {
        "PEK-DUT-500G": {
            "daily_average_sales": 5,
            "lead_time_days": 2,
            "supplier_name": "Anadolu Doğal Tedarik",
            "supplier_email": "tedarik@anadoludogal.com",
        },
        "PEY-CECIL-300G": {
            "daily_average_sales": 4,
            "lead_time_days": 3,
            "supplier_name": "Kars Yöresel Ürünler",
            "supplier_email": "siparis@karsyoresel.com",
        },
    }

    suggestions = []

    for product in products:
        stock = float(product.stock or 0)
        low_stock_threshold = float(product.low_stock_threshold or 0)

        defaults = {
            "daily_average_sales": max(1, round(low_stock_threshold / 2)),
            "lead_time_days": 2,
            "supplier_name": "Varsayılan Tedarikçi",
            "supplier_email": "tedarikci@example.com",
        }

        analytics_data = demo_sales_data.get(product.sku, defaults)

        daily_average_sales = analytics_data["daily_average_sales"]
        lead_time_days = analytics_data["lead_time_days"]

        suggested_order_quantity = (
            daily_average_sales * 7
        ) + (
            daily_average_sales * lead_time_days
        )

        days_until_out_of_stock = (
            round(stock / daily_average_sales)
            if daily_average_sales > 0
            else 0
        )

        agent_payload = {
            "product_name": product.name,
            "sku": product.sku,
            "current_stock": int(stock),
            "daily_average_sales": daily_average_sales,
            "lead_time_days": lead_time_days,
            "days_until_out_of_stock": days_until_out_of_stock,
            "suggested_order_quantity": suggested_order_quantity,
            "supplier_name": analytics_data["supplier_name"],
            "supplier_email": analytics_data["supplier_email"],
        }

        ai_result = await analytics_agent.generate_stock_suggestion_texts(agent_payload)

        suggestions.append(
            {
                "product_id": product.id,
                "sku": product.sku,
                "product_name": product.name,
                "category": product.category,
                "current_stock": int(stock),
                "low_stock_threshold": int(low_stock_threshold),
                "daily_average_sales": daily_average_sales,
                "lead_time_days": lead_time_days,
                "days_until_out_of_stock": days_until_out_of_stock,
                "suggested_order_quantity": suggested_order_quantity,
                "supplier_name": analytics_data["supplier_name"],
                "supplier_email": analytics_data["supplier_email"],
                "ai_message": ai_result["ai_message"],
                "mail_subject": ai_result["mail_subject"],
                "mail_draft": ai_result["mail_draft"],
            }
        )

    return suggestions


@router.get(
    "/{product_id}",
    response_model=ProductRead,
    summary="Get product by ID",
)
async def get_product(
    product_id: int,
    _: CurrentUser,
    service: ProductServiceDep,
) -> ProductRead:
    product = await service.get_by_id(product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductRead.model_validate(product)


@router.post(
    "",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create product",
)
async def create_product(
    payload: ProductCreate,
    _: CurrentUser,
    service: ProductServiceDep,
) -> ProductRead:
    product = await service.create(payload)
    return ProductRead.model_validate(product)


@router.patch(
    "/{product_id}",
    response_model=ProductRead,
    summary="Update product",
)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    _: CurrentUser,
    service: ProductServiceDep,
) -> ProductRead:
    product = await service.get_by_id(product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    updated = await service.update(product, payload)
    return ProductRead.model_validate(updated)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete product",
)
async def delete_product(
    product_id: int,
    _: CurrentUser,
    service: ProductServiceDep,
) -> None:
    product = await service.get_by_id(product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    await service.delete(product)


# --- Stock Movements ---


@router.get(
    "/{product_id}/stock-movements",
    response_model=list[StockMovementRead],
    summary="List stock movements for a product",
)
async def list_stock_movements(
    product_id: int,
    _: CurrentUser,
    service: ProductServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> list[StockMovementRead]:
    movements = await service.list_movements(product_id, skip=skip, limit=limit)
    return [StockMovementRead.model_validate(m) for m in movements]


@router.post(
    "/{product_id}/stock-movements",
    response_model=StockMovementRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a stock movement",
)
async def create_stock_movement(
    product_id: int,
    payload: StockMovementCreate,
    _: CurrentUser,
    service: ProductServiceDep,
) -> StockMovementRead:
    if payload.product_id != product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="product_id in path and body must match",
        )
    try:
        movement = await service.record_stock_movement(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return StockMovementRead.model_validate(movement)
