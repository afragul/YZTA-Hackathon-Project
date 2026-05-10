"""Pydantic schemas for Task CRUD."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskPriority, TaskStatus, TaskType


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    task_type: TaskType = TaskType.GENERAL
    priority: TaskPriority = TaskPriority.NORMAL
    assignee_id: int | None = None
    related_order_id: int | None = None
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    task_type: TaskType | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    assignee_id: int | None = None
    related_order_id: int | None = None
    due_at: datetime | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    task_type: TaskType
    status: TaskStatus
    priority: TaskPriority
    assignee_id: int | None
    related_order_id: int | None
    due_at: datetime | None
    created_at: datetime
    updated_at: datetime
