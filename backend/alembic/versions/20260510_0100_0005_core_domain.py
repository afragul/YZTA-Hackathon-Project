"""core domain

Revision ID: 0005_core_domain
Revises: 0004_whatsapp_chat
Create Date: 2026-05-10 01:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0005_core_domain"
down_revision: Union[str, None] = "0004_whatsapp_chat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Use postgresql.ENUM with create_type=False — we create types via raw SQL.
# This avoids SQLAlchemy's auto-create-type behavior leaking into create_table.
PRODUCT_UNIT = postgresql.ENUM(
    "piece", "kg", "lt", "pack", name="product_unit", create_type=False
)
STOCK_MOVEMENT_TYPE = postgresql.ENUM(
    "in", "out", "adjustment", name="stock_movement_type", create_type=False
)
ORDER_STATUS = postgresql.ENUM(
    "pending", "confirmed", "preparing", "shipped", "delivered", "cancelled",
    name="order_status", create_type=False,
)
SHIPMENT_STATUS = postgresql.ENUM(
    "pending", "in_transit", "out_for_delivery", "delivered", "delayed", "failed",
    name="shipment_status", create_type=False,
)
TASK_TYPE = postgresql.ENUM(
    "pack_order", "ship_order", "restock", "general", name="task_type", create_type=False
)
TASK_STATUS = postgresql.ENUM(
    "todo", "in_progress", "done", "cancelled", name="task_status", create_type=False
)
TASK_PRIORITY = postgresql.ENUM(
    "low", "normal", "high", name="task_priority", create_type=False
)
NOTIFICATION_TYPE = postgresql.ENUM(
    "low_stock", "order_created", "shipment_delayed", "task_assigned",
    "agent_action", "whatsapp_inbound", "info",
    name="notification_type", create_type=False,
)
NOTIFICATION_SEVERITY = postgresql.ENUM(
    "info", "warning", "critical", name="notification_severity", create_type=False
)


def upgrade() -> None:
    # --- Create enum types via raw SQL (idempotent) ---
    op.execute("CREATE TYPE product_unit AS ENUM ('piece','kg','lt','pack')")
    op.execute("CREATE TYPE stock_movement_type AS ENUM ('in','out','adjustment')")
    op.execute("CREATE TYPE order_status AS ENUM ('pending','confirmed','preparing','shipped','delivered','cancelled')")
    op.execute("CREATE TYPE shipment_status AS ENUM ('pending','in_transit','out_for_delivery','delivered','delayed','failed')")
    op.execute("CREATE TYPE task_type AS ENUM ('pack_order','ship_order','restock','general')")
    op.execute("CREATE TYPE task_status AS ENUM ('todo','in_progress','done','cancelled')")
    op.execute("CREATE TYPE task_priority AS ENUM ('low','normal','high')")
    op.execute("CREATE TYPE notification_type AS ENUM ('low_stock','order_created','shipment_delayed','task_assigned','agent_action','whatsapp_inbound','info')")
    op.execute("CREATE TYPE notification_severity AS ENUM ('info','warning','critical')")

    # --- customers ---
    op.create_table(
        "customers",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("whatsapp_id", sa.String(32), nullable=True),
        sa.Column("whatsapp_profile_name", sa.String(120), nullable=True),
        sa.Column("whatsapp_opt_in", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_customers_id", "customers", ["id"])
    op.create_index("ix_customers_whatsapp_id", "customers", ["whatsapp_id"], unique=True)
    op.create_index("ix_customers_phone", "customers", ["phone"])
    op.create_index("ix_customers_email", "customers", ["email"])

    # --- products ---
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(80), nullable=True),
        sa.Column("unit", PRODUCT_UNIT, nullable=False, server_default="piece"),
        sa.Column("price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("stock", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("low_stock_threshold", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("image_key", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_products_id", "products", ["id"])
    op.create_index("ix_products_sku", "products", ["sku"], unique=True)
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_is_active", "products", ["is_active"])

    # --- orders ---
    op.create_table(
        "orders",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("order_number", sa.String(32), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", ORDER_STATUS, nullable=False, server_default="pending"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="TRY"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_orders_id", "orders", ["id"])
    op.create_index("ix_orders_order_number", "orders", ["order_number"], unique=True)
    op.create_index("ix_orders_customer_created", "orders", ["customer_id", "created_at"])
    op.create_index("ix_orders_status_created", "orders", ["status", "created_at"])

    # --- order_items ---
    op.create_table(
        "order_items",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False),
    )
    op.create_index("ix_order_items_id", "order_items", ["id"])
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])
    op.create_unique_constraint("uq_order_items_order_product", "order_items", ["order_id", "product_id"])

    # --- stock_movements ---
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("movement_type", STOCK_MOVEMENT_TYPE, nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("reason", sa.String(120), nullable=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_stock_movements_id", "stock_movements", ["id"])
    op.create_index("ix_stock_movements_product_created", "stock_movements", ["product_id", "created_at"])
    op.create_index("ix_stock_movements_order_id", "stock_movements", ["order_id"])

    # --- shipments ---
    op.create_table(
        "shipments",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("carrier", sa.String(50), nullable=True),
        sa.Column("tracking_number", sa.String(80), nullable=True),
        sa.Column("status", SHIPMENT_STATUS, nullable=False, server_default="pending"),
        sa.Column("expected_delivery", sa.Date(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_event", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_shipments_id", "shipments", ["id"])
    op.create_index("ix_shipments_order_id", "shipments", ["order_id"], unique=True)
    op.create_index("ix_shipments_tracking_number", "shipments", ["tracking_number"])
    op.create_index("ix_shipments_status", "shipments", ["status"])

    # --- tasks ---
    op.create_table(
        "tasks",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("task_type", TASK_TYPE, nullable=False, server_default="general"),
        sa.Column("status", TASK_STATUS, nullable=False, server_default="todo"),
        sa.Column("priority", TASK_PRIORITY, nullable=False, server_default="normal"),
        sa.Column("assignee_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_order_id", sa.BigInteger(), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_tasks_id", "tasks", ["id"])
    op.create_index("ix_tasks_assignee_status", "tasks", ["assignee_id", "status"])
    op.create_index("ix_tasks_status_due", "tasks", ["status", "due_at"])

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", NOTIFICATION_TYPE, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity", NOTIFICATION_SEVERITY, nullable=False, server_default="info"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])
    op.create_index("ix_notifications_user_read_created", "notifications", ["user_id", "is_read", "created_at"])
    op.create_index("ix_notifications_type_created", "notifications", ["type", "created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("tasks")
    op.drop_table("shipments")
    op.drop_table("stock_movements")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("customers")

    op.execute("DROP TYPE IF EXISTS notification_severity")
    op.execute("DROP TYPE IF EXISTS notification_type")
    op.execute("DROP TYPE IF EXISTS task_priority")
    op.execute("DROP TYPE IF EXISTS task_status")
    op.execute("DROP TYPE IF EXISTS task_type")
    op.execute("DROP TYPE IF EXISTS shipment_status")
    op.execute("DROP TYPE IF EXISTS order_status")
    op.execute("DROP TYPE IF EXISTS stock_movement_type")
    op.execute("DROP TYPE IF EXISTS product_unit")
