from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()
connect_args = {'check_same_thread': False, 'timeout': 30} if settings.database_url.startswith('sqlite') else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# SQLite local demos serialize transactions so double confirmation and reservation
# races remain consistent even though SQLite does not implement SELECT FOR UPDATE.
if settings.database_url.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def sqlite_connect(connection, _):
        connection.isolation_level = None
        connection.execute('PRAGMA foreign_keys=ON')

    @event.listens_for(engine, 'begin')
    def sqlite_begin(connection):
        connection.exec_driver_sql('BEGIN IMMEDIATE')
