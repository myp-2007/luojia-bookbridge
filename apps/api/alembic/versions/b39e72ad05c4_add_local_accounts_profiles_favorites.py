"""add real local accounts, profiles, favorites and ISBN

Revision ID: b39e72ad05c4
Revises: a82d61b904e3
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'b39e72ad05c4'
down_revision = 'a82d61b904e3'
branch_labels = depends_on = None


def upgrade():
    op.add_column('users', sa.Column('username', sa.String(32), nullable=True))
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.add_column('users', sa.Column('password_hash', sa.String(300), nullable=True))
    op.add_column('users', sa.Column('gender', sa.String(20), server_default='undisclosed', nullable=False))
    op.add_column('users', sa.Column('bio', sa.String(500), server_default='', nullable=False))
    op.add_column('users', sa.Column('avatar_path', sa.String(500), nullable=True))
    # SQLite cannot add a column with CURRENT_TIMESTAMP as a non-constant default.
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column('books', sa.Column('isbn', sa.String(20), nullable=True))
    op.create_index('ix_books_isbn', 'books', ['isbn'])
    op.create_table('auth_throttles', sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('failures', sa.Integer(), nullable=False),
        sa.Column('window_started_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('book_favorites',
        sa.Column('user_id', sa.String(80), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('book_id', sa.Uuid(), sa.ForeignKey('books.id'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))


def downgrade():
    op.drop_table('book_favorites')
    op.drop_table('auth_throttles')
    op.drop_index('ix_books_isbn', table_name='books')
    op.drop_column('books', 'isbn')
    op.drop_index('ix_users_username', table_name='users')
    with op.batch_alter_table('users') as batch:
        for column in ['created_at', 'avatar_path', 'bio', 'gender', 'password_hash', 'username']:
            batch.drop_column(column)
