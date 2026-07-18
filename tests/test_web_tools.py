import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.agents.tools.web_tools import search_web, search_documentation


def _make_mock_response(data: dict):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = data
    return resp


@pytest.mark.asyncio
async def test_search_web():
    """Search web for relevant context."""
    mock_response = _make_mock_response({
        "organic_results": [
            {
                "title": "How to Configure Webhooks",
                "link": "https://example.com/webhooks",
                "snippet": "Step 1: Go to settings. Step 2: Click webhooks...",
            }
        ]
    })

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("src.agents.tools.web_tools.settings") as mock_settings:
        mock_settings.search_api_key = "test_api_key"
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_class.return_value.__aexit__ = AsyncMock(return_value=None)
            result = await search_web.ainvoke(
                {"query": "how to configure webhooks", "limit": 5}
            )
            assert "How to Configure Webhooks" in result
            assert "https://example.com/webhooks" in result


@pytest.mark.asyncio
async def test_search_web_no_results():
    """Handle empty search results."""
    mock_response = _make_mock_response({"organic_results": []})

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("src.agents.tools.web_tools.settings") as mock_settings:
        mock_settings.search_api_key = "test_api_key"
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_class.return_value.__aexit__ = AsyncMock(return_value=None)
            result = await search_web.ainvoke(
                {"query": "nonexistent topic", "limit": 5}
            )
            assert "No web results found" in result


@pytest.mark.asyncio
async def test_search_documentation():
    """Search documentation sites for relevant context."""
    mock_response = _make_mock_response({
        "organic_results": [
            {
                "title": "Webhook Configuration Guide",
                "link": "https://docs.example.com/webhooks",
                "snippet": "Configure webhooks in your settings...",
            }
        ]
    })

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("src.agents.tools.web_tools.settings") as mock_settings:
        mock_settings.search_api_key = "test_api_key"
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_class.return_value.__aexit__ = AsyncMock(return_value=None)
            result = await search_documentation.ainvoke(
                {"query": "webhooks configuration", "limit": 5}
            )
            assert "Webhook Configuration Guide" in result


@pytest.mark.asyncio
async def test_search_web_no_api_key():
    """Return error when API key is not configured."""
    with patch("src.agents.tools.web_tools.settings") as mock_settings:
        mock_settings.search_api_key = ""
        result = await search_web.ainvoke(
            {"query": "test", "limit": 5}
        )
        assert "Search API not configured" in result


@pytest.mark.asyncio
async def test_search_web_api_error():
    """Handle API errors gracefully."""
    mock_response = MagicMock()
    mock_response.status_code = 500

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("src.agents.tools.web_tools.settings") as mock_settings:
        mock_settings.search_api_key = "test_api_key"
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_class.return_value.__aexit__ = AsyncMock(return_value=None)
            result = await search_web.ainvoke(
                {"query": "test", "limit": 5}
            )
            assert "Web search failed: 500" in result
