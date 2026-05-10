"""
AI provider integration endpoints (LangChain backend).

Frontend modal flow (Settings → Integrations → AI Provider → Bağla):
  1. POST /integrations/ai          — submit provider+model+api_key, persist encrypted.
  2. POST /integrations/ai/{id}/test — ping the provider, mark CONNECTED.
  3. GET  /integrations/ai          — list configured providers.
  4. GET  /integrations/ai/models?provider=google — list models (dynamic + static).
  5. PATCH /integrations/ai/{id}    — rotate key / change model.
  6. DELETE /integrations/ai/{id}   — disconnect.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import CurrentUser, DBSession, require_admin
from app.models.ai_provider import AiProviderCode
from app.models.user import User
from app.schemas.ai_provider import (
    AiModelListResult,
    AiProviderCreate,
    AiProviderRead,
    AiProviderTestResult,
    AiProviderUpdate,
)
from app.services.ai_service import AiService


router = APIRouter(prefix="/integrations/ai", tags=["integrations:ai"])


def get_ai_service(session: DBSession) -> AiService:
    return AiService(session)


AiServiceDep = Annotated[AiService, Depends(get_ai_service)]
AdminUser = Annotated[User, Depends(require_admin)]


# ----------------------------------------------------------------- public read


@router.get(
    "",
    response_model=list[AiProviderRead],
    summary="List configured AI providers",
)
async def list_providers(
    _: CurrentUser,
    service: AiServiceDep,
) -> list[AiProviderRead]:
    rows = await service.list_all()
    return [AiProviderRead.model_validate(r) for r in rows]


@router.get(
    "/models",
    response_model=AiModelListResult,
    summary="List available models for a provider",
)
async def list_models(
    _: CurrentUser,
    service: AiServiceDep,
    provider: AiProviderCode = Query(...),
) -> AiModelListResult:
    return await service.list_models(provider)


# ------------------------------------------------------------- create / update


@router.post(
    "",
    response_model=AiProviderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Connect an AI provider (creates or replaces the row)",
)
async def upsert_provider(
    payload: AiProviderCreate,
    current_user: AdminUser,
    service: AiServiceDep,
) -> AiProviderRead:
    row = await service.upsert(payload, current_user)
    # Auto-test so the modal can show a concrete result.
    await service.test_provider(row)
    refreshed = await service.get_by_id(row.id)
    return AiProviderRead.model_validate(refreshed)


@router.patch(
    "/{provider_id}",
    response_model=AiProviderRead,
    summary="Update provider config (key rotation / model change)",
)
async def update_provider(
    provider_id: int,
    payload: AiProviderUpdate,
    _: AdminUser,
    service: AiServiceDep,
) -> AiProviderRead:
    row = await service.get_by_id(provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    updated = await service.update(row, payload)
    return AiProviderRead.model_validate(updated)


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Disconnect a provider",
)
async def disconnect_provider(
    provider_id: int,
    _: AdminUser,
    service: AiServiceDep,
) -> Response:
    row = await service.get_by_id(provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    await service.disconnect(row)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ----------------------------------------------------------------- test


@router.post(
    "/{provider_id}/test",
    response_model=AiProviderTestResult,
    summary="Ping the provider with a tiny prompt to verify the key + model",
)
async def test_provider(
    provider_id: int,
    _: AdminUser,
    service: AiServiceDep,
) -> AiProviderTestResult:
    row = await service.get_by_id(provider_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return await service.test_provider(row)
