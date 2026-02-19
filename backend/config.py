from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
from typing import Optional

_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    # App
    app_name: str = "Kenaz API"
    debug: bool = True
    app_scheme: str = "http"
    app_host: str = "localhost"
    frontend_port: int = 5173
    backend_port: int = 8000

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/kenaz"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    # Can be overridden by env var GOOGLE_REDIRECT_URI (recommended in devcontainer)
    google_redirect_uri: str | None = None

    # JWT
    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Frontend
    # Can be overridden by env var FRONTEND_URL
    frontend_url: str | None = None

    # Payment Gateway
    payment_gateway_type: str = "fake"  # "fake" or "tpay"
    tpay_client_id: str = ""
    tpay_client_secret: str = ""

    # Security / Rate limiting
    rate_limit_enabled: bool = True
    rate_limit_public_per_minute: int = 600
    rate_limit_authenticated_per_minute: int = 1800
    rate_limit_admin_per_minute: int = 600
    rate_limit_webhook_per_minute: int = 3000

    # Load env regardless of current working directory.
    # Prefer backend/.env; do not load .env.example to avoid placeholder values.
    model_config = SettingsConfigDict(
        env_file=str(_DIR / ".env"),
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.frontend_url:
        settings.frontend_url = f"{settings.app_scheme}://{settings.app_host}:{settings.frontend_port}"
    if not settings.google_redirect_uri:
        settings.google_redirect_uri = (
            f"{settings.app_scheme}://{settings.app_host}:{settings.backend_port}/auth/google/callback"
        )
    return settings
