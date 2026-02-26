from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
from typing import Optional, Literal

_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and a .env file.

    All fields can be overridden via environment variables using the same name
    in upper-case. The .env file is loaded from the backend directory.
    payment_gateway_type controls which payment adapter is active: "fake" uses
    the in-memory test adapter; "tpay" enables the production Tpay integration.
    Set email_enabled to True and supply smtp_* values to send real emails;
    when False all outgoing mail is logged to the console instead.
    google_redirect_uri and frontend_url are derived from app_scheme / app_host
    when not explicitly provided via environment variables.
    """
    app_name: str = "Kenaz API"
    debug: bool = True
    app_scheme: str = "http"
    app_host: str = "localhost"
    frontend_port: int = 5173
    backend_port: int = 8000

    database_url: str = "postgresql://postgres:postgres@localhost:5432/kenaz"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str | None = None

    jwt_secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    frontend_url: str | None = None

    payment_gateway_type: Literal["fake", "tpay"] = "fake"
    tpay_client_id: str = ""
    tpay_client_secret: str = ""

    root_admin_email: str = ""

    default_payment_url: str = ""

    email_enabled: bool = False
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Kenaz Centrum"

    password_reset_token_expire_minutes: int = 60

    rate_limit_enabled: bool = True
    rate_limit_public_per_minute: int = 600
    rate_limit_authenticated_per_minute: int = 1800
    rate_limit_admin_per_minute: int = 600
    rate_limit_webhook_per_minute: int = 3000

    model_config = SettingsConfigDict(
        env_file=str(_DIR / ".env"),
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    _use_port = settings.app_scheme == "http"
    if not settings.frontend_url:
        if _use_port:
            settings.frontend_url = f"{settings.app_scheme}://{settings.app_host}:{settings.frontend_port}"
        else:
            settings.frontend_url = f"{settings.app_scheme}://{settings.app_host}"
    if not settings.google_redirect_uri:
        if _use_port:
            settings.google_redirect_uri = (
                f"{settings.app_scheme}://{settings.app_host}:{settings.backend_port}/auth/google/callback"
            )
        else:
            settings.google_redirect_uri = (
                f"{settings.app_scheme}://{settings.app_host}/auth/google/callback"
            )
    return settings
