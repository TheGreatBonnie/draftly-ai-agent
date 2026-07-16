from __future__ import annotations

import json
import structlog
from langchain_aws import BedrockEmbeddings

from src.config import settings
from src.database import fetch_all, fetch_one, execute

logger = structlog.get_logger()

_embeddings_model: BedrockEmbeddings | None = None


def get_embeddings_model() -> BedrockEmbeddings:
    global _embeddings_model
    if _embeddings_model is None:
        _embeddings_model = BedrockEmbeddings(
            model_id=settings.bedrock_embedding_model,
            region_name=settings.aws_region,
        )
    return _embeddings_model


async def embed_text(text: str) -> list[float]:
    model = get_embeddings_model()
    embedding = await model.aembed_query(text)
    return embedding


async def store_embedding(
    org_id: str,
    content_type: str,
    content_id: str,
    content_text: str,
    metadata: dict | None = None,
) -> str:
    embedding = await embed_text(content_text)
    embedding_str = json.dumps(embedding)

    row = await fetch_one(
        """
        INSERT INTO embeddings (org_id, content_type, content_id, content_text, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb)
        RETURNING id::text
        """,
        org_id,
        content_type,
        content_id,
        content_text,
        embedding_str,
        json.dumps(metadata or {}),
    )
    logger.info("embedding_stored", id=row["id"], content_type=content_type)
    return row["id"]


async def search_similar(
    org_id: str,
    query_text: str,
    content_type: str | None = None,
    k: int = 10,
) -> list[dict]:
    query_embedding = await embed_text(query_text)
    embedding_str = json.dumps(query_embedding)

    if content_type:
        rows = await fetch_all(
            """
            SELECT id::text, content_type, content_id, content_text, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM embeddings
            WHERE org_id = $2 AND content_type = $3
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            embedding_str,
            org_id,
            content_type,
            k,
        )
    else:
        rows = await fetch_all(
            """
            SELECT id::text, content_type, content_id, content_text, metadata,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM embeddings
            WHERE org_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            embedding_str,
            org_id,
            k,
        )

    return [
        {
            "id": r["id"],
            "content_type": r["content_type"],
            "content_id": r["content_id"],
            "content_text": r["content_text"],
            "metadata": json.loads(r["metadata"]) if r["metadata"] else {},
            "similarity": float(r["similarity"]),
        }
        for r in rows
    ]


async def delete_embedding(embedding_id: str) -> None:
    await execute("DELETE FROM embeddings WHERE id = $1", embedding_id)
    logger.info("embedding_deleted", id=embedding_id)
