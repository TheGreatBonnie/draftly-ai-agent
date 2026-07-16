-- Draftly AI Database Schema
-- CockroachDB with Distributed Vector Index

-- 1. Organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name STRING NOT NULL,
    slack_workspace_id STRING,
    discord_guild_id STRING,
    github_org STRING,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Support Threads (episodic memory)
CREATE TABLE IF NOT EXISTS support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    source STRING NOT NULL CHECK (source IN ('slack', 'discord', 'github')),
    channel_id STRING NOT NULL,
    thread_id STRING NOT NULL,
    title STRING,
    question_summary STRING,
    resolution TEXT,
    status STRING DEFAULT 'open' CHECK (status IN ('open', 'processing', 'resolved')),
    participants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_threads_org ON support_threads(org_id);
CREATE INDEX IF NOT EXISTS idx_support_threads_status ON support_threads(status);
CREATE INDEX IF NOT EXISTS idx_support_threads_source ON support_threads(source);

-- 3. Documentation (versioned output)
CREATE TABLE IF NOT EXISTS documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    title STRING NOT NULL,
    content TEXT NOT NULL,
    doc_type STRING NOT NULL CHECK (doc_type IN ('howto', 'faq', 'tutorial', 'troubleshooting', 'reference')),
    version INT DEFAULT 1,
    status STRING DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'published')),
    source_thread_id UUID REFERENCES support_threads(id),
    confidence_score FLOAT,
    published_to JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_org ON documentation(org_id);
CREATE INDEX IF NOT EXISTS idx_doc_status ON documentation(status);

-- 4. Embeddings (semantic memory with vector index)
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    content_type STRING NOT NULL CHECK (content_type IN ('documentation', 'support_thread', 'review_feedback')),
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_org ON embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(content_type);

-- Distributed Vector Index for semantic search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
    USING vector (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 5. Review Sessions (reviewer memory)
CREATE TABLE IF NOT EXISTS review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES documentation(id),
    reviewer_id UUID,
    status STRING DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')),
    reviewer_feedback TEXT,
    edits_made JSONB,
    confidence_before FLOAT,
    confidence_after FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_doc ON review_sessions(doc_id);
CREATE INDEX IF NOT EXISTS idx_review_status ON review_sessions(status);

-- 6. Agent Workflows (procedural memory)
CREATE TABLE IF NOT EXISTS agent_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    thread_id UUID REFERENCES support_threads(id),
    doc_id UUID REFERENCES documentation(id),
    graph_state JSONB NOT NULL,
    current_node STRING,
    status STRING DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_org ON agent_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON agent_workflows(status);

-- 7. Agent Memory (organizational knowledge)
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    memory_type STRING NOT NULL CHECK (memory_type IN ('episodic', 'procedural', 'organizational', 'reviewer')),
    key STRING NOT NULL,
    value JSONB NOT NULL,
    source TEXT,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memory_org ON agent_memory(org_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON agent_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_key ON agent_memory(key);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    actor STRING NOT NULL CHECK (actor IN ('agent', 'human', 'system')),
    actor_id STRING,
    action STRING NOT NULL,
    resource_type STRING,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
