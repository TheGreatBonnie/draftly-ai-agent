from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CockroachDB
    cockroachdb_url: str

    # Bedrock
    aws_region: str = "us-east-1"
    bedrock_model: str = "anthropic.claude-sonnet-4-20250514-v1:0"
    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"

    # Slack
    slack_bot_token: str = ""
    slack_signing_secret: str = ""

    # Discord
    discord_bot_token: str = ""
    discord_public_key: str = ""

    # GitHub
    github_token: str = ""
    github_webhook_secret: str = ""

    # App
    app_url: str = "http://localhost:8000"
    review_dashboard_url: str = "http://localhost:8000"
    environment: str = "development"
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
