"""comics table — P1 of the comic/webtoon pipeline (script + character sheets)

Revision ID: a7b8c9d0e1f2
Revises: f2a3b4c5d6e7
Create Date: 2026-07-06

"""
import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comics",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False, server_default=""),
        sa.Column("idea", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="scripting"),
        sa.Column("stage", sa.String(), nullable=False, server_default="scripting"),
        sa.Column("style", sa.Text(), nullable=False, server_default=""),
        sa.Column("script", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("characters", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sheets", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("picks", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("errorMessage", sa.Text(), nullable=True),
        sa.Column("channelId", sa.String(), nullable=False, server_default="truyen-tranh"),
        sa.Column("createdBy", sa.String(), nullable=False, server_default=""),
        sa.Column("createdAt", sa.String(), nullable=False, server_default=""),
        sa.Column("updatedAt", sa.String(), nullable=False, server_default=""),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("comics")
