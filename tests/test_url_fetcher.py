from unittest.mock import AsyncMock, patch

import pytest

from src.knowledge.url_fetcher import fetch_url_content

HTML_PAGE = (
    b"<html><head><title>Test Page</title></head>"
    b"<body><h1>Hello</h1><p>World</p></body></html>"
)
HTML_NOTION = (
    b"<html><head><title>Notion Page</title></head>"
    b"<body><p>Notion content</p></body></html>"
)


@pytest.mark.asyncio
async def test_detect_webpage():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = (HTML_PAGE, "text/html")
        with patch(
            "src.knowledge.url_fetcher._extract_webpage",
            return_value=("Test Page", "Hello\nWorld"),
        ):
            result = await fetch_url_content("https://example.com/page")
            assert result.title == "Test Page"
            assert result.content == "Hello\nWorld"
            assert result.source_type == "webpage"
            assert result.url == "https://example.com/page"


@pytest.mark.asyncio
async def test_detect_pdf():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = (b"%PDF-1.4 fake pdf bytes", "application/pdf")
        with patch(
            "src.knowledge.url_fetcher._extract_pdf",
            return_value=("PDF Title", "PDF content here"),
        ):
            result = await fetch_url_content("https://example.com/doc.pdf")
            assert result.title == "PDF Title"
            assert result.source_type == "pdf"


@pytest.mark.asyncio
async def test_detect_google_doc():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = (b"Google doc exported text content", "text/plain")
        result = await fetch_url_content(
            "https://docs.google.com/document/d/abc123/edit"
        )
        assert result.source_type == "google_doc"
        assert result.content == "Google doc exported text content"


@pytest.mark.asyncio
async def test_detect_notion():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = (HTML_NOTION, "text/html")
        with patch(
            "src.knowledge.url_fetcher._extract_webpage",
            return_value=("Notion Page", "Notion content"),
        ):
            result = await fetch_url_content(
                "https://mycompany.notion.so/Page-Title"
            )
            assert result.source_type == "notion"
            assert result.title == "Notion Page"


@pytest.mark.asyncio
async def test_fetch_failure():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.side_effect = Exception("Connection refused")
        with pytest.raises(ValueError, match="Could not fetch URL"):
            await fetch_url_content("https://unreachable.example.com")


@pytest.mark.asyncio
async def test_no_content_extracted():
    with patch(
        "src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = (b"", "text/html")
        with patch(
            "src.knowledge.url_fetcher._extract_webpage",
            return_value=("", ""),
        ):
            with pytest.raises(ValueError, match="No readable content"):
                await fetch_url_content("https://example.com/empty")
