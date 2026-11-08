"""An actual process restart must preserve accounts, sessions, books and uploads."""
from io import BytesIO
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx
from PIL import Image


def test_account_book_and_avatar_survive_a_server_process_restart(tmp_path):
    api_dir = Path(__file__).resolve().parents[1]
    environment = {**os.environ, 'DATABASE_URL': 'sqlite:///' + (tmp_path / 'persistent.db').as_posix(),
        'STORAGE_DIR': str(tmp_path / 'uploads'), 'ENVIRONMENT': 'test', 'AI_PROVIDER': 'disabled',
        'ALLOW_DEV_AUTH': 'false', 'ALLOW_LEGACY_HEADERS': 'false'}
    subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=api_dir,
        env=environment, check=True, capture_output=True)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    process = None

    def start():
        child = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
            cwd=api_dir, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if child.poll() is not None:
                raise AssertionError('Isolated restart-test server exited before readiness')
            try:
                if httpx.get(base + '/api/v1/health', timeout=0.5).status_code == 200:
                    return child
            except httpx.HTTPError:
                pass
            time.sleep(0.1)
        child.terminate(); child.wait(5)
        raise AssertionError('Isolated restart-test server did not become ready')

    try:
        process = start()
        with httpx.Client(base_url=base, timeout=10) as client:
            result = client.post('/api/v1/auth/register', json={'username': 'persistent_user', 'password': 'PersistBooks_2026', 'nickname': '保留资料的书友'})
            assert result.status_code == 201
            user_id = result.json()['id']
            assert client.patch('/api/v1/me', json={'bio': '重启后仍然在', 'gender': 'female'}).status_code == 200
            content = BytesIO()
            Image.new('RGB', (20, 25), 'green').save(content, 'PNG')
            avatar = client.post('/api/v1/me/avatar', files={'file': ('avatar.png', content.getvalue(), 'image/png')}).json()['avatarUrl']
            book = client.post('/api/v1/books', json={'title': '重启后仍在的高等数学', 'priceCents': 2000}).json()
            assert client.post(f"/api/v1/books/{book['id']}/images", files={'file': ('cover.png', content.getvalue(), 'image/png')}).status_code == 201
            process.terminate(); process.wait(5); process = None
            process = start()
            # The previous HttpOnly cookie remains valid after the server restarts.
            me = client.get('/api/v1/me')
            assert me.status_code == 200 and me.json()['id'] == user_id
            assert me.json()['bio'] == '重启后仍然在' and me.json()['gender'] == 'female'
            assert client.get(avatar).status_code == 200
            saved = client.get(f"/api/v1/books/{book['id']}").json()
            assert saved['sellerActive'] and saved['title'] == book['title']
            assert client.get(saved['coverUrl']).status_code == 200
            client.post('/api/v1/auth/logout')
            assert client.post('/api/v1/auth/login', json={'username': 'persistent_user', 'password': 'PersistBooks_2026'}).status_code == 200
    finally:
        if process and process.poll() is None:
            process.terminate(); process.wait(5)
