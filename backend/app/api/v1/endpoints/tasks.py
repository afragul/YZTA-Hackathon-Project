"""Task API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import CurrentUser, DBSession
from app.models.task import TaskStatus
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.task_service import TaskService
from app.agents.operation_tools import run_operations_agent

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_task_service(session: DBSession) -> TaskService:
    return TaskService(session)


TaskServiceDep = Annotated[TaskService, Depends(get_task_service)]


@router.get("", response_model=list[TaskRead], summary="List tasks")
async def list_tasks(
    _: CurrentUser,
    service: TaskServiceDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    assignee_id: int | None = None,
    status_filter: TaskStatus | None = Query(None, alias="status"),
) -> list[TaskRead]:
    tasks = await service.list(skip=skip, limit=limit, assignee_id=assignee_id, status=status_filter)
    return [TaskRead.model_validate(t) for t in tasks]


@router.post("/run-ai-workflow", status_code=status.HTTP_200_OK, summary="Trigger AI Operations Agent")
async def trigger_ai_workflow(_: CurrentUser, service: TaskServiceDep, session: DBSession) -> dict:
    from app.services.order_service import OrderService
    from app.models.order import OrderStatus
    order_service = OrderService(session)
    pending_orders = await order_service.list(status=OrderStatus.PENDING, limit=50)
    
    if not pending_orders:
        return {"status": "success", "message": "Bekleyen sipariş yok.", "ai_summary": ""}
    
    orders_text = ""
    for i, order in enumerate(pending_orders, 1):
        items_text = ", ".join([f"{item.quantity}x {item.product.name}" for item in order.items])
        orders_text += f"{i}. Sipariş #{order.order_number}: {items_text} -> Müşteri ID: {order.customer_id}\n"
    
    result = await run_operations_agent(task_service=service, pending_orders_data=orders_text)
    return {"status": "success", "message": "AI iş akışını tamamladı.", "ai_summary": result["ai_report"]}


@router.get("/{task_id}", response_model=TaskRead, summary="Get task by ID")
async def get_task(task_id: int, _: CurrentUser, service: TaskServiceDep) -> TaskRead:
    task = await service.get_by_id(task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskRead.model_validate(task)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED, summary="Create task")
async def create_task(payload: TaskCreate, _: CurrentUser, service: TaskServiceDep) -> TaskRead:
    task = await service.create(payload)
    return TaskRead.model_validate(task)


@router.patch("/{task_id}", response_model=TaskRead, summary="Update task")
async def update_task(task_id: int, payload: TaskUpdate, _: CurrentUser, service: TaskServiceDep) -> TaskRead:
    task = await service.get_by_id(task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    updated = await service.update(task, payload)
    return TaskRead.model_validate(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete task")
async def delete_task(task_id: int, _: CurrentUser, service: TaskServiceDep) -> None:
    task = await service.get_by_id(task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await service.delete(task)
