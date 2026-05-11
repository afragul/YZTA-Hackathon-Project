"""email providers (Brevo)

Revision ID: 0009_email_providers
Revises: 0008_ai_agents
Create Date: 2026-05-11 00:00:00

Adds:
  - email_providers table for Brevo transactional email integration
  - email_provider_code enum
  - email_provider_status enum
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_email_providers"
down_revision: Union[str, None] = "0008_ai_agents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_providers",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("brevo", name="email_provider_code"),
            nullable=False,
        ),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("sender_name", sa.String(length=120), nullable=False),
        sa.Column("sender_email", sa.String(length=255), nullable=False),
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
                name="email_provider_status",
            ),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("connected_by_user_id", sa.BigInteger(), nullable=True),
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
            ["connected_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", name="uq_email_providers_provider"),
    )
    op.create_index("ix_email_providers_id", "email_providers", ["id"])
    op.create_index(
        "ix_email_providers_provider", "email_providers", ["provider"]
    )
    op.create_index(
        "ix_email_providers_status", "email_providers", ["status"]
    )


def downgrade() -> None:
    op.drop_index("ix_email_providers_status", table_name="email_providers")
    op.drop_index("ix_email_providers_provider", table_name="email_providers")
    op.drop_index("ix_email_providers_id", table_name="email_providers")
    op.drop_table("email_providers")
    sa.Enum(name="email_provider_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="email_provider_code").drop(op.get_bind(), checkfirst=True)
