from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CockroachDB
    cockroachdb_url: str

    # Bedrock
    aws_region: str = "us-east-1"
    bedrock_model: str = "anthropic.claude-sonnet-4-20250514-v1:0"
    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"

    # Slack
    slack_bot_token: SecretStr = SecretStr("")
    slack_signing_secret: SecretStr = SecretStr("")

    # Discord
    discord_bot_token: SecretStr = SecretStr("")
    discord_public_key: SecretStr = SecretStr("")

    # GitHub
    github_token: SecretStr = SecretStr("")
    github_webhook_secret: SecretStr = SecretStr("")

    # App
    app_url: str = "http://localhost:8000"
    review_dashboard_url: str = "http://localhost:8000"
    environment: Literal["development", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
