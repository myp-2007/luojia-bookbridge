import os
import tempfile
import pytest

# Historical API tests explicitly opt into development identities. Real-account
# fixtures override these flags; the normal launcher disables both mechanisms.
os.environ['DATABASE_URL'] = 'sqlite:///./test_bookbridge.db'
os.environ['AI_PROVIDER'] = 'mock'
os.environ['ENVIRONMENT'] = 'development'
os.environ['ALLOW_DEV_AUTH'] = 'true'
os.environ['ALLOW_LEGACY_HEADERS'] = 'true'
_uploads = tempfile.TemporaryDirectory(prefix='bookbridge-api-uploads-')
os.environ['STORAGE_DIR'] = _uploads.name


@pytest.fixture(scope='session', autouse=True)
def cleanup_test_uploads():
    yield
    _uploads.cleanup()
