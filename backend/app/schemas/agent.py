"""Pydantic schemas for AI agent prompts and toggle."""

from pydantic import BaseModel, ConfigDict, Field


class AgentPromptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    name: str
    description: str | None = None
    prompt: str
    enabled: bool = True
    tools: list[str] = []
    is_custom: bool = False


class AgentPromptUpdate(BaseModel):
    prompt: str = Field(min_length=10, max_length=20_000)
    enabled: bool | None = None


class ConversationAiToggle(BaseModel):
    ai_enabled: bool
