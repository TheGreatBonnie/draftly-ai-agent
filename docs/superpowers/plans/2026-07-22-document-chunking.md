# Document Chunking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text chunking to the knowledge ingestion pipeline so documents are split into overlapping chunks before embedding, matching the LangChain RAG tutorial's approach (`RecursiveCharacterTextSplitter`, chunk_size=1000, chunk_overlap=200).

**Architecture:** A new `src/memory/chunking.py` module provides `chunk_text()` and `store_document_chunks()`. Callers (knowledge API, publish node) replace their single `store_embedding()` calls with `store_document_chunks()`. The existing `store_embedding()` stays unchanged for single-vector use cases (support threads, review feedback).

**Tech Stack:** `langchain-text-splitters` (RecursiveCharacterTextSplitter), CockroachDB vector index, asyncpg

---

## Context

**Current state:** Every document is embedded as a single 3072-dim vector (`title + "\n\n" + content`). A 10,000-word page gets one vector, diluting its semantic signal. The LangChain RAG tutorial splits14 pages into 782 chunks with `RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)`.

**Files to create:**
| File | Responsibility |
|------|---------------|
| `src/memory/chunking.py` | `chunk_text()`, `store_document_chunks()` |
| `tests/test_chunking.py` | Unit tests for chunking and chunk storage |

**Files to modify:**
| File | Change |
|------|--------|
| `pyproject.toml` | Add `langchain-text-splitters` dependency |
| `src/memory/vector_store.py` | Add `delete_embeddings_for_content()` helper |
| `src/api/routes/knowledge.py` | Replace `store_embedding()` with `store_document_chunks()` on ingest; use new helper on delete |
| `src/agents/nodes/publish.py` | Replace `store_embedding()` with `store_document_chunks()` |

---

### Task 1: Add `langchain-text-splitters` dependency

**Files:**
- Modify: `pyproject.toml:39`

- [ ] **Step 1: Add the dependency**

In `pyproject.toml`, add after `"langchain-community>=0.3.0",` (line 39):

```toml
    "langchain-text-splitters>=0.3.0",
```

- [ ] **Step 2: Install the dependency**

Run: `pip install -e ".[dev]"`

- [ ] **Step 3: Verify import works**

Run: `python -c "from langchain_text_splitters import RecursiveCharacterTextSplitter; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "deps: add langchain-text-splitters for document chunking"
```

---

### Task 2: Create `src/memory/chunking.py`

**Files:**
- Create: `src/memory/chunking.py`

- [ ] **Step 1: Write the chunking module**

```python
from __future__ import annotations

import structlog
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.memory.vector_store import store_embedding

logger = structlog.get_logger()

_text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks suitable for embedding."""
    if not text.strip():
        return []
    chunks = _text_splitter.split_text(text)
    return [c for c in chunks if c.strip()]


async def store_document_chunks(
    org_id: str,
    content_id: str,
    title: str,
    content: str,
    metadata: dict | None = None,
) -> int:
    """Chunk a document and store each chunk as a separate embedding.

    Returns the number of chunks stored.
    """
    full_text = f"{title}\n\n{content}"
    chunks = chunk_text(full_text)

    if not chunks:
        logger.warning("empty_document_chunks", content_id=content_id)
        return 0

    base_metadata = metadata or {}
    stored = 0

    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            **base_metadata,
            "chunk_index": i,
            "total_chunks": len(chunks),
        }
        await store_embedding(
            org_id=org_id,
            content_type="documentation",
            content_id=content_id,
            content_text=chunk,
            metadata=chunk_metadata,
        )
        stored += 1

    logger.info(
        "document_chunks_stored",
        content_id=content_id,
        chunks=stored,
        total_chars=len(full_text),
    )
    return stored
```

- [ ] **Step 2: Verify no import errors**

Run: `python -c "from src.memory.chunking import chunk_text, store_document_chunks; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/memory/chunking.py
git commit -m "feat: add text chunking module with RecursiveCharacterTextSplitter"
```

---

### Task 3: Add `delete_embeddings_for_content()` to vector_store.py

**Files:**
- Modify: `src/memory/vector_store.py` (add after line 114)
- Create: `tests/test_chunking.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_chunking.py`:

```python
from unittest.mock import AsyncMock, patch, MagicMock

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chunking.py::test_delete_embeddings_for_content -v`
Expected: FAIL with `ImportError: cannot import name 'delete_embeddings_for_content'`

- [ ] **Step 3: Implement `delete_embeddings_for_content()`**

Add to `src/memory/vector_store.py` after `delete_embedding()` (after line 114):

