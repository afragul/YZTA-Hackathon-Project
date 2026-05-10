"""ai providers integration

Revision ID: 0003_ai_providers
Revises: 0002_whatsapp_account
Create Date: 2026-05-10 00:00:02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_ai_providers"
down_revision: Union[str, None] = "0002_whatsapp_account"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("google", "openai", "anthropic", name="ai_provider_code"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column(
            "max_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("2048"),
        ),
        sa.Column("api_key_ciphertext", sa.Text(), nullable=False),
        sa.Column("api_key_last4", sa.String(length=4), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "connected",
                "disconnected",
                "error",
                name="ai_provider_status",
            ),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("connected_by_user_id", sa.BigInteger(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["connected_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", name="uq_ai_providers_provider"),
    )
    op.create_index("ix_ai_providers_id", "ai_providers", ["id"])
    op.create_index(
        "ix_ai_providers_provider", "ai_providers", ["provider"]
    )
    op.create_index("ix_ai_providers_status", "ai_providers", ["status"])


def downgrade() -> None:
    op.drop_index("ix_ai_providers_status", table_name="ai_providers")
    op.drop_index("ix_ai_providers_provider", table_name="ai_providers")
    op.drop_index("ix_ai_providers_id", table_name="ai_providers")
    op.drop_table("ai_providers")
    sa.Enum(name="ai_provider_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="ai_provider_code").drop(op.get_bind(), checkfirst=True)
