from unittest.mock import AsyncMock, patch

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
