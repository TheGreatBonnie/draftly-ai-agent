"""Tests for GitHub App authentication module."""

import hashlib
import hmac
import time
from unittest.mock import MagicMock, patch

import pytest

from src.integrations.github_app import (
    generate_jwt,
    get_installation_token,
    verify_webhook_signature,
)


class TestGenerateJWT:
    """Tests for JWT generation."""

    @patch("src.integrations.github_app.PRIVATE_KEY", "test-private-key")
    @patch("src.integrations.github_app.settings")
    def test_generate_jwt_returns_string(self, mock_settings):
        """JWT generation should return a string token."""
        mock_settings.github_app_id = "12345"
        token = generate_jwt()
        assert isinstance(token, str)

    @patch("src.integrations.github_app.PRIVATE_KEY", "test-private-key")
    @patch("src.integrations.github_app.settings")
    def test_generate_jwt_contains_issuer(self, mock_settings):
        """JWT should contain the app ID as issuer."""
        mock_settings.github_app_id = "12345"
        token = generate_jwt()
        # Decode without verification to check payload
        import jwt as pyjwt

        payload = pyjwt.decode(token, options={"verify_signature": False})
        assert payload["iss"] == "12345"


class TestVerifyWebhookSignature:
    """Tests for webhook signature verification."""

    def test_valid_signature(self):
        """Should return True for valid HMAC SHA256 signature."""
        secret = "test-secret"
        payload = b'{"action": "opened"}'
        expected = hmac.new(
            secret.encode("utf-8"), msg=payload, digestmod=hashlib.sha256
        ).hexdigest()

        with patch("src.integrations.github_app.settings") as mock_settings:
            mock_settings.github_webhook_secret = secret
            result = verify_webhook_signature(payload, f"sha256={expected}")
            assert result is True

    def test_invalid_signature(self):
        """Should return False for invalid signature."""
        with patch("src.integrations.github_app.settings") as mock_settings:
            mock_settings.github_webhook_secret = "test-secret"
            result = verify_webhook_signature(b"payload", "sha256=invalid")
            assert result is False

    def test_empty_signature(self):
        """Should return False for empty signature."""
        result = verify_webhook_signature(b"payload", "")
        assert result is False

    def test_none_signature(self):
        """Should return False for None signature."""
        result = verify_webhook_signature(b"payload", None)
        assert result is False

    def test_wrong_algorithm(self):
        """Should return False for non-sha256 algorithm."""
        with patch("src.integrations.github_app.settings") as mock_settings:
            mock_settings.github_webhook_secret = "test-secret"
            result = verify_webhook_signature(b"payload", "sha1=abc123")
            assert result is False

    def test_malformed_signature(self):
        """Should return False for malformed signature (no = separator)."""
        result = verify_webhook_signature(b"payload", "sha256abc123")
        assert result is False


class TestGetInstallationToken:
    """Tests for installation token retrieval."""

    @patch("src.integrations.github_app.generate_jwt")
    @patch("src.integrations.github_app.httpx.post")
    def test_get_installation_token_success(self, mock_post, mock_jwt):
        """Should return token on successful API call."""
        mock_jwt.return_value = "test-jwt"
        mock_response = MagicMock()
        mock_response.json.return_value = {"token": "ghs_test_token"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        token = get_installation_token(12345)
        assert token == "ghs_test_token"
        mock_post.assert_called_once()

    @patch("src.integrations.github_app.generate_jwt")
    @patch("src.integrations.github_app.httpx.post")
    def test_get_installation_token_raises_on_error(self, mock_post, mock_jwt):
        """Should raise exception on API error."""
        mock_jwt.return_value = "test-jwt"
        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = Exception("API Error")
        mock_post.return_value = mock_response

        with pytest.raises(Exception):
            get_installation_token(12345)
