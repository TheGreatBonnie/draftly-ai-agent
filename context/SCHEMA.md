# Database Schema

## Overview

Draftly uses CockroachDB with distributed vector index for semantic search. The schema supports multi-tenant architecture with **15 tables**. All foreign key references to the parent `organizations` table use the Clerk org ID (`clerk_org_id`) as the linkage column rather than the internal UUID primary key.

## Entity Relationship Diagram

```
                            ┌─────────────────┐
                            │  clerk_users     │
                            └────────┬────────┘
                                     │
                                     ▼
┌─────────────────┐        ┌──────────────────┐
│  organizations  │◀───────│user_organizations │
│  (multi-tenant) │        └──────────────────┘
└────────┬────────┘
         │
         ├──┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
         │  │                 │                 │                 │                 │                 │
         ▼  ▼                 ▼                 ▼                 ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   support    │  │ documentation│  │   reviewers  │  │github_       │  │ agent_memory │  │slack_        │
│   _threads   │  │              │  │              │  │installations │  │              │  │installations │
└──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └──────────────┘  └──────┬───────┘
       │                 │                                   │                                    │
       │                 ▼                                   ▼                                    ▼
       │         ┌──────────────┐                   ┌──────────────┐                     ┌──────────────┐
       └────────▶│   review     │                   │github_       │                     │slack_        │
                 │  _sessions   │                   │workflows     │                     │workflows     │
                 └──────────────┘                   └──────────────┘                     └──────────────┘

┌──────────────┐
│  audit_logs  │
└──────────────┘

┌──────────────┐  ┌──────────────┐
│  embeddings  │  │agent_workflow│
│  (vectors)   │  │     s        │
└──────────────┘  └──────────────┘
```

## Tables

