import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Isolated, disposable database and uploads for browser regression tests.
with tempfile.TemporaryDirectory(prefix='bookbridge-e2e-') as directory:
    os.chdir(Path(__file__).resolve().parents[1])
    sys.path.insert(0, str(Path.cwd()))
    os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(directory) / 'e2e.db').as_posix()
    os.environ['STORAGE_DIR'] = str(Path(directory) / 'uploads')
    os.environ['AI_PROVIDER'] = 'mock'
    os.environ['ENVIRONMENT'] = 'development'
    os.environ['ALLOW_DEV_AUTH'] = 'true'
    os.environ['ALLOW_LEGACY_HEADERS'] = 'false'
    subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], check=True)
    subprocess.run([sys.executable, '-m', 'app.demo_seed'], check=True)
    import uvicorn
    uvicorn.run('app.main:app', host='127.0.0.1', port=8001)
