# Vector Store Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw SQL vector store with `AsyncCockroachDBVectorStore` from `langchain-cockroachdb`, fix the `search_memory` bug, add cluster setting, and create `init_db.py`.

**Architecture:** Rewrite `vector_store.py` to use `CockroachDBEngine` + `AsyncCockroachDBVectorStore`. Store `org_id`/`content_type`/`content_id` in metadata JSONB. Update chunking, knowledge routes, memory route, schema, and tests.

**Tech Stack:** Python, langchain-cockroachdb, asyncpg, CockroachDB

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/memory/vector_store.py` | Rewrite | Use AsyncCockroachDBVectorStore instead of raw SQL |
| `src/memory/chunking.py` | Modify | Pass org_id/content_type/content_id in metadata dict |
| `src/api/routes/knowledge.py` | Modify | Update delete_embeddings_for_content to use library |
| `src/api/routes/memory.py` | Modify | Fix search_memory → search_similar bug |
| `infrastructure/cockroachdb/schema.sql` | Modify | Add cluster setting, simplify embeddings table |
| `scripts/init_db.py` | Create | Database initialization script |
| `tests/test_chunking.py` | Modify | Mock library methods instead of raw SQL |

---

### Task 1: Rewrite vector_store.py

**Files:**
- Modify: `src/memory/vector_store.py`

- [ ] **Step 1: Write the new vector_store.py**

```python
from __future__ import annotations

import json
import uuid

import structlog
from langchain_cockroachdb import (
    AsyncCockroachDBVectorStore,
    CockroachDBEngine,
    CSPANNIndex,
    DistanceStrategy,
)
from langchain_openai import OpenAIEmbeddings

from src.config import settings
from src.database import fetch_all

logger = structlog.get_logger()

_engine: CockroachDBEngine | None = None
_vector_store: AsyncCockroachDBVectorStore | None = None


def _normalize_url(url: str) -> str:
    """Rewrite postgresql:// to cockroachdb:// for the library."""
    if url.startswith("postgresql://"):
        return "cockroachdb://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "cockroachdb://" + url[len("postgres://"):]
    return url


async def get_vector_store() -> AsyncCockroachDBVectorStore:
    global _engine, _vector_store
    if _vector_store is not None:
        return _vector_store

    url = _normalize_url(settings.cockroachdb_url)

    _engine = CockroachDBEngine.from_connection_string(url)

    await _engine.ainit_vectorstore_table(
        table_name="embeddings",
        vector_dimension=3072,
    )

    embeddings = OpenAIEmbeddings(
        openai_api_key=settings.requesty_api_key,
        openai_api_base=settings.requesty_base_url,
        model=settings.embedding_model,
    )

    _vector_store = AsyncCockroachDBVectorStore(
        engine=_engine,
        embeddings=embeddings,
        collection_name="embeddings",
        distance_strategy=DistanceStrategy.COSINE,
        namespace_column=None,
    )

    try:
        await _vector_store.aapply_vector_index(
            CSPANNIndex(distance_strategy=DistanceStrategy.COSINE),
        )
        logger.info("cspann_index_created")
    except Exception:
        logger.debug("cspann_index_already_exists")

    return _vector_store


async def embed_text(text: str) -> list[float]:
    store = await get_vector_store()
    return await store.embeddings.aembed_query(text)


async def store_embedding(
    org_id: str,
    content_type: str,
    content_id: str,
    content_text: str,
    metadata: dict | None = None,
) -> str:
    store = await get_vector_store()

    full_metadata = {
        "org_id": org_id,
        "content_type": content_type,
        "content_id": content_id,
        **(metadata or {}),
    }

    doc_id = str(uuid.uuid4())
    await store.aadd_texts(
        texts=[content_text],
        metadatas=[full_metadata],
        ids=[doc_id],
    )

    logger.info("embedding_stored", id=doc_id, content_type=content_type)
    return doc_id


