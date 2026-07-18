from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CockroachDB
    cockroachdb_url: str

    # Requesty (OpenAI-compatible API)
    requesty_api_key: str
    requesty_base_url: str = "https://api.requesty.ai/v1"
    llm_model: str = "tensorx/deepseek-v4-flash"
    embedding_model: str = "azure/openai/text-embedding-3-large@francecentral"

    # Slack
    slack_bot_token: SecretStr = SecretStr("")
    slack_signing_secret: SecretStr = SecretStr("")

    # Discord
    discord_bot_token: SecretStr = SecretStr("")
    discord_public_key: SecretStr = SecretStr("")

    # GitHub
    github_token: SecretStr = SecretStr("")
    github_webhook_secret: str = ""
    github_app_id: str = ""
    github_private_key_path: str = "./private-key.pem"

    # App
    app_url: str = "http://localhost:8000"
    review_dashboard_url: str = "http://localhost:8000"
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
