# Draftly Workflow

## Overview

Draftly automatically generates documentation from support requests across multiple platforms using an 8-node LangGraph pipeline with human-in-the-loop review.

## Supported Platforms

- **GitHub**: Issues and discussions
- **Slack**: Support channel messages and threads
- **Discord**: Support server messages and threads
- **CLI**: Direct API input

## Complete Workflow

### 1. Inbound Tracking (Webhook Endpoints)

```
┌─────────────────────────────────────────────────────────────────┐
│  Platform Webhooks                                               │
│                                                                  │
│  GitHub: POST /api/github/webhook                               │
│    - Receives: issues.opened, issues.edited, issue_comment     │
│    - Verifies: HMAC SHA256 signature                            │
│    - Authenticates: JWT → installation token                    │
│                                                                  │
│  Slack: POST /api/slack/webhook                                 │
│    - Receives: app_mention, message (in support channels)       │
│    - Verifies: Signing secret                                   │
│    - Handles: URL verification challenge                        │
│                                                                  │
│  Discord: POST /api/discord/webhook                             │
│    - Receives: INTERACTION_CREATE (slash commands)              │
│    - Verifies: Ed25519 signature                                │
│    - Handles: PING interaction                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Issue Ingestion (`ingest_node`)

- Creates support thread record in database
- Stores audit log entry
- Initializes pipeline state with source metadata
- Maps platform-specific data to standardized format:
  - `channel_id`: `"{owner}/{repo}"` (GitHub), `"{channel_id}"` (Slack/Discord)
  - `thread_id`: Issue number (GitHub), `"{channel_id}-{timestamp}"` (Slack/Discord)
  - `question`: Title + body (GitHub), message text (Slack/Discord)

### 3. Memory Retrieval (`memory_retrieve_node`)

Searches 4 memory layers for relevant context:

1. **Semantic Search** (Vector Index)
   - Similar documentation
   - Past solutions
   - Related knowledge packages

2. **Episodic Search** (Support Threads)
   - Similar support requests
   - Resolution history
   - Common patterns

3. **Organizational Memory** (Key-Value Store)
   - Best practices
   - Known solutions
   - Internal documentation

4. **Reviewer Memory** (Feedback History)
   - Past review decisions
   - Common feedback patterns
   - Quality thresholds

### 4. Research (`research_node`)

Searches the web for additional context and documentation:

```
┌─────────────────────────────────────────────────────────────────┐
│  Web Research                                                   │
│                                                                  │
│  Web Search: search_web()                                       │
│    - Searches web using search API (SerpAPI, Google, etc.)      │
│    - Returns: title, URL, snippet                              │
│    - Query: original question + key terms                      │
│    - Results: top 10 relevant pages                            │
│                                                                  │
│  Documentation: search_documentation()                         │
│    - Searches official documentation sites                     │
│    - Returns: title, URL, content                              │
│    - Sources: GitHub docs, Stack Overflow, MDN, official docs  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Synthesis (`synthesize_node`)

LLM merges all research into a unified knowledge package:

```json
{
  "key_facts": ["verified facts from sources"],
  "solutions": ["solutions found"],
  "code_examples": ["code snippets found"],
  "gaps": ["missing or contradictory information"],
  "sources": ["source references"],
  "recommended_doc_type": "howto|faq|tutorial|troubleshooting|reference"
}
```

### 6. Documentation Generation (`write_docs_node`)

LLM generates production-ready documentation:

- Title
- Introduction
- Prerequisites
- Step-by-step instructions with code examples
- Troubleshooting tips
- FAQ section

Stores draft in `documentation` table with status `'draft'`.

### 7. AI Review (`ai_review_node`)

LLM evaluates documentation quality:

- **Factual accuracy** — matches knowledge package?
- **Completeness** — answers the original question?
- **Code accuracy** — syntactically correct?
- **Clarity** — easy to follow?
- **Missing steps** — gaps in instructions?

Returns confidence score (0.0-1.0) and list of issues.

### 8. Human Review (`human_review_node`)

**Current Implementation:**
- Uses LangGraph `interrupt()` for HITL
- Stores review session in database
- Waits for decision via API/dashboard

**Required Implementation:**
- Sends notification to platform where request originated
- Includes documentation preview and approve/reject/revise buttons
- Handles callback with decision

