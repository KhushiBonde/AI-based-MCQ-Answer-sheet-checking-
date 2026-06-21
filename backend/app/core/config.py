"""
config.py
=========
Application settings loaded from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # CORS — comma-separated list of allowed origins
    cors_origins: str = "http://localhost:5173"

    # Upload limits
    max_upload_mb: int = 20

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
