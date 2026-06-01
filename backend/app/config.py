from functools import lru_cache

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    frontend_origin: str = "http://localhost:5173"
    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value

    @field_validator("frontend_origin")
    @classmethod
    def validate_origin(cls, value: str) -> str:
        if value == "*":
            return value
        AnyHttpUrl(value)
        return value.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
