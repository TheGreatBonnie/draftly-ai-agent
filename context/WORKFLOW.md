# Draftly Workflow Documentation

This document describes the complete workflow for the Draftly documentation pipeline, including all integrations and delivery channels.

## Overview

Draftly is an AI-powered documentation pipeline that:
1. Ingests questions from multiple sources (GitHub, Slack, Discord, manual)
2. Researches answers using web search and documentation
3. Synthesizes documentation using LLM
4. Generates documentation in multiple formats
5. Reviews content with AI and optional human review
6. Publishes to configured channels

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Documentation Pipeline                      │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Ingest  │───▶│ Memory       │───▶│ Research │───▶│ Synthesize│
  │         │    │ Retrieve     │    │          │    │           │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
                                                       │
                                                       ▼
  ┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
  │ Publish │◀───│ Human Review │◀───│ AI       │◀───│ Write     │
  │         │    │ (HITL)       │    │ Review   │    │ Docs      │
  └─────────┘    └──────────────┘    └──────────┘    └───────────┘
       │
       ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    Outbound Delivery                         │
  ├─────────────┬─────────────────┬─────────────────────────────┤
  │   GitHub    │     Slack       │          Discord             │
  │   Issue     │    Channel      │         Channel              │
  └─────────────┴─────────────────┴─────────────────────────────┘
```

## Sources (Inbound)

### GitHub Issues
- **Endpoint**: `POST /api/github/webhook`
- **Authentication**: GitHub App JWT, webhook signature verification
- **Trigger**: Issue opened or comment with `@draftly-bot` mention
- **State Fields**: `source_type: "github_issue"`, `source_url`, `web_context`

### Slack Messages
- **Endpoint**: `POST /api/slack/webhook`
- **Authentication**: Slack signing secret verification
- **Trigger**: Bot mentioned in channel or thread
- **State Fields**: `source_type: "slack"`, `channel_id`, `thread_ts`

### Discord Commands
- **Endpoint**: `POST /api/discord/webhook`
- **Authentication**: Ed25519 signature verification
- **Trigger**: `/draftly question:<question>` slash command
- **State Fields**: `source_type: "discord"`, `channel_id`, `guild_id`

### Manual Input
- **Endpoint**: `POST /api/reviews/submit`
- **Authentication**: API key
- **Trigger**: Direct API call
- **State Fields**: `source_type: "manual"`, `question`

## Research Sources

### Web Search (SerpAPI)
- **Tool**: `search_web(query, num_results)`
- **Purpose**: General web search for documentation, Stack Overflow, official docs
- **State Update**: Appends to `web_context` list

### Documentation Search
- **Tool**: `search_documentation(query)`
- **Purpose**: Search internal documentation and knowledge base
- **State Update**: Appends to `doc_context` list

## Confidence Routing

After AI review, documents are routed based on confidence score:

| Confidence | Threshold | Action |
|------------|-----------|--------|
| High       | ≥ 0.8     | Auto-publish |
| Medium     | 0.5 - 0.8 | Queue for human review |
| Low        | < 0.5     | Reject with feedback |

## Outbound Delivery

### GitHub
- Posts comments on source issues
- Links to published documentation
- Updates issue labels (documentation-needed, documented)

### Slack
- Posts to configured channels with rich formatting
- Supports thread replies for context
- Includes links to documentation

### Discord
- Posts to configured channels
- Supports embeds for rich formatting
- Includes links to documentation

## Human Review (HITL)

### Workflow
1. Document queued for review with low confidence
2. Notifications sent to Slack/Discord
3. Reviewer accesses dashboard at `/review/{review_id}`
4. Reviewer approves, requests changes, or rejects
5. Decision recorded in `review_sessions` table
6. Pipeline resumes with human decision

### Notification Message Format
```
📝 Documentation Review Required

Title: {title}
Source: {source}
Confidence: {confidence}%
Original Question: {question}

Review this document in the dashboard to approve or request changes.
```

## State Schema

### Core Fields
```typescript
{
  // Question/Source
  question: string;
  source_type: "github_issue" | "slack" | "discord" | "manual";
  source_url?: string;
  channel_id?: string;
  thread_ts?: string;
  
  // Research Context
  web_context: string[];      // Web search results
  doc_context: string[];      // Documentation search results
  
  // Documentation
  draft_title: string;
  draft_content: string;
  doc_type: "faq" | "tutorial" | "reference" | "troubleshooting";
  
  // Quality
  confidence_score: number;
  ai_reviewer_feedback?: string;
  human_decision?: "approve" | "reject" | "revise";
  human_feedback?: string;
  
  // Metadata
  org_id: string;
  doc_id?: string;
}
```

## API Endpoints

### Inbound Webhooks
- `POST /api/github/webhook` - GitHub App events
- `POST /api/slack/webhook` - Slack events
- `POST /api/discord/webhook` - Discord interactions

### Pipeline
- `POST /api/pipeline/run` - Trigger pipeline manually
- `GET /api/pipeline/{id}` - Get pipeline status

### Review
- `GET /api/reviews` - List pending reviews
- `POST /api/reviews/{id}/decision` - Submit review decision

### Documentation
- `GET /api/docs` - List documentation
- `GET /api/docs/{id}` - Get documentation detail

## Configuration

### Environment Variables
```bash
# Web Search
SEARCH_API_KEY=serpapi-key

# GitHub
GITHUB_APP_ID=12345
GITHUB_WEBHOOK_SECRET=secret
GITHUB_PRIVATE_KEY_PATH=.github/private-key.pem

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Discord
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...

# Outbound
SLACK_CHANNEL_ID=C123456
DISCORD_CHANNEL_ID=123456789
```

## Monitoring

### Logs
- All nodes emit structured logs via `structlog`
- Key events: `ingest_started`, `research_completed`, `publish_delivered`

### Metrics
- Pipeline completion rate
- Confidence score distribution
- Human review queue size
- Delivery success rate by channel
