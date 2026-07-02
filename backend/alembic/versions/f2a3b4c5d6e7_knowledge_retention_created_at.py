"""created_at on knowledge_entries — 7-day retention (same policy as logs/runs)

Existing entries are stamped with the migration time so they age out one
retention window from now instead of being wiped immediately.

Revision ID: f2a3b4c5d6e7
Revises: d9e0f1a2b3c6
Create Date: 2026-07-02

"""
import time

import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "d9e0f1a2b3c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("knowledge_entries", sa.Column("created_at", sa.Integer(), nullable=False, server_default="0"))
    op.execute(f"UPDATE knowledge_entries SET created_at = {int(time.time())}")  # grandfather existing rows


def downgrade() -> None:
    op.drop_column("knowledge_entries", "created_at")
