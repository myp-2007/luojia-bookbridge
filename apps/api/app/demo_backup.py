"""Consistent SQLite snapshot and local image archive for the local demo."""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import zipfile
from sqlalchemy.engine import make_url
from app.core.config import get_settings


def backup() -> Path:
    settings = get_settings()
    url = make_url(settings.database_url)
    if url.get_backend_name() != 'sqlite' or not url.database:
        raise RuntimeError('This helper supports the local SQLite demo only. Use pg_dump for PostgreSQL.')
    database = Path(url.database).resolve()
    if not database.is_file():
        raise FileNotFoundError(database)
    target = Path('backups') / datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
    target.mkdir(parents=True)
    with sqlite3.connect(database) as source, sqlite3.connect(target / 'demo.db') as destination:
        source.backup(destination)
    root = Path(settings.storage_dir).resolve()
    with zipfile.ZipFile(target / 'uploads.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        if root.exists():
            for path in root.rglob('*'):
                if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root):
                    archive.write(path, path.relative_to(root))
    return target


if __name__ == '__main__':
    print('Backup written to', backup().resolve())
