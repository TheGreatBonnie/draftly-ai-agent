from __future__ import annotations

import asyncpg
import structlog

from src.config import settings

logger = structlog.get_logger()

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.cockroachdb_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("cockroachdb_pool_created")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("cockroachdb_pool_closed")


async def fetch_one(query: str, *args) -> asyncpg.Record | None:
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def fetch_all(query: str, *args) -> list[asyncpg.Record]:
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def execute(query: str, *args) -> str:
    pool = await get_pool()
    return await pool.execute(query, *args)


async def fetch_val(query: str, *args):
    pool = await get_pool()
    row = await pool.fetchrow(query, *args)
    return row[0] if row else None
