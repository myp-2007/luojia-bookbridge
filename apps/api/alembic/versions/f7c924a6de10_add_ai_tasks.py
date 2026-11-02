"""add persisted AI tasks

Revision ID: f7c924a6de10
Revises: e4b8c2039a17
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
revision = 'f7c924a6de10'
down_revision = 'e4b8c2039a17'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('ai_tasks',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('book_id', sa.Uuid(), sa.ForeignKey('books.id'), nullable=False),
        sa.Column('requested_by', sa.String(80), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_ai_tasks_book_id', 'ai_tasks', ['book_id'])


def downgrade():
    op.drop_table('ai_tasks')
