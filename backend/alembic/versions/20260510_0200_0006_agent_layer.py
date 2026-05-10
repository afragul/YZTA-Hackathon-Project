"""agent layer

Revision ID: 0006_agent_layer
Revises: 0005_core_domain
Create Date: 2026-05-10 02:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0006_agent_layer"
down_revision: Union[str, None] = "0005_core_domain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CONVERSATION_CHANNEL = postgresql.ENUM(
    "whatsapp", "email", "web", "telegram",
    name="conversation_channel", create_type=False,
)
AGENT_CONVERSATION_STATUS = postgresql.ENUM(
    "open", "handled_by_ai", "escalated", "closed",
    name="agent_conversation_status", create_type=False,
)
MESSAGE_ROLE = postgresql.ENUM(
    "user", "assistant", "tool", "system",
    name="message_role", create_type=False,
)
AGENT_MESSAGE_DIRECTION = postgresql.ENUM(
    "inbound", "outbound",
    name="agent_message_direction", create_type=False,
)
AGENT_MESSAGE_TYPE = postgresql.ENUM(
    "text", "image", "audio", "video", "document", "location",
    "sticker", "template", "interactive", "tool_call",
    name="agent_message_type", create_type=False,
)
MESSAGE_PROVIDER = postgresql.ENUM(
    "whatsapp", "email", "web", "telegram", "internal",
    name="message_provider", create_type=False,
)
AGENT_MESSAGE_STATUS = postgresql.ENUM(
    "queued", "sent", "delivered", "read", "failed",
    name="agent_message_status", create_type=False,
)


def upgrade() -> None:
    # --- Create enum types via raw SQL ---
    op.execute("CREATE TYPE conversation_channel AS ENUM ('whatsapp','email','web','telegram')")
    op.execute("CREATE TYPE agent_conversation_status AS ENUM ('open','handled_by_ai','escalated','closed')")
    op.execute("CREATE TYPE message_role AS ENUM ('user','assistant','tool','system')")
    op.execute("CREATE TYPE agent_message_direction AS ENUM ('inbound','outbound')")
    op.execute("CREATE TYPE agent_message_type AS ENUM ('text','image','audio','video','document','location','sticker','template','interactive','tool_call')")
    op.execute("CREATE TYPE message_provider AS ENUM ('whatsapp','email','web','telegram','internal')")
    op.execute("CREATE TYPE agent_message_status AS ENUM ('queued','sent','delivered','read','failed')")

    # --- agent_conversations ---
    op.create_table(
        "agent_conversations",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("customer_id", sa.BigInteger(), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel", CONVERSATION_CHANNEL, nullable=False),
        sa.Column("external_thread_id", sa.String(128), nullable=True),
        sa.Column("wa_phone_number_id", sa.String(64), nullable=True),
        sa.Column("status", AGENT_CONVERSATION_STATUS, nullable=False, server_default="open"),
        sa.Column("handled_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_inbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("unread_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_agent_conversations_id", "agent_conversations", ["id"])
    op.create_index("ix_agent_conversations_customer_last_msg", "agent_conversations", ["customer_id", "last_message_at"])
    op.create_index("uq_agent_conversations_channel_thread", "agent_conversations", ["channel", "external_thread_id"], unique=True)
    op.create_index("ix_agent_conversations_status_last_msg", "agent_conversations", ["status", "last_message_at"])

    # --- agent_messages ---
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("conversation_id", sa.BigInteger(), sa.ForeignKey("agent_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", AGENT_MESSAGE_DIRECTION, nullable=False),
        sa.Column("role", MESSAGE_ROLE, nullable=False),
        sa.Column("message_type", AGENT_MESSAGE_TYPE, nullable=False, server_default="text"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("provider", MESSAGE_PROVIDER, nullable=False),
        sa.Column("provider_message_id", sa.String(128), nullable=True),
        sa.Column("reply_to_message_id", sa.BigInteger(), sa.ForeignKey("agent_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("wa_template_id", sa.BigInteger(), nullable=True),  # FK added in next migration
        sa.Column("wa_interactive_payload", JSONB(), nullable=True),
        sa.Column("status", AGENT_MESSAGE_STATUS, nullable=False, server_default="queued"),
        sa.Column("error_code", sa.String(40), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("tool_name", sa.String(80), nullable=True),
        sa.Column("tool_payload", JSONB(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_agent_messages_id", "agent_messages", ["id"])
    op.create_index("ix_agent_messages_conv_created", "agent_messages", ["conversation_id", "created_at"])
    op.create_index("ix_agent_messages_provider_msg_id", "agent_messages", ["provider_message_id"], unique=True)
    op.create_index("ix_agent_messages_status_created", "agent_messages", ["status", "created_at"])


def downgrade() -> None:
    op.drop_table("agent_messages")
    op.drop_table("agent_conversations")

    op.execute("DROP TYPE IF EXISTS agent_message_status")
    op.execute("DROP TYPE IF EXISTS message_provider")
    op.execute("DROP TYPE IF EXISTS agent_message_type")
    op.execute("DROP TYPE IF EXISTS agent_message_direction")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS agent_conversation_status")
    op.execute("DROP TYPE IF EXISTS conversation_channel")