### 9. Publishing (`publish_node`)

**Current Implementation:**
- Updates documentation status to `'approved'`
- Stores embeddings in vector index
- Updates organizational memory
- Stores reviewer feedback
- Updates support thread status to `'resolved'`

**Required Implementation:**
- Posts documentation back to original platform
- GitHub: Comment on issue with documentation
- Slack: Reply to original message with documentation
- Discord: Reply to original thread with documentation

## Routing Logic

### Confidence-Based Routing

```
if confidence_score >= 0.7:
    → human_review
else:
    → research (retry loop)
```

### Human Review Routing

```
if decision == "approve":
    → publish
elif decision == "reject":
    → END
elif decision == "revise":
    → write_docs (with feedback)
```

## State Management

### DocumentationState Fields

| Field | Type | Description |
|-------|------|-------------|
| `org_id` | `str` | Organization identifier |
| `source` | `Literal["slack", "discord", "github", "cli"]` | Request origin |
| `channel_id` | `str` | Platform-specific channel |
| `thread_id` | `str` | Platform-specific thread |
| `question` | `str` | Original request text |
| `similar_threads` | `list[dict]` | Related support requests |
| `existing_docs` | `list[dict]` | Relevant documentation |
| `reviewer_feedback_history` | `list[dict]` | Past review decisions |
| `semantic_context` | `list[dict]` | Vector search results |
| `web_context` | `list[dict]` | Web search results |
| `doc_context` | `list[dict]` | Documentation search results |
| `knowledge_package` | `dict` | Synthesized research |
| `draft_content` | `str` | Generated documentation |
| `draft_title` | `str` | Documentation title |
| `doc_type` | `str` | Documentation type |
| `confidence_score` | `float` | Quality score (0-1) |
| `review_result` | `dict` | AI review results |
| `review_feedback` | `str` | Review issues |
| `human_decision` | `Literal["approve", "reject", "revise", ""]` | Review decision |
| `human_feedback` | `str` | Reviewer comments |
| `published_urls` | `list[dict]` | Published documentation URLs |
| `support_thread_id` | `str` | Database thread ID |
| `workflow_id` | `str` | Workflow identifier |
| `doc_id` | `str` | Documentation ID |
| `messages` | `Annotated[list, add_messages]` | Conversation history |

## Database Schema

### Support Threads

```sql
CREATE TABLE support_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    source VARCHAR(20) NOT NULL,
    channel_id VARCHAR(100) NOT NULL,
    thread_id VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    question_summary TEXT,
    status VARCHAR(20) DEFAULT 'open',
    resolution TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
```

### Documentation

```sql
CREATE TABLE documentation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    source_thread_id UUID,
    confidence_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Gaps to Close

### 1. Inbound Webhooks

- [ ] Slack webhook endpoint to receive support messages
- [ ] Discord webhook endpoint to receive support messages
- [ ] Slack signature verification
- [ ] Discord signature verification

### 2. Outbound Delivery

- [ ] `_post_to_github()` implementation
- [ ] Slack reply to original message
- [ ] Discord reply to original thread

### 3. Human Review Notifications

- [ ] Send Slack message with review dashboard link
- [ ] Send Discord message with review dashboard link
- [ ] Handle approval callbacks

### 4. Search Tools

- [ ] Web search tool (SerpAPI, Google Custom Search, or similar)
- [ ] Documentation search tool (GitHub docs, Stack Overflow, MDN)

## Testing Strategy

### Unit Tests

- Webhook signature verification
- State building from platform payloads
- Memory retrieval with mock data
- Documentation generation with mock LLM

### Integration Tests

- End-to-end pipeline with mock webhooks
- Platform API interactions
- Database operations

### E2E Tests

- Real webhook → pipeline → documentation → platform reply
- Multi-platform scenarios
- Error handling and retries

## Error Handling

### Webhook Errors

- Invalid signature → 401 Unauthorized
- Missing payload → 400 Bad Request
- Platform API failure → 500 Internal Server Error

### Pipeline Errors

- LLM failure → Retry with backoff
- Database failure → Transaction rollback
- Platform API failure → Queue for retry

### Human Review Errors

- Timeout → Auto-reject after 24 hours
- Invalid decision → Default to reject
- Feedback parsing failure → Use raw text
