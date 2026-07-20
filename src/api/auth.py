from __future__ import annotations

import jwt
import structlog
from fastapi import Depends, HTTPException, Request

from src.config import settings

logger = structlog.get_logger()

_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        domain = settings.clerk_publishable_key.split("_")[-1]
        jwks_url = f"https://{domain}/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


class ClerkAuthError(HTTPException):
    def __init__(self, detail: str = "Invalid authentication"):
        super().__init__(status_code=401, detail=detail)


async def get_verified_token(request: Request) -> dict:
    """FastAPI dependency: extracts and verifies the Clerk JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ClerkAuthError("Missing or malformed Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise ClerkAuthError("Empty token")

    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
    except jwt.PyJWTError as e:
        logger.warning("jwt_verification_failed", error=str(e))
        raise ClerkAuthError("Invalid or expired token")

    user_id = payload.get("sub")
    org_id = payload.get("org_id")
    org_role = payload.get("org_role")

    if not user_id:
        raise ClerkAuthError("Token missing user identifier")

    return {
        "user_id": user_id,
        "org_id": org_id,
        "org_role": org_role,
        "raw": payload,
    }
