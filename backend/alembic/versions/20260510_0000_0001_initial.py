"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-10 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("avatar_key", sa.String(length=512), nullable=True),
        sa.Column(
            "role",
            sa.Enum("admin", "user", name="user_role"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "token_blocklist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_token_blocklist_id", "token_blocklist", ["id"])
    op.create_index(
        "ix_token_blocklist_jti", "token_blocklist", ["jti"], unique=True
    )
    op.create_index("ix_token_blocklist_user_id", "token_blocklist", ["user_id"])
    op.create_index(
        "ix_token_blocklist_expires_at", "token_blocklist", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_token_blocklist_expires_at", table_name="token_blocklist")
    op.drop_index("ix_token_blocklist_user_id", table_name="token_blocklist")
    op.drop_index("ix_token_blocklist_jti", table_name="token_blocklist")
    op.drop_index("ix_token_blocklist_id", table_name="token_blocklist")
    op.drop_table("token_blocklist")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
