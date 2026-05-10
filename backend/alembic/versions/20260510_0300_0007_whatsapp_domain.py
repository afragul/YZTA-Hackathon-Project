"""whatsapp domain

Revision ID: 0007_whatsapp_domain
Revises: 0006_agent_layer
Create Date: 2026-05-10 03:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0007_whatsapp_domain"
down_revision: Union[str, None] = "0006_agent_layer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MEDIA_DOWNLOAD_STATUS = postgresql.ENUM(
    "pending", "downloaded", "failed",
    name="media_download_status", create_type=False,
)
TEMPLATE_CATEGORY = postgresql.ENUM(
    "marketing", "utility", "authentication",
    name="template_category", create_type=False,
)
TEMPLATE_STATUS = postgresql.ENUM(
    "pending", "approved", "rejected", "paused",
    name="template_status", create_type=False,
)
WA_EVENT_TYPE = postgresql.ENUM(
    "message", "status", "error", "unknown",
    name="wa_event_type", create_type=False,
)


def upgrade() -> None:
    # --- Create enum types via raw SQL ---
    op.execute("CREATE TYPE media_download_status AS ENUM ('pending','downloaded','failed')")
    op.execute("CREATE TYPE template_category AS ENUM ('marketing','utility','authentication')")
    op.execute("CREATE TYPE template_status AS ENUM ('pending','approved','rejected','paused')")
    op.execute("CREATE TYPE wa_event_type AS ENUM ('message','status','error','unknown')")

    # --- whatsapp_templates ---
    op.create_table(
        "whatsapp_templates",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("language", sa.String(10), nullable=False),
        sa.Column("category", TEMPLATE_CATEGORY, nullable=False),
        sa.Column("status", TEMPLATE_STATUS, nullable=False, server_default="pending"),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("variables_schema", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_whatsapp_templates_id", "whatsapp_templates", ["id"])
    op.create_unique_constraint("uq_whatsapp_templates_name_lang", "whatsapp_templates", ["name", "language"])

    # --- Add FK from agent_messages.wa_template_id to whatsapp_templates ---
    op.create_foreign_key(
        "fk_agent_messages_wa_template_id",
        "agent_messages",
        "whatsapp_templates",
        ["wa_template_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- whatsapp_media ---
    op.create_table(
        "whatsapp_media",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("message_id", sa.BigInteger(), sa.ForeignKey("agent_messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wa_media_id", sa.String(128), nullable=True),
        sa.Column("mime_type", sa.String(80), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("storage_key", sa.String(512), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("download_status", MEDIA_DOWNLOAD_STATUS, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_whatsapp_media_id", "whatsapp_media", ["id"])
    op.create_index("ix_whatsapp_media_message_id", "whatsapp_media", ["message_id"])
    op.create_index("ix_whatsapp_media_wa_media_id", "whatsapp_media", ["wa_media_id"])

    # --- whatsapp_webhook_events ---
    op.create_table(
        "whatsapp_webhook_events",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("event_type", WA_EVENT_TYPE, nullable=False),
        sa.Column("wa_phone_number_id", sa.String(64), nullable=True),
        sa.Column("wa_message_id", sa.String(128), nullable=True),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("signature", sa.String(256), nullable=True),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_whatsapp_webhook_events_id", "whatsapp_webhook_events", ["id"])
    op.create_index("ix_wa_webhook_events_message_id", "whatsapp_webhook_events", ["wa_message_id"])
    op.create_index("ix_wa_webhook_events_processed_received", "whatsapp_webhook_events", ["processed", "received_at"])
    op.create_index("ix_wa_webhook_events_type_received", "whatsapp_webhook_events", ["event_type", "received_at"])


def downgrade() -> None:
    op.drop_table("whatsapp_webhook_events")
    op.drop_table("whatsapp_media")

    op.drop_constraint("fk_agent_messages_wa_template_id", "agent_messages", type_="foreignkey")
    op.drop_table("whatsapp_templates")

    op.execute("DROP TYPE IF EXISTS wa_event_type")
    op.execute("DROP TYPE IF EXISTS template_status")
    op.execute("DROP TYPE IF EXISTS template_category")
    op.execute("DROP TYPE IF EXISTS media_download_status")
