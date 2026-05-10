"""AI agent prompt — per-agent customizable system prompts."""

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AiAgentPrompt(Base, TimestampMixin):
    """
    One row per agent (supervisor, greeting, product_info, order, escalation).
    Admins can edit the prompt in the panel; the agent service reads from here
    and falls back to the hardcoded default if no row exists.
    """

    __tablename__ = "ai_agent_prompts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    agent_key: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<AiAgentPrompt key={self.agent_key} enabled={self.enabled}>"
