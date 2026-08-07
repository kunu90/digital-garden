from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str
    tavily_api_key: str = ""
    vault_path: Path | None = None
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 16_000
    max_history_tokens: int = 80_000
    thinking_budget: int = 5_000  # Set to >0 to enable extended thinking (requires claude-3-7-sonnet+)
    context_window: int = 200_000                        # tokens (Haiku 4.5 / Sonnet 4.6 both 200k)
    compaction_threshold: float = 0.80                   # trigger compaction at this fraction of context_window
    summary_model: str = "claude-haiku-4-5-20251001"     # model used for history summarization


@lru_cache
def get_settings() -> Settings:
    return Settings()


def is_anthropic_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    key = s.anthropic_api_key
    return bool(key) and not key.startswith("sk-ant-...")


def is_tavily_configured(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    key = s.tavily_api_key
    return bool(key) and not key.startswith("tvly-...")
