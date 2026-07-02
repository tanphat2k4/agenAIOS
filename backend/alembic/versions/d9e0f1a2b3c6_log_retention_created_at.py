"""created_at on session/audit/activity logs — 7-day retention

Existing rows are stamped with the migration time so they age out one
retention window from now instead of being wiped immediately.

Revision ID: d9e0f1a2b3c6
Revises: c8e4f1a2b3d5
Create Date: 2026-07-02

"""
import time

import sqlalchemy as sa
from alembic import op

revision = "d9e0f1a2b3c6"
down_revision = "c8e4f1a2b3d5"
branch_labels = None
depends_on = None

_TABLES = ("session_logs", "audit_log", "activity_log")


def upgrade() -> None:
    now = int(time.time())
    for table in _TABLES:
        op.add_column(table, sa.Column("created_at", sa.Integer(), nullable=False, server_default="0"))
        op.execute(f"UPDATE {table} SET created_at = {now}")  # grandfather existing rows


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.drop_column(table, "created_at")
