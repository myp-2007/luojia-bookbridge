from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = 'Luojia BookBridge API'
    environment: str = 'development'
    database_url: str = 'sqlite:///./bookbridge.db'
    allow_dev_auth: bool = False
    allow_legacy_headers: bool = False
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    storage_dir: str = 'storage/uploads'
    max_upload_mb: int = 5
    ai_provider: str = 'disabled'
    ai_base_url: str = 'https://api.openai.com/v1'
    ai_model: str = ''
    ai_api_key: SecretStr | None = None

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
