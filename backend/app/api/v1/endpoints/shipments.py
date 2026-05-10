"""Shipment API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.models.shipment import ShipmentStatus
from app.schemas.shipment import ShipmentCreate, ShipmentRead, ShipmentUpdate
from app.services.shipment_service import ShipmentService

router = APIRouter(prefix="/shipments", tags=["shipments"])


def get_shipment_service(session: DBSession) -> ShipmentService:
    return ShipmentService(session)


ShipmentServiceDep = Annotated[ShipmentService, Depends(get_shipment_service)]


@router.get(
    "",
    response_model=list[ShipmentRead],
    summary="List shipments",
)
async def list_shipments(
    _: CurrentUser,
    service: ShipmentServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: ShipmentStatus | None = Query(None, alias="status"),
) -> list[ShipmentRead]:
    shipments = await service.list(skip=skip, limit=limit, status=status_filter)
    return [ShipmentRead.model_validate(s) for s in shipments]


@router.get(
    "/{shipment_id}",
    response_model=ShipmentRead,
    summary="Get shipment by ID",
)
async def get_shipment(
    shipment_id: int,
    _: CurrentUser,
    service: ShipmentServiceDep,
) -> ShipmentRead:
    shipment = await service.get_by_id(shipment_id)
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return ShipmentRead.model_validate(shipment)


@router.get(
    "/by-order/{order_id}",
    response_model=ShipmentRead,
    summary="Get shipment by order ID",
)
async def get_shipment_by_order(
    order_id: int,
    _: CurrentUser,
    service: ShipmentServiceDep,
) -> ShipmentRead:
    shipment = await service.get_by_order_id(order_id)
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    return ShipmentRead.model_validate(shipment)


@router.post(
    "",
    response_model=ShipmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create shipment for an order",
)
async def create_shipment(
    payload: ShipmentCreate,
    _: CurrentUser,
    service: ShipmentServiceDep,
) -> ShipmentRead:
    shipment = await service.create(payload)
    return ShipmentRead.model_validate(shipment)


@router.patch(
    "/{shipment_id}",
    response_model=ShipmentRead,
    summary="Update shipment",
)
async def update_shipment(
    shipment_id: int,
    payload: ShipmentUpdate,
    _: CurrentUser,
    service: ShipmentServiceDep,
) -> ShipmentRead:
    shipment = await service.get_by_id(shipment_id)
    if shipment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shipment not found")
    updated = await service.update(shipment, payload)
    return ShipmentRead.model_validate(updated)


@router.post(
    "/detect-delayed",
    response_model=list[ShipmentRead],
    summary="Detect and mark delayed shipments",
)
async def detect_delayed_shipments(
    _: CurrentUser,
    service: ShipmentServiceDep,
) -> list[ShipmentRead]:
    delayed = await service.detect_delayed_shipments()
    return [ShipmentRead.model_validate(s) for s in delayed]
