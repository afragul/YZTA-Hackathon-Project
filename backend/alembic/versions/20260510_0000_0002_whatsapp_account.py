"""whatsapp account integration

Revision ID: 0002_whatsapp_account
Revises: 0001_initial
Create Date: 2026-05-10 00:00:01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_whatsapp_account"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_accounts",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("phone_e164", sa.String(length=20), nullable=False),
        sa.Column("phone_number_id", sa.String(length=64), nullable=False),
        sa.Column("business_account_id", sa.String(length=64), nullable=False),
        sa.Column("app_id", sa.String(length=32), nullable=False),
        sa.Column(
            "api_version",
            sa.String(length=10),
            nullable=False,
            server_default=sa.text("'v21.0'"),
        ),
        sa.Column(
            "default_language",
            sa.String(length=10),
            nullable=False,
            server_default=sa.text("'tr'"),
        ),
        sa.Column("access_token_ciphertext", sa.Text(), nullable=False),
        sa.Column("access_token_last4", sa.String(length=4), nullable=False),
        sa.Column("app_secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("app_secret_last4", sa.String(length=4), nullable=False),
        sa.Column("verify_token_ciphertext", sa.Text(), nullable=False),
        sa.Column(
            "onboarding_method",
            sa.Enum(
                "manual",
                "embedded_signup",
                name="wa_onboarding_method",
            ),
            nullable=False,
            server_default=sa.text("'manual'"),
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "connected",
                "disconnected",
                "error",
                name="wa_account_status",
            ),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "is_verified_credentials",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_verified_messaging",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "webhook_subscribed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
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
    )
    op.create_index(
        "ix_whatsapp_accounts_id", "whatsapp_accounts", ["id"]
    )
    op.create_index(
        "ix_whatsapp_accounts_phone_number_id",
        "whatsapp_accounts",
        ["phone_number_id"],
        unique=True,
    )
    op.create_index(
        "ix_whatsapp_accounts_status", "whatsapp_accounts", ["status"]
    )


def downgrade() -> None:
    op.drop_index("ix_whatsapp_accounts_status", table_name="whatsapp_accounts")
    op.drop_index(
        "ix_whatsapp_accounts_phone_number_id", table_name="whatsapp_accounts"
    )
    op.drop_index("ix_whatsapp_accounts_id", table_name="whatsapp_accounts")
    op.drop_table("whatsapp_accounts")
    sa.Enum(name="wa_account_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="wa_onboarding_method").drop(op.get_bind(), checkfirst=True)