async def search_similar(
    org_id: str,
    query_text: str,
    content_type: str | None = None,
    k: int = 10,
) -> list[dict]:
    store = await get_vector_store()

    filter_dict: dict = {"org_id": org_id}
    if content_type:
        filter_dict["content_type"] = content_type

    results = await store.asimilarity_search_with_score(
        query_text,
        k=k,
        filter=filter_dict,
    )

    return [
        {
            "id": doc.id or "",
            "content_type": doc.metadata.get("content_type", ""),
            "content_id": doc.metadata.get("content_id", ""),
            "content_text": doc.page_content,
            "metadata": doc.metadata,
            "similarity": 1.0 - score,
        }
        for doc, score in results
    ]


async def delete_embedding(embedding_id: str) -> None:
    store = await get_vector_store()
    await store.adelete([embedding_id])
    logger.info("embedding_deleted", id=embedding_id)


async def delete_embeddings_for_content(content_id: str) -> None:
    """Delete all embeddings for a given content_id (e.g., all chunks of a document)."""
    store = await get_vector_store()

    results = await store.asimilarity_search_with_score(
        " ",
        k=1000,
        filter={"content_id": content_id},
    )

    ids = [doc.id for doc, _ in results if doc.id]
    if ids:
        await store.adelete(ids)
    logger.info("embeddings_deleted_for_content", content_id=content_id, count=len(ids))
```

- [ ] **Step 2: Run linter**

Run: `uv run ruff check src/memory/vector_store.py`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/memory/vector_store.py
git commit -m "refactor: rewrite vector_store.py to use AsyncCockroachDBVectorStore"
```

---

### Task 2: Update chunking.py metadata structure

**Files:**
- Modify: `src/memory/chunking.py`

- [ ] **Step 1: Update store_document_chunks to pass org_id/content_type/content_id in metadata**

Replace the current `store_document_chunks` function:

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
            "org_id": org_id,
            "content_type": "documentation",
            "content_id": content_id,
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

- [ ] **Step 2: Run linter**

Run: `uv run ruff check src/memory/chunking.py`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/memory/chunking.py
git commit -m "refactor: update chunking.py to pass org_id/content_type in metadata"
```

---

### Task 3: Update knowledge.py delete route

**Files:**
- Modify: `src/api/routes/knowledge.py`

- [ ] **Step 1: Read the current file to understand the delete endpoints**

Read: `src/api/routes/knowledge.py`

- [ ] **Step 2: Update delete_embeddings_for_content calls**

The function signature stays the same — it's imported from vector_store.py which we already updated. No changes needed in knowledge.py since it imports and calls `delete_embeddings_for_content(doc_id)` which now uses the library internally.

However, verify the import still works:

```python
from src.memory.vector_store import delete_embeddings_for_content
```

- [ ] **Step 3: Run linter**

Run: `uv run ruff check src/api/routes/knowledge.py`
Expected: No errors

- [ ] **Step 4: Commit (no changes needed if import works)**

```bash
git add src/api/routes/knowledge.py
git commit -m "chore: verify knowledge.py imports work with new vector_store"
```

---

### Task 4: Fix search_memory bug in memory.py

**Files:**
- Modify: `src/api/routes/memory.py`

- [ ] **Step 1: Fix the import bug**

In `src/api/routes/memory.py:33`, change:

```python
from src.memory.vector_store import search_memory
```

To:

```python
from src.memory.vector_store import search_similar
```

And update the call on line 36:

```python
return await search_memory(query=q, content_type=type, org_id=org_id)
```

To:

```python
return await search_similar(org_id=org_id, query_text=q, content_type=type if type != "all" else None)
```

- [ ] **Step 2: Run linter**

Run: `uv run ruff check src/api/routes/memory.py`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/memory.py
git commit -m "fix: fix search_memory import bug in memory.py route"
```

---

### Task 5: Update schema.sql

**Files:**
- Modify: `infrastructure/cockroachdb/schema.sql`

- [ ] **Step 1: Add cluster setting at top of file**

After line 3 (the comment header), add:

```sql
-- Enable vector indexes (required for CREATE VECTOR INDEX to work)
SET CLUSTER SETTING feature.vector_index.enabled = true;
```

- [ ] **Step 2: Simplify embeddings table to match library schema**

Replace the embeddings table definition (lines 55-71) with:

