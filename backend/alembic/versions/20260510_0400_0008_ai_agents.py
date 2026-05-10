"""ai agents support

Revision ID: 0008_ai_agents
Revises: 0007_whatsapp_domain
Create Date: 2026-05-10 04:00:00

Adds:
  - whatsapp_conversations.ai_enabled (toggle AI per conversation)
  - whatsapp_chat_messages.is_ai_generated (mark messages produced by agents)
  - ai_agent_prompts (per-agent customizable system prompt)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_ai_agents"
down_revision: Union[str, None] = "0007_whatsapp_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- per-conversation AI toggle ---
    op.add_column(
        "whatsapp_conversations",
        sa.Column(
            "ai_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    # --- mark which messages are AI-generated ---
    op.add_column(
        "whatsapp_chat_messages",
        sa.Column(
            "is_ai_generated",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    # --- ai_agent_prompts ---
    op.create_table(
        "ai_agent_prompts",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("agent_key", sa.String(50), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_ai_agent_prompts_id", "ai_agent_prompts", ["id"])
    op.create_index(
        "ix_ai_agent_prompts_agent_key", "ai_agent_prompts", ["agent_key"], unique=True
    )


def downgrade() -> None:
    op.drop_table("ai_agent_prompts")
    op.drop_column("whatsapp_chat_messages", "is_ai_generated")
    op.drop_column("whatsapp_conversations", "ai_enabled")
