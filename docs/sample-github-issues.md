# Sample GitHub Issues for Pipeline Testing

These issues match existing docs and support threads in the database.

---

## Issue 1 — MCP Server Setup (matches `howto` doc)

**Title:** How do I set up the CockroachDB MCP server with Claude Code?

**Body:**

I installed the cockroachdb-mcp package and configured the connection string
in my Claude Code settings, but the MCP server keeps failing to connect.
My config looks like:

```json
{
  "cockroachdb": {
    "url": "postgresql://user:pass@cluster.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
  }
}
```

Getting: "connection refused" on port 26257. Using CockroachDB Cloud free tier.

---

## Issue 2 — Vector Search Performance (matches `tutorial` doc)

**Title:** Vector searches are slow after inserting 1M embeddings

**Body:**

We recently crossed 1M rows in our embeddings table and search latency
jumped from 50ms to 2s. We're using the default vector index that was
created during setup. How do we optimize this?

Table schema:
- `embedding VECTOR(3072)`
- `created_at TIMESTAMPTZ`
- `org_id UUID`

---

## Issue 3 — Multi-Region Setup (matches resolved support thread)

**Title:** What's the best way to set up multi-region CockroachDB for low latency?

**Body:**

We have users in US-East, EU-West, and APAC. Currently all writes go
to us-east-1. We need sub-100ms read latency in each region.
What's the recommended configuration? `REGIONAL BY ROW` vs `GLOBAL` tables?

---

## Issue 4 — PostgreSQL Migration (matches resolved support thread)

**Title:** Migrating from PostgreSQL — what are the main gotchas?

**Body:**

We're planning to migrate our main application database from PostgreSQL 15
to CockroachDB Cloud. What are the main compatibility issues we'll hit?
We use JSONB columns heavily, have several materialized views, and rely
on pg_cron for scheduled jobs.

---

## Issue 5 — Connection Pooling (matches resolved support thread)

**Title:** Connection pool config for asyncpg with CockroachDB in production

**Body:**

We're seeing "connection pool exhausted" errors during traffic spikes.
Currently using asyncpg with `min_size=5`, `max_size=20`. Our app does
mostly reads with occasional writes. What's the recommended pool
configuration for CockroachDB Cloud?

---

## Issue 6 — Slow Queries (matches resolved support thread)

**Title:** Queries fast in PostgreSQL are slow in CockroachDB — how to debug?

**Body:**

We migrated from PostgreSQL and several queries that took <10ms now take
500ms+. Example:

```sql
SELECT * FROM events
WHERE user_id = $1 AND created_at > now() - interval '7 days'
ORDER BY created_at DESC LIMIT 100;
```

The table has ~50M rows with a composite index on `(user_id, created_at)`.
`EXPLAIN ANALYZE` shows a full table scan instead of index seek.
