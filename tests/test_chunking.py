from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_delete_embeddings_for_content():
    from src.memory.vector_store import delete_embeddings_for_content

    with patch("src.memory.vector_store.execute", new_callable=AsyncMock) as mock_exec:
        await delete_embeddings_for_content("doc-uuid-123")
        mock_exec.assert_called_once_with(
            "DELETE FROM embeddings WHERE content_id = $1 AND content_type = 'documentation'",
            "doc-uuid-123",
        )


@pytest.mark.asyncio
async def test_ingest_knowledge_stores_chunks():
    """Verify that POST /api/knowledge creates multiple embeddings (chunks)."""
    from src.api.routes.knowledge import ingest_knowledge

    mock_token = {"org_id": "org-test-123"}

    with patch("src.api.routes.knowledge.fetch_one", new_callable=AsyncMock) as mock_fetch_one, \
         patch("src.api.routes.knowledge.delete_embeddings_for_content", new_callable=AsyncMock) as mock_delete, \
         patch("src.api.routes.knowledge.store_document_chunks", new_callable=AsyncMock) as mock_chunks:
        mock_fetch_one.return_value = {"id": "doc-uuid-456"}
        mock_chunks.return_value = 5

        request = MagicMock()
        request.title = "Test Doc"
        request.content = "A" * 5000
        request.doc_type = "howto"
        request.source_url = None

        result = await ingest_knowledge(request, token=mock_token)

        assert result["id"] == "doc-uuid-456"
        assert result["status"] == "approved"
        mock_chunks.assert_called_once()
        mock_delete.assert_called_once_with("doc-uuid-456")
        call_kwargs = mock_chunks.call_args[1]
        assert call_kwargs["org_id"] == "org-test-123"
        assert call_kwargs["content_id"] == "doc-uuid-456"
        assert call_kwargs["title"] == "Test Doc"
        assert call_kwargs["content"] == "A" * 5000