```sql
-- 4. Embeddings (semantic memory with vector index)
-- Schema matches AsyncCockroachDBVectorStore expectations.
-- org_id, content_type, content_id are stored in the metadata JSONB column.
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT,
    embedding VECTOR(3072),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- C-SPANN index created by AsyncCockroachDBVectorStore.aapply_vector_index()
-- To create manually: CREATE VECTOR INDEX ON embeddings (embedding vector_cosine_ops);
```

- [ ] **Step 3: Run linter**

Run: `uv run ruff check infrastructure/`
Expected: No errors (SQL not checked by ruff)

- [ ] **Step 4: Commit**

```bash
git add infrastructure/cockroachdb/schema.sql
git commit -m "refactor: simplify embeddings table to match library schema, add cluster setting"
```

---

### Task 6: Create scripts/init_db.py

**Files:**
- Create: `scripts/init_db.py`

- [ ] **Step 1: Create the init_db.py script**

```python
"""Initialize the Draftly database schema and cluster settings.

Usage:
    uv run python scripts/init_db.py

Requires COCKROACHDB_URL environment variable.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import asyncpg


SCHEMA_PATH = Path(__file__).parent.parent / "infrastructure" / "cockroachdb" / "schema.sql"


async def init_db() -> None:
    url = os.environ.get("COCKROACHDB_URL")
    if not url:
        print("ERROR: COCKROACHDB_URL environment variable is not set", file=sys.stderr)
        sys.exit(1)

    if not SCHEMA_PATH.exists():
        print(f"ERROR: Schema file not found at {SCHEMA_PATH}", file=sys.stderr)
        sys.exit(1)

    schema_sql = SCHEMA_PATH.read_text()

    conn = await asyncpg.connect(url)
    try:
        print("Applying schema...")
        await conn.execute(schema_sql)
        print("Schema applied successfully.")

        setting = await conn.fetchrow(
            "SHOW CLUSTER SETTING feature.vector_index.enabled"
        )
        if setting and setting[0]:
            print(f"Cluster setting verified: feature.vector_index.enabled = {setting[0]}")
        else:
            print("WARNING: feature.vector_index.enabled is not set", file=sys.stderr)

    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
```

- [ ] **Step 2: Verify no import errors**

Run: `uv run python -c "import ast; ast.parse(open('scripts/init_db.py').read()); print('OK')"`
Expected: OK

- [ ] **Step 3: Run linter**

Run: `uv run ruff check scripts/init_db.py`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/init_db.py
git commit -m "feat: add init_db.py script for database initialization"
```

---

### Task 7: Update tests

**Files:**
- Modify: `tests/test_chunking.py`

- [ ] **Step 1: Read current test file**

Read: `tests/test_chunking.py`

- [ ] **Step 2: Update mocks to use library methods**

The tests currently mock `src.memory.vector_store.execute` and `fetch_one`. Update to mock `src.memory.vector_store.get_vector_store` and the library methods.

Key changes:
- Mock `get_vector_store` to return a mock vector store
- Mock `store.aadd_texts` instead of `fetch_one`
- Mock `store.asimilarity_search_with_score` instead of `fetch_all`
- Mock `store.adelete` instead of `execute`

- [ ] **Step 3: Run tests**

Run: `uv run pytest tests/test_chunking.py -v`
Expected: All tests pass

- [ ] **Step 4: Run linter**

Run: `uv run ruff check tests/test_chunking.py`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add tests/test_chunking.py
git commit -m "test: update chunking tests to mock library methods"
```

---

### Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `uv run pytest tests/ -v --tb=short`
Expected: All tests pass (chunking tests + existing tests)

- [ ] **Step 2: Run linter on all modified files**

Run: `uv run ruff check src/memory/vector_store.py src/memory/chunking.py src/api/routes/knowledge.py src/api/routes/memory.py scripts/init_db.py tests/test_chunking.py`
Expected: No errors

- [ ] **Step 3: Verify schema.sql is valid**

Run: `uv run python -c "open('infrastructure/cockroachdb/schema.sql').read(); print('OK')`
Expected: OK

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/test issues from vector store migration"
```
