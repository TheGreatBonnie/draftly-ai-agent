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

## Human Review (HITL)

### Workflow
1. Document queued for review with low confidence
2. Notifications sent to all active reviewers via their preferred channel
3. Reviewer accesses dashboard via secure token link or logs in
4. Reviewer approves, requests changes, or rejects
5. Decision recorded in `review_sessions` table
6. Pipeline resumes with human decision

### Reviewer Management

#### Reviewers Table
```sql
CREATE TABLE reviewers (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name STRING NOT NULL,
    email STRING,
    slack_user_id STRING,
    discord_user_id STRING,
    notification_channel STRING DEFAULT 'slack',
    is_active BOOLEAN DEFAULT true
);
```

#### Notification Channels
- **Slack**: Direct message to reviewer's Slack user ID
- **Discord**: Direct message to reviewer's Discord user ID
- **Email**: HTML email via SendGrid with quick action links

### Notification Message Format

#### Slack/Discord
```
📝 *Documentation Review Required*

*Title:* {title}
*Source:* {source}
*Confidence:* {confidence}%

[Review Documentation]({dashboard_url})
Or use: `/approve {token}` | `/reject {token}` | `/revise {token}`
```

#### Email
HTML email with:
- Document title and confidence score
- Original question
- Quick action buttons (Approve/Reject/Request Changes)
- Link to full dashboard review

### Secure Token Actions

Tokens are time-limited (24 hours) and contain:
- Reviewer ID
- Review ID
- Expiration timestamp
- HMAC signature for verification

**Endpoints:**
- `GET /api/review/{token}` - Verify token and get review details
- `POST /api/review/{token}/action` - Execute quick action

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
- `GET /api/review/{token}` - Verify token and get review
- `POST /api/review/{token}/action` - Execute quick action

### Reviewers
- `POST /api/reviewers` - Create reviewer
- `GET /api/reviewers` - List org reviewers
- `GET /api/reviewers/{id}` - Get reviewer
- `PUT /api/reviewers/{id}` - Update reviewer
- `DELETE /api/reviewers/{id}` - Delete reviewer

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

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@draftly.app
SENDGRID_FROM_NAME=Draftly

# Security
SECRET_KEY=change-me-in-production

# Outbound
SLACK_CHANNEL_ID=C123456
DISCORD_CHANNEL_ID=123456789
```

## Monitoring

### Logs
- All nodes emit structured logs via `structlog`
- Key events: `ingest_started`, `research_completed`, `publish_delivered`, `notifications_sent`

### Metrics
- Pipeline completion rate
- Confidence score distribution
- Human review queue size
- Delivery success rate by channel
- Notification delivery rate by channel
