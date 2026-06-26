"""channel auto-delete timer + message created_at (Telegram-style self-destruct)

Revision ID: c8e4f1a2b3d5
Revises: b7d3c0a1e2f4
Create Date: 2026-06-26

"""
import sqlalchemy as sa
from alembic import op

revision = "c8e4f1a2b3d5"
down_revision = "b7d3c0a1e2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("channels", sa.Column("autoDeleteSeconds", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("messages", sa.Column("created_at", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "created_at")
    op.drop_column("channels", "autoDeleteSeconds")
