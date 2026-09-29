from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Fire & Smoke Detection API"
    environment: str = "development"
    debug: bool = False
    database_url: str = "sqlite:///./storage/flameeye.db"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["*"]
    video_upload_limit_mb: int = 200
    video_max_duration_seconds: int = 900
    video_storage_dir: Path = Path(__file__).resolve().parents[3] / "storage" / "video-analyses"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="FIRE_SMOKE_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
