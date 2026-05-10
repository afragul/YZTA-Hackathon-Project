"""Order API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.models.order import OrderStatus
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


def get_order_service(session: DBSession) -> OrderService:
    return OrderService(session)


OrderServiceDep = Annotated[OrderService, Depends(get_order_service)]


@router.get(
    "",
    response_model=list[OrderRead],
    summary="List orders",
)
async def list_orders(
    _: CurrentUser,
    service: OrderServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    customer_id: int | None = None,
    status_filter: OrderStatus | None = Query(None, alias="status"),
    today_only: bool = False,
) -> list[OrderRead]:
    orders = await service.list(
        skip=skip, limit=limit, customer_id=customer_id, status=status_filter, today_only=today_only
    )
    return [OrderRead.model_validate(o) for o in orders]


@router.get(
    "/{order_id}",
    response_model=OrderRead,
    summary="Get order by ID",
)
async def get_order(
    order_id: int,
    _: CurrentUser,
    service: OrderServiceDep,
) -> OrderRead:
    order = await service.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderRead.model_validate(order)


@router.get(
    "/by-number/{order_number}",
    response_model=OrderRead,
    summary="Get order by order number",
)
async def get_order_by_number(
    order_number: str,
    _: CurrentUser,
    service: OrderServiceDep,
) -> OrderRead:
    order = await service.get_by_order_number(order_number)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderRead.model_validate(order)


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create order",
)
async def create_order(
    payload: OrderCreate,
    _: CurrentUser,
    service: OrderServiceDep,
) -> OrderRead:
    try:
        order = await service.create(payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OrderRead.model_validate(order)


@router.patch(
    "/{order_id}",
    response_model=OrderRead,
    summary="Update order status",
)
async def update_order(
    order_id: int,
    payload: OrderUpdate,
    _: CurrentUser,
    service: OrderServiceDep,
) -> OrderRead:
    order = await service.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    updated = await service.update_status(order, payload)
    return OrderRead.model_validate(updated)


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete order",
)
async def delete_order(
    order_id: int,
    _: CurrentUser,
    service: OrderServiceDep,
) -> None:
    order = await service.get_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    await service.delete(order)
