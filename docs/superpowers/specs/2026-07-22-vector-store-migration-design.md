# Design: Switch to AsyncCockroachDBVectorStore

**Date:** 2026-07-22
**Status:** Approved
**Approach:** Full rewrite of vector_store.py using langchain-cockroachdb official integration

## Overview

Replace the raw SQL vector store implementation (`src/memory/vector_store.py`) with the official `langchain-cockroachdb` library's `AsyncCockroachDBVectorStore` + `CockroachDBEngine`. This gives us managed connection pooling, CSPANN distributed vector indexes, rich metadata filtering, and less code to maintain.

## Key Architectural Decision

The library's `_insert_batch` is hardcoded to only insert `id`, `content`, `embedding`, `metadata` — no support for extra table columns. All filtering is done against the `metadata` JSONB column via `->` accessor. Therefore:

- `org_id`, `content_type`, `content_id` move into the metadata JSONB dict
- Filter dicts like `{"org_id": "org_123"}` work via `metadata->'org_id'`
- Prefix columns are **not possible** — the library's queries never reference table columns in WHERE
- The library's `content` column replaces our `content_text` column

## Components

### 1. `src/memory/vector_store.py` — Full rewrite

**Singleton initialization:**
- `CockroachDBEngine.from_connection_string(url)` — rewrites `postgresql://` to `cockroachdb+psycopg://` if needed
- `engine.ainit_vectorstore_table("embeddings", 3072)` — idempotent table creation
- `AsyncCockroachDBVectorStore(engine, embeddings, "embeddings", distance_strategy=COSINE)`
- `aapply_vector_index(CSPANNIndex(distance_strategy=COSINE))` — creates C-SPANN index

**Preserved public API (same signatures, same return types):**
- `embed_text(text) -> list[float]` — uses library's embeddings model
- `store_embedding(org_id, content_type, content_id, content_text, metadata) -> str` — wraps `aadd_texts` with metadata dict containing org_id, content_type, content_id
- `search_similar(org_id, query_text, content_type=None, k=10) -> list[dict]` — wraps `asimilarity_search_with_score` with filter dict, converts Documents to dicts
- `delete_embedding(embedding_id) -> None` — wraps `adelete`
- `delete_embeddings_for_content(content_id) -> None` — queries by metadata filter, then deletes by IDs

**Metadata dict structure:**
```python
{
    "org_id": "org_123",
    "content_type": "documentation",
    "content_id": "uuid-here",
    "chunk_index": 0,
    "total_chunks": 5,
    "source": "knowledge_upload",
    "doc_type": "reference",
    "source_url": "https://..."
}
```

### 2. `src/memory/chunking.py` — Minor update

Change `store_document_chunks` to pass `org_id`, `content_type`, `content_id` inside the metadata dict instead of as separate parameters to `store_embedding`. The `store_embedding` function now expects these in metadata.

### 3. `src/api/routes/knowledge.py` — Update delete

`delete_embeddings_for_content` queries by metadata filter `{"content_id": str(doc_id)}` then calls `adelete` with found IDs.

### 4. `src/api/routes/memory.py` — Fix bug

Change `from src.memory.vector_store import search_memory` to `from src.memory.vector_store import search_similar`.

### 5. `infrastructure/cockroachdb/schema.sql` — Update

- Add `SET CLUSTER SETTING feature.vector_index.enabled = true` at top
- Embeddings table simplified to match library schema (id, content, embedding, metadata, created_at)
- Remove manual `CREATE VECTOR INDEX` — library manages this via `aapply_vector_index`

### 6. `scripts/init_db.py` — Create

Python script that applies schema.sql and verifies cluster settings. Referenced by CI but currently missing.

### 7. Tests — Update mocks

`tests/test_chunking.py` mocks change from `src.memory.vector_store.execute`/`fetch_one` to mock the library methods (`aadd_texts`, `asimilarity_search_with_score`, `adelete`).

## Tradeoffs

| Gain | Loss |
|------|------|
| Connection pooling + retry logic | Prefix columns (library doesn't support them in queries) |
| CSPANN distributed index | Raw query control |
| Rich metadata filtering ($eq, $and, $in) | `content_text` as separate column (merged into `content`) |
| MMR search for diversity | Direct SQL transparency |
| Less code to maintain | |

## Out of Scope

- Namespace-based multi-tenancy (requires schema change to add `namespace` column)
- Full-text search via `create_tsvector` (can add later)
- Hybrid search (keyword + semantic)
