import base64
from hashlib import scrypt
from hmac import compare_digest
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = scrypt(password.encode('utf-8'), salt=salt, n=32768, r=8, p=3, maxmem=64 * 1024 * 1024, dklen=32)
    return 'scrypt$32768$8$3$' + base64.b64encode(salt).decode() + '$' + base64.b64encode(digest).decode()


_DUMMY = hash_password(secrets.token_urlsafe(32))


def verify_password(password: str, encoded: str | None) -> bool:
    try:
        parts = (encoded or _DUMMY).split('$')
        if parts[:4] != ['scrypt', '32768', '8', '3']:
            return False
        salt, expected = base64.b64decode(parts[4]), base64.b64decode(parts[5])
        actual = scrypt(password.encode('utf-8'), salt=salt, n=32768, r=8, p=3, maxmem=64 * 1024 * 1024, dklen=32)
        return compare_digest(actual, expected) and encoded is not None
    except (ValueError, IndexError):
        return False
