"""GitHub App authentication and webhook verification."""

from __future__ import annotations

import hashlib
import hmac
import time
from pathlib import Path

import httpx
import jwt
import structlog

from src.config import settings

logger = structlog.get_logger()

# Load private key from file
_private_key_path = Path(settings.github_private_key_path)
PRIVATE_KEY = _private_key_path.read_text() if _private_key_path.exists() else ""


def generate_jwt() -> str:
    """Generate a JSON Web Token signed with the App's private key.

    GitHub App authentication requires JWT tokens signed with RS256.
    The token is valid for 10 minutes maximum.
    """
    payload = {
        "iat": int(time.time()) - 60,  # Issued at (60s ago for clock skew)
        "exp": int(time.time()) + (10 * 60),  # Expires in 10 minutes
        "iss": settings.github_app_id,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")


def get_installation_token(installation_id: int) -> str:
    """Exchange JWT for a temporary, repository-specific access token.

    Installation tokens are scoped to specific repositories and
    are valid for 1 hour.
    """
    jwt_token = generate_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
    }
    response = httpx.post(url, headers=headers)
    response.raise_for_status()
    return response.json()["token"]


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify that incoming webhook traffic originates from GitHub.

    Uses HMAC SHA256 to validate the signature against the webhook secret.
    """
    if not signature:
        return False

    try:
        sha_name, signature_val = signature.split("=")
    except ValueError:
        return False

    if sha_name != "sha256":
        return False

    mac = hmac.new(
        settings.github_webhook_secret.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    )
    return hmac.compare_digest(mac.hexdigest(), signature_val)


async def get_installation_repositories(token: str) -> list[dict]:
    """List repositories accessible by the installation."""
    url = "https://api.github.com/installation/repositories"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json().get("repositories", [])