```python


async def delete_embeddings_for_content(content_id: str) -> None:
    """Delete all embeddings for a given content_id (e.g., all chunks of a document)."""
    await execute(
        "DELETE FROM embeddings WHERE content_id = $1 AND content_type = 'documentation'",
        content_id,
    )
    logger.info("embeddings_deleted_for_content", content_id=content_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chunking.py::test_delete_embeddings_for_content -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/memory/vector_store.py tests/test_chunking.py
git commit -m "feat: add delete_embeddings_for_content helper for chunk cleanup"
```

---

### Task 4: Update knowledge ingestion API to use chunking

**Files:**
- Modify: `src/api/routes/knowledge.py:9,100-110`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_chunking.py`:

```python
@pytest.mark.asyncio
async def test_ingest_knowledge_stores_chunks():
    """Verify that POST /api/knowledge creates multiple embeddings (chunks)."""
    from src.api.routes.knowledge import ingest_knowledge

    mock_token = {"org_id": "org-test-123"}

    with patch("src.api.routes.knowledge.fetch_one", new_callable=AsyncMock) as mock_fetch_one, \
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
        call_kwargs = mock_chunks.call_args[1]
        assert call_kwargs["org_id"] == "org-test-123"
        assert call_kwargs["content_id"] == "doc-uuid-456"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chunking.py::test_ingest_knowledge_stores_chunks -v`
Expected: FAIL (the route still calls `store_embedding`, not `store_document_chunks`)

- [ ] **Step 3: Update the knowledge route**

In `src/api/routes/knowledge.py`:

Replace line 9:
```python
from src.memory.vector_store import store_embedding
```
with:
```python
from src.memory.chunking import store_document_chunks
from src.memory.vector_store import delete_embeddings_for_content
```

Replace lines 100-110:
```python
    metadata = {"source": "knowledge_upload", "doc_type": request.doc_type}
    if request.source_url:
        metadata["source_url"] = request.source_url

    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{request.title}\n\n{request.content}",
        metadata=metadata,
    )
