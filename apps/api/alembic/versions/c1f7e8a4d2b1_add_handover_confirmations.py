"""add handover confirmation timestamps

Revision ID: c1f7e8a4d2b1
Revises: 83d5d3b3753e
Create Date: 2026-10-31 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1f7e8a4d2b1'
down_revision: Union[str, None] = '83d5d3b3753e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reservations', sa.Column('seller_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('buyer_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('reservations', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('reservations', 'completed_at')
    op.drop_column('reservations', 'buyer_confirmed_at')
    op.drop_column('reservations', 'seller_confirmed_at')
