"""AI agent prompts admin endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import CurrentUser, DBSession
from app.schemas.agent import AgentPromptRead, AgentPromptUpdate
from app.services.agent_service import AgentService


router = APIRouter(prefix="/integrations/ai/agents", tags=["integrations:ai-agents"])


def get_agent_service(session: DBSession) -> AgentService:
    return AgentService(session)


AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]


@router.get(
    "",
    response_model=list[AgentPromptRead],
    summary="List all AI agents with their prompts",
)
async def list_agents(
    _: CurrentUser,
    service: AgentServiceDep,
) -> list[AgentPromptRead]:
    rows = await service.list_prompts()
    return [AgentPromptRead.model_validate(r) for r in rows]


@router.patch(
    "/{agent_key}",
    response_model=AgentPromptRead,
    summary="Update an agent's prompt",
)
async def update_agent_prompt(
    agent_key: str,
    payload: AgentPromptUpdate,
    _: CurrentUser,
    service: AgentServiceDep,
) -> AgentPromptRead:
    try:
        row = await service.update_prompt(
            agent_key=agent_key,
            prompt=payload.prompt,
            enabled=payload.enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return AgentPromptRead.model_validate(row)
