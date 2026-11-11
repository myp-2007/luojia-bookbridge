"""Add optional BD-09 coordinates for book pickup locations."""

import sqlalchemy as sa
from alembic import op

revision = '68f4aab30b1c'
down_revision = 'b39e72ad05c4'
branch_labels = depends_on = None


def upgrade() -> None:
    op.add_column('books', sa.Column('pickup_latitude', sa.Float(), nullable=True))
    op.add_column('books', sa.Column('pickup_longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('books', 'pickup_longitude')
    op.drop_column('books', 'pickup_latitude')
