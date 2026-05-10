"""Customer API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/customers", tags=["customers"])


def get_customer_service(session: DBSession) -> CustomerService:
    return CustomerService(session)


CustomerServiceDep = Annotated[CustomerService, Depends(get_customer_service)]


@router.get(
    "",
    response_model=list[CustomerRead],
    summary="List customers",
)
async def list_customers(
    _: CurrentUser,
    service: CustomerServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = None,
) -> list[CustomerRead]:
    customers = await service.list(skip=skip, limit=limit, search=search)
    return [CustomerRead.model_validate(c) for c in customers]


@router.get(
    "/{customer_id}",
    response_model=CustomerRead,
    summary="Get customer by ID",
)
async def get_customer(
    customer_id: int,
    _: CurrentUser,
    service: CustomerServiceDep,
) -> CustomerRead:
    customer = await service.get_by_id(customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return CustomerRead.model_validate(customer)


@router.post(
    "",
    response_model=CustomerRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create customer",
)
async def create_customer(
    payload: CustomerCreate,
    _: CurrentUser,
    service: CustomerServiceDep,
) -> CustomerRead:
    customer = await service.create(payload)
    return CustomerRead.model_validate(customer)


@router.patch(
    "/{customer_id}",
    response_model=CustomerRead,
    summary="Update customer",
)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    _: CurrentUser,
    service: CustomerServiceDep,
) -> CustomerRead:
    customer = await service.get_by_id(customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    updated = await service.update(customer, payload)
    return CustomerRead.model_validate(updated)


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete customer",
)
async def delete_customer(
    customer_id: int,
    _: CurrentUser,
    service: CustomerServiceDep,
) -> None:
    customer = await service.get_by_id(customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    await service.delete(customer)