### 1. organizations (Multi-tenant)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY DEFAULT gen_random_uuid() |
| clerk_org_id | STRING | NOT NULL UNIQUE |
| clerk_org_name | STRING | NOT NULL |
| slack_workspace_id | STRING | |
| discord_guild_id | STRING | |
| github_org | STRING | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 2. support_threads (Episodic Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| source | STRING | NOT NULL CHECK (source IN ('slack', 'discord', 'github', 'cli')) |
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
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| title | STRING | NOT NULL |
| content | TEXT | NOT NULL |
| doc_type | STRING | NOT NULL, CHECK (doc_type IN ('howto', 'faq', 'tutorial', 'troubleshooting', 'reference')) |
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
| content | TEXT | |
| embedding | VECTOR(3072) | |
| metadata | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Org ID, content type, and content ID are stored inside the `metadata` JSONB column rather than as top-level columns. This matches the `AsyncCockroachDBVectorStore` expectations.

**Vector Index:**
- Created dynamically via `AsyncCockroachDBVectorStore.aapply_vector_index()`: `CREATE VECTOR INDEX ON embeddings (embedding vector_cosine_ops)`

### 5. review_sessions (Reviewer Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| doc_id | UUID | NOT NULL FK → documentation, ON DELETE CASCADE |
| reviewer_id | UUID | |
| status | STRING | DEFAULT 'pending', CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')) |
| reviewer_feedback | TEXT | |
| edits_made | JSONB | |
| confidence_before | FLOAT | CHECK (confidence_before >= 0 AND confidence_before <= 1) |
| confidence_after | FLOAT | CHECK (confidence_after >= 0 AND confidence_after <= 1) |
| thread_id | STRING | |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| completed_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_review_doc` ON (doc_id)
- `idx_review_status` ON (status)
- `idx_review_thread` ON (thread_id)

### 6. agent_workflows (Procedural Memory)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
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
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| memory_type | STRING | NOT NULL, CHECK (memory_type IN ('episodic', 'procedural', 'organizational', 'reviewer')) |
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
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| actor | STRING | NOT NULL, CHECK (actor IN ('agent', 'human', 'system')) |
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

### 9. reviewers (Notification Recipients)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| name | STRING | NOT NULL |
| email | STRING | |
| slack_user_id | STRING | |
| discord_user_id | STRING | |
| clerk_user_id | STRING | |
| notify_slack | BOOL | DEFAULT true |
| notify_discord | BOOL | DEFAULT false |
| notify_email | BOOL | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

**Indexes:**
- `idx_reviewers_org` ON (org_id)
- `idx_reviewers_active` ON (is_active)
- `idx_reviewers_clerk_user` ON (clerk_user_id)
- `idx_reviewers_email_org` UNIQUE ON (org_id, email) WHERE email IS NOT NULL
- `idx_reviewers_slack_org` UNIQUE ON (org_id, slack_user_id) WHERE slack_user_id IS NOT NULL
- `idx_reviewers_discord_org` UNIQUE ON (org_id, discord_user_id) WHERE discord_user_id IS NOT NULL
- `idx_reviewers_clerk_user_org` UNIQUE ON (org_id, clerk_user_id) WHERE clerk_user_id IS NOT NULL

### 10. github_installations (App Installation Data)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| installation_id | INT | NOT NULL UNIQUE |
| github_org | STRING | NOT NULL |
| repositories | JSONB | DEFAULT '[]' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

**Indexes:**
- `idx_installations_org` ON (org_id)
- `idx_installations_github_org` ON (github_org)

### 11. github_workflows (Pipeline Runs)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| workflow_id | UUID | NOT NULL |
| installation_id | INT | NOT NULL |
| owner | STRING | NOT NULL |
| repo | STRING | NOT NULL |
| issue_number | INT | NOT NULL |
| status | STRING | DEFAULT 'pending', CHECK (status IN ('pending', 'running', 'completed', 'failed')) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| completed_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_github_workflows_status` ON (status)
- `idx_github_workflows_issue` ON (owner, repo, issue_number)

### 12. clerk_users (Authentication)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| clerk_user_id | STRING | NOT NULL UNIQUE |
| email | STRING | NOT NULL DEFAULT '' |
| name | STRING | NOT NULL DEFAULT 'Unknown' |
| avatar_url | STRING | NOT NULL DEFAULT '' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

### 13. user_organizations (Membership)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| user_id | UUID | NOT NULL FK → clerk_users(id), ON DELETE CASCADE |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| role | STRING | NOT NULL DEFAULT 'org:member' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE (user_id, org_id) |

**Indexes:**
- `idx_user_org_user` ON (user_id)
- `idx_user_org_org` ON (org_id)

### 14. slack_installations (Slack OAuth Installation Data)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NULLABLE (set via /api/slack/link after install) |
| team_id | STRING | NOT NULL UNIQUE |
| team_name | STRING | |
| bot_user_id | STRING | |
| bot_token | STRING | NOT NULL |
| bot_scopes | STRING | |
| user_id | STRING | NOT NULL |
| user_token | STRING | |
| user_scopes | STRING | |
| token_type | STRING | |
| installed_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() ON UPDATE now() |

Stores Slack workspace installation data from Bolt OAuth. Used by `CockroachInstallationStore` to manage bot tokens per workspace.

**Indexes:**
- `idx_slack_installations_org` ON (org_id)
- `idx_slack_installations_team` ON (team_id)

### 15. slack_workflows (Pipeline Runs Triggered by Slack)

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| org_id | STRING | NOT NULL FK → organizations(clerk_org_id), ON DELETE CASCADE |
| workflow_id | UUID | NOT NULL |
| channel_id | STRING | NOT NULL |
| thread_ts | STRING | NOT NULL |
| status | STRING | DEFAULT 'pending', CHECK (status IN ('pending', 'running', 'completed', 'failed')) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| completed_at | TIMESTAMPTZ | |

Tracks LangGraph pipeline runs triggered by Slack messages. Links to `agent_workflows` via `workflow_id`.

**Indexes:**
- `idx_slack_workflows_status` ON (status)
- `idx_slack_workflows_thread` ON (channel_id, thread_ts)

## Migrations

Applied migrations in order:

| Migration | Description |
|-----------|-------------|
| 002_add_reviewers | Creates `reviewers` table with notification channels |
| 003_add_github_tables | Creates `github_installations` and `github_workflows` tables |
| 004_add_thread_id_to_reviews | Adds `thread_id` column and index to `review_sessions` for LangGraph checkpointer HITL resume |
| 005_add_notification_toggles | Replaces single `notification_channel` with per-platform booleans (`notify_slack`, `notify_discord`, `notify_email`) on `reviewers` |
| 006_add_clerk_tables | Creates `clerk_users` and `user_organizations` tables; adds `clerk_org_id` column to `organizations` |
| 007_use_clerk_org_id_as_pk | Converts all `org_id` FK references from `organizations(id)` to `organizations(clerk_org_id)` across all 10 child tables |
| 008_add_reviewer_clerk_user | Adds `clerk_user_id` column and unique index to `reviewers` for Clerk user linking |
| 009_add_slack_tables | Creates `slack_installations` (Bolt OAuth data) and `slack_workflows` (pipeline runs) tables |
