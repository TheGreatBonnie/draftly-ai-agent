"""Draftly AI — Entry point for the application."""

import uvicorn
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000


if __name__ == "__main__":
    settings = Settings()
    uvicorn.run(
        "src.api.app:app",
        host=settings.uvicorn_host,
        port=settings.uvicorn_port,
        reload=True,
    )
