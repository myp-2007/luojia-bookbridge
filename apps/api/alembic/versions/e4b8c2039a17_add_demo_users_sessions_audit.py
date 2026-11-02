"""add users, sessions and audit logs

Revision ID: e4b8c2039a17
Revises: c1f7e8a4d2b1
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
revision = 'e4b8c2039a17'
down_revision = 'c1f7e8a4d2b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('users', sa.Column('id', sa.String(80), primary_key=True), sa.Column('nickname', sa.String(80), nullable=False), sa.Column('role', sa.String(20), nullable=False), sa.Column('college', sa.String(120), nullable=False), sa.Column('contact', sa.String(200), nullable=True), sa.Column('is_demo', sa.Boolean(), nullable=False))
    op.create_table('user_sessions', sa.Column('token_hash', sa.String(64), primary_key=True), sa.Column('user_id', sa.String(80), sa.ForeignKey('users.id'), nullable=False), sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_expires_at', 'user_sessions', ['expires_at'])
    op.create_table('audit_logs', sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('actor_id', sa.String(80), nullable=False), sa.Column('action', sa.String(80), nullable=False), sa.Column('target_id', sa.String(120), nullable=False), sa.Column('description', sa.Text(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    op.drop_table('audit_logs')
    op.drop_table('user_sessions')
    op.drop_table('users')
