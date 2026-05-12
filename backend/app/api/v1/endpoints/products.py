"""Product & Stock Movement API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.product import (
    ProductCreate,
    ProductDataCheckResult,
    ProductRead,
    ProductUpdate,
)
from app.schemas.stock_movement import StockMovementCreate, StockMovementRead
from app.services.product_data_check_service import ProductDataCheckService
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


def get_product_service(session: DBSession) -> ProductService:
    return ProductService(session)


ProductServiceDep = Annotated[ProductService, Depends(get_product_service)]


def get_product_data_check_service(session: DBSession) -> ProductDataCheckService:
    return ProductDataCheckService(session)


ProductDataCheckServiceDep = Annotated[
    ProductDataCheckService, Depends(get_product_data_check_service)
]


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
    "/{product_id}/ai-data-check",
    response_model=ProductDataCheckResult,
    summary="Analyze product data readiness with AI",
)
async def analyze_product_data_readiness(
    product_id: int,
    _: CurrentUser,
    service: ProductServiceDep,
    checker: ProductDataCheckServiceDep,
) -> ProductDataCheckResult:
    product = await service.get_by_id(product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return await checker.analyze(product)


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
