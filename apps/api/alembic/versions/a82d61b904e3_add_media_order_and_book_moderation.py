"""add image order and book moderation without deleting existing data

Revision ID: a82d61b904e3
Revises: f7c924a6de10
Create Date: 2026-11-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'a82d61b904e3'
down_revision = 'f7c924a6de10'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('book_images', sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False))
    op.add_column('books', sa.Column('is_suspended', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('books', sa.Column('moderation_reason', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('books', 'moderation_reason')
    op.drop_column('books', 'is_suspended')
    op.drop_column('book_images', 'sort_order')
