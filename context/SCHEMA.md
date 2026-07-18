# Database Schema

## Overview

Draftly uses CockroachDB with distributed vector index for semantic search. The schema supports multi-tenant architecture with 8 core tables.

## Entity Relationship Diagram

```
┌─────────────────┐
│  organizations  │
│  (multi-tenant) │
└────────┬────────┘
         │
         ├──┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
         │  │                 │                 │                 │                 │
         ▼  ▼                 ▼                 ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   support    │  │ documentation│  │  embeddings  │  │agent_workflow│  │ agent_memory │
│   _threads   │  │              │  │  (vectors)   │  │     s        │  │              │
└──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────────┘  └──────────────┘
       │                 │
       │                 ▼
       │         ┌──────────────┐
       └────────▶│   review     │
                 │  _sessions   │
                 └──────────────┘

┌──────────────┐
│  audit_logs  │
└──────────────┘
```

## Tables

### 1. organizations (Multi-tenant)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| name | STRING | NOT NULL |
| slack_workspace_id | STRING | |
| discord_guild_id | STRING | |
| github_org | STRING | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 2. support_threads (Episodic Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| source | STRING | CHECK (source IN ('slack', 'discord', 'github', 'cli')) |
| channel_id | STRING | NOT NULL |
| thread_id | STRING | NOT NULL |
| title | STRING | |
| question_summary | STRING | |
| resolution | TEXT | |
| status | STRING | DEFAULT 'open', CHECK (status IN ('open', 'processing', 'resolved')) |
| participants | JSONB | DEFAULT '[]' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| resolved_at | TIMESTAMPTZ | |
| | | UNIQUE (org_id, channel_id, thread_id) |

**Indexes:**
- `idx_support_threads_org` ON (org_id)
- `idx_support_threads_status` ON (status)
- `idx_support_threads_source` ON (source)

### 3. documentation (Versioned Output)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| title | STRING | NOT NULL |
| content | TEXT | NOT NULL |
| doc_type | STRING | CHECK (doc_type IN ('howto', 'faq', 'tutorial', 'troubleshooting', 'reference')) |
| version | INT | DEFAULT 1 |
| status | STRING | DEFAULT 'draft', CHECK (status IN ('draft', 'in_review', 'approved', 'published')) |
| source_thread_id | UUID | FK → support_threads, ON DELETE SET NULL |
| confidence_score | FLOAT | CHECK (confidence_score >= 0 AND confidence_score <= 1) |
| published_to | JSONB | DEFAULT '[]' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

**Indexes:**
- `idx_doc_org` ON (org_id)
- `idx_doc_status` ON (status)

### 4. embeddings (Semantic Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| content_type | STRING | CHECK (content_type IN ('documentation', 'support_thread', 'review_feedback')) |
| content_id | UUID | NOT NULL |
| content_text | TEXT | NOT NULL |
| embedding | VECTOR(3072) | NOT NULL |
| metadata | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**Indexes:**
- `idx_embeddings_org` ON (org_id)
- `idx_embeddings_type` ON (content_type)
- `idx_embeddings_vector` ON (embedding vector_cosine_ops) -- Distributed Vector Index

### 5. review_sessions (Reviewer Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| doc_id | UUID | FK → documentation, ON DELETE CASCADE |
| reviewer_id | UUID | |
| status | STRING | DEFAULT 'pending', CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')) |
| reviewer_feedback | TEXT | |
| edits_made | JSONB | |
| confidence_before | FLOAT | CHECK (confidence_before >= 0 AND confidence_before <= 1) |
| confidence_after | FLOAT | CHECK (confidence_after >= 0 AND confidence_after <= 1) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| completed_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_review_doc` ON (doc_id)
- `idx_review_status` ON (status)

### 6. agent_workflows (Procedural Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| thread_id | UUID | FK → support_threads, ON DELETE SET NULL |
| doc_id | UUID | FK → documentation, ON DELETE SET NULL |
| graph_state | JSONB | NOT NULL |
| current_node | STRING | |
| status | STRING | DEFAULT 'running', CHECK (status IN ('running', 'paused', 'completed', 'failed')) |
| error | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

**Indexes:**
- `idx_workflow_org` ON (org_id)
- `idx_workflow_status` ON (status)

### 7. agent_memory (Organizational Knowledge)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| memory_type | STRING | CHECK (memory_type IN ('episodic', 'procedural', 'organizational', 'reviewer')) |
| key | STRING | NOT NULL |
| value | JSONB | NOT NULL |
| source | TEXT | |
| confidence | FLOAT | DEFAULT 1.0, CHECK (confidence >= 0 AND confidence <= 1) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| last_accessed | TIMESTAMPTZ | |
| | | UNIQUE (org_id, key) |

**Indexes:**
- `idx_memory_org` ON (org_id)
- `idx_memory_type` ON (memory_type)
- `idx_memory_key` ON (key)

### 8. audit_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | UUID | FK → organizations, ON DELETE CASCADE |
| actor | STRING | CHECK (actor IN ('agent', 'human', 'system')) |
| actor_id | STRING | |
| action | STRING | NOT NULL |
| resource_type | STRING | |
| resource_id | UUID | |
| details | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**Indexes:**
- `idx_audit_org` ON (org_id)
- `idx_audit_action` ON (action)
- `idx_audit_created` ON (created_at)

## Migrations

- Schema versioning tracked via `version` column in documentation
- Use `ALTER TABLE` for schema changes
- Always add indexes for new query patterns
- Test migrations on staging before production
