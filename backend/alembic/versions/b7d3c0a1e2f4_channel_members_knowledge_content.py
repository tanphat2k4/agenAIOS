"""channel_members table + knowledge_entries.content

Adds the two schema changes that were first applied at runtime during the
TradingAgents integration, so a fresh DB built purely from migrations matches
the live one.

Revision ID: b7d3c0a1e2f4
Revises: 2923e9877995
Create Date: 2026-06-25 16:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d3c0a1e2f4'
down_revision: Union[str, Sequence[str], None] = '2923e9877995'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'channel_members',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('channel_id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('initial', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('isAgent', sa.Boolean(), nullable=False),
        sa.Column('sort', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['channel_id'], ['channels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_channel_members_channel_id'), 'channel_members', ['channel_id'], unique=False)
    op.add_column('knowledge_entries', sa.Column('content', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('knowledge_entries', 'content')
    op.drop_index(op.f('ix_channel_members_channel_id'), table_name='channel_members')
    op.drop_table('channel_members')
