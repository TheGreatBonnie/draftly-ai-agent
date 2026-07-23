"""Draftly AI — Entry point for the application."""

import asyncio

import uvicorn
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000


if __name__ == "__main__":
    from src.integrations.slack_socket import should_use_socket_mode

    if should_use_socket_mode():
        from src.integrations.slack_socket import start_socket_mode

        asyncio.run(start_socket_mode())
    else:
        settings = Settings()
        uvicorn.run(
            "src.api.app:app",
            host=settings.uvicorn_host,
            port=settings.uvicorn_port,
            reload=True,
        )
