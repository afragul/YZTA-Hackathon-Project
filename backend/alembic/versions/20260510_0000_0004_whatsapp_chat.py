"""whatsapp chat tables

Revision ID: 0004_whatsapp_chat
Revises: 0003_ai_providers
Create Date: 2026-05-10 00:00:03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0004_whatsapp_chat"
down_revision: Union[str, None] = "0003_ai_providers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_conversations",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("account_id", sa.BigInteger(), nullable=False),
        sa.Column("wa_id", sa.String(length=20), nullable=False),
        sa.Column("contact_name", sa.String(length=120), nullable=True),
        sa.Column(
            "contact_profile_pic_url", sa.String(length=1024), nullable=True
        ),
        sa.Column(
            "status",
            sa.Enum(
                "open",
                "pending",
                "closed",
                "spam",
                name="wa_conversation_status",
            ),
            server_default=sa.text("'open'"),
            nullable=False,
        ),
        sa.Column(
            "unread_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("last_message_text", sa.Text(), nullable=True),
        sa.Column(
            "last_message_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "last_message_direction",
            sa.Enum(
                "inbound", "outbound", name="wa_message_direction"
            ),
            nullable=True,
        ),
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
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
            ["account_id"],
            ["whatsapp_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_whatsapp_conversations_id", "whatsapp_conversations", ["id"]
    )
    op.create_index(
        "ix_whatsapp_conversations_account_id",
        "whatsapp_conversations",
        ["account_id"],
    )
    op.create_index(
        "ix_whatsapp_conversations_wa_id",
        "whatsapp_conversations",
        ["wa_id"],
    )
    op.create_index(
        "ix_whatsapp_conversations_status",
        "whatsapp_conversations",
        ["status"],
    )
    op.create_index(
        "ix_whatsapp_conversations_last_message_at",
        "whatsapp_conversations",
        ["last_message_at"],
    )
    op.create_index(
        "uq_whatsapp_conversation_account_wa_id",
        "whatsapp_conversations",
        ["account_id", "wa_id"],
        unique=True,
    )
    op.create_index(
        "ix_whatsapp_conversations_account_last_msg",
        "whatsapp_conversations",
        ["account_id", "last_message_at"],
    )

    op.create_table(
        "whatsapp_chat_messages",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("conversation_id", sa.BigInteger(), nullable=False),
        sa.Column("wamid", sa.String(length=128), nullable=True),
        sa.Column(
            "direction",
            sa.Enum("inbound", "outbound", name="wa_message_direction"),
            nullable=False,
        ),
        sa.Column(
            "kind",
            sa.Enum(
                "text",
                "image",
                "video",
                "audio",
                "document",
                "sticker",
                "location",
                "contacts",
                "interactive",
                "button",
                "reaction",
                "system",
                "other",
                name="wa_message_kind",
            ),
            nullable=False,
            server_default=sa.text("'text'"),
        ),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "sent",
                "delivered",
                "read",
                "failed",
                "received",
                name="wa_message_status",
            ),
            nullable=False,
            server_default=sa.text("'received'"),
        ),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("media_url", sa.String(length=1024), nullable=True),
        sa.Column("media_mime_type", sa.String(length=120), nullable=True),
        sa.Column("media_id", sa.String(length=128), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "raw_payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
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
            ["conversation_id"],
            ["whatsapp_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["sent_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wamid", name="uq_whatsapp_chat_messages_wamid"),
    )
    op.create_index(
        "ix_whatsapp_chat_messages_id", "whatsapp_chat_messages", ["id"]
    )
    op.create_index(
        "ix_whatsapp_chat_messages_conversation_id",
        "whatsapp_chat_messages",
        ["conversation_id"],
    )
    op.create_index(
        "ix_whatsapp_chat_messages_wamid",
        "whatsapp_chat_messages",
        ["wamid"],
    )
    op.create_index(
        "ix_whatsapp_chat_messages_conv_created",
        "whatsapp_chat_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_whatsapp_chat_messages_conv_created",
        table_name="whatsapp_chat_messages",
    )
    op.drop_index(
        "ix_whatsapp_chat_messages_wamid", table_name="whatsapp_chat_messages"
    )
    op.drop_index(
        "ix_whatsapp_chat_messages_conversation_id",
        table_name="whatsapp_chat_messages",
    )
    op.drop_index(
        "ix_whatsapp_chat_messages_id", table_name="whatsapp_chat_messages"
    )
    op.drop_table("whatsapp_chat_messages")

    op.drop_index(
        "ix_whatsapp_conversations_account_last_msg",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "uq_whatsapp_conversation_account_wa_id",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "ix_whatsapp_conversations_last_message_at",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "ix_whatsapp_conversations_status",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "ix_whatsapp_conversations_wa_id",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "ix_whatsapp_conversations_account_id",
        table_name="whatsapp_conversations",
    )
    op.drop_index(
        "ix_whatsapp_conversations_id", table_name="whatsapp_conversations"
    )
    op.drop_table("whatsapp_conversations")

    sa.Enum(name="wa_message_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="wa_message_kind").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="wa_message_direction").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="wa_conversation_status").drop(op.get_bind(), checkfirst=True)