```
with:
```python
    metadata = {"source": "knowledge_upload", "doc_type": request.doc_type}
    if request.source_url:
        metadata["source_url"] = request.source_url

    await delete_embeddings_for_content(doc_id)
    await store_document_chunks(
        org_id=org_id,
        content_id=doc_id,
        title=request.title,
        content=request.content,
        metadata=metadata,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chunking.py::test_ingest_knowledge_stores_chunks -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/knowledge.py tests/test_chunking.py
git commit -m "feat: chunk documents on knowledge ingestion instead of single embedding"
```

---

### Task 5: Update publish node to use chunking

**Files:**
- Modify: `src/agents/nodes/publish.py:8,109-116`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_chunking.py`:

```python
@pytest.mark.asyncio
async def test_publish_node_stores_chunks():
    """Verify that publish_node creates multiple embeddings (chunks)."""
    from src.agents.nodes.publish import publish_node

    state = {
        "org_id": "org-test-123",
        "doc_id": "doc-uuid-789",
        "draft_title": "How to Deploy",
        "draft_content": "A" * 5000,
        "doc_type": "howto",
        "confidence_score": 0.9,
        "source": "cli",
        "source_metadata": {},
    }

    with patch("src.agents.nodes.publish.execute", new_callable=AsyncMock), \
         patch("src.agents.nodes.publish.store_document_chunks", new_callable=AsyncMock) as mock_chunks, \
         patch("src.agents.nodes.publish.store_memory", new_callable=AsyncMock), \
         patch("src.agents.nodes.publish.store_audit_log", new_callable=AsyncMock):
        mock_chunks.return_value = 5

        result = await publish_node(state)

        mock_chunks.assert_called_once()
        call_kwargs = mock_chunks.call_args[1]
        assert call_kwargs["org_id"] == "org-test-123"
        assert call_kwargs["content_id"] == "doc-uuid-789"
        assert "How to Deploy" in call_kwargs["title"]
        assert call_kwargs["metadata"]["doc_type"] == "howto"
        assert call_kwargs["metadata"]["confidence"] == 0.9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chunking.py::test_publish_node_stores_chunks -v`
Expected: FAIL (publish_node still calls `store_embedding`)

- [ ] **Step 3: Update the publish node**

In `src/agents/nodes/publish.py`:

Replace line 8:
```python
from src.memory.vector_store import store_embedding
```
with:
```python
from src.memory.chunking import store_document_chunks
```

Replace lines 109-116:
```python
    # 2. Store embedding for future semantic search
    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{title}\n\n{content}",
        metadata={"doc_type": state.get("doc_type"), "confidence": state.get("confidence_score")},
    )
```
with:
```python
    # 2. Store chunked embeddings for future semantic search
    await store_document_chunks(
        org_id=org_id,
        content_id=doc_id,
        title=title,
        content=content,
        metadata={"doc_type": state.get("doc_type"), "confidence": state.get("confidence_score")},
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chunking.py::test_publish_node_stores_chunks -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/nodes/publish.py tests/test_chunking.py
git commit -m "feat: chunk documents on publish instead of single embedding"
```

---

### Task 6: Update knowledge delete route to use new helper

**Files:**
- Modify: `src/api/routes/knowledge.py:147-150`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_chunking.py`:

```python
@pytest.mark.asyncio
async def test_delete_knowledge_removes_all_chunks():
    """Verify that DELETE /api/knowledge/{doc_id} removes all chunk embeddings."""
    from src.api.routes.knowledge import delete_knowledge

    mock_token = {"org_id": "org-test-123"}

    with patch("src.api.routes.knowledge.fetch_one", new_callable=AsyncMock) as mock_fetch, \
         patch("src.api.routes.knowledge.delete_embeddings_for_content", new_callable=AsyncMock) as mock_del, \
         patch("src.api.routes.knowledge.execute", new_callable=AsyncMock):
        mock_fetch.return_value = {"id": "doc-uuid-456"}

        result = await delete_knowledge("doc-uuid-456", token=mock_token)

        assert result["status"] == "deleted"
        mock_del.assert_called_once_with("doc-uuid-456")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_chunking.py::test_delete_knowledge_removes_all_chunks -v`
Expected: FAIL (delete route uses raw SQL, not `delete_embeddings_for_content`)

- [ ] **Step 3: Update the delete route**

In `src/api/routes/knowledge.py`, replace lines 147-150:
```python
    await execute(
        "DELETE FROM embeddings WHERE content_id = $1 AND content_type = 'documentation'",
        doc_id,
    )
```
with:
```python
    await delete_embeddings_for_content(doc_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_chunking.py::test_delete_knowledge_removes_all_chunks -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/knowledge.py tests/test_chunking.py
git commit -m "refactor: use delete_embeddings_for_content in knowledge delete route"
```

---

### Task 7: Add chunk_text unit tests

**Files:**
- Modify: `tests/test_chunking.py`

- [ ] **Step 1: Write chunk_text unit tests**

Add to `tests/test_chunking.py`:

```python
def test_chunk_text_short_document():
    """Short documents produce a single chunk."""
    from src.memory.chunking import chunk_text

    text = "Hello world. This is a short document."
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_long_document():
    """Long documents produce multiple overlapping chunks."""
    from src.memory.chunking import chunk_text

    text = "This is a sentence about topic A. " * 100
    chunks = chunk_text(text)
    assert len(chunks) >= 2
    combined = " ".join(chunks)
    assert "topic A" in combined


def test_chunk_text_empty():
    """Empty text returns empty list."""
    from src.memory.chunking import chunk_text

    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_chunk_text_preserves_code_blocks():
    """Code blocks are not split mid-line."""
    from src.memory.chunking import chunk_text

    text = "# Title\n\nSome intro text.\n\n```python\ndef hello():\n    print('hello')\n```\n\nConclusion."
    chunks = chunk_text(text)
    combined = " ".join(chunks)
    assert "def hello():" in combined
    assert "Conclusion." in combined
```

- [ ] **Step 2: Run all chunk_text tests**

Run: `pytest tests/test_chunking.py -v -k "chunk_text"`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_chunking.py
git commit -m "test: add unit tests for chunk_text function"
```

---

### Task 8: Run full test suite and lint

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 2: Run lint**

Run: `ruff check src/ tests/`
Expected: Clean (no errors)

- [ ] **Step 3: Run typecheck**

Run: `mypy src/`
Expected: Clean (no new errors)

- [ ] **Step 4: Fix any issues**

If any step fails, fix and re-run.

- [ ] **Step 5: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/type issues from chunking implementation"
```

---

## Summary of Changes

| File | Before | After |
|------|--------|-------|
| `pyproject.toml` | No text splitters | `langchain-text-splitters>=0.3.0` |
| `src/memory/chunking.py` | — | New module: `chunk_text()`, `store_document_chunks()` |
| `src/memory/vector_store.py` | 3 functions | + `delete_embeddings_for_content()` |
| `src/api/routes/knowledge.py` | `store_embedding()` on ingest | `delete_embeddings_for_content()` + `store_document_chunks()` |
| `src/agents/nodes/publish.py` | `store_embedding()` on publish | `store_document_chunks()` |
| `tests/test_chunking.py` | — | 8 new tests |

**What stays the same:**
- `search_similar()` — unchanged, returns chunks instead of whole docs
- `search_semantic_memory()` tool — unchanged, truncation at 300 chars still works per-chunk
- `memory_retrieve_node` — unchanged, `existing_docs` filter still works (each chunk is `content_type='documentation'`)
- `embeddings` table schema — unchanged, already supports multiple rows per `content_id`

**Impact on search quality:**
- A 5,000-char doc: 1 embedding (before) → ~6-7 chunk embeddings (after)
- Similarity search returns the most relevant chunk, not an averaged whole-doc vector
- Results may include multiple chunks from the same document (the LLM handles this naturally)
