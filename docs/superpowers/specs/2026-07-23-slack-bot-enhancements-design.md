# Slack Bot Enhancements Design

> Porting conversational UX patterns from my-casey-agent into draftly's existing Slack integration.

## Overview

Draftly's Slack bot currently handles @mentions and DMs by dispatching messages to the 8-node LangGraph pipeline. It has OAuth workspace installation, Block Kit review cards, and multi-channel notifications. What it lacks is the interactive, conversational feel that my-casey-agent demonstrates.

This design adds five independent enhancements:

1. **Socket Mode support** — Run locally without ngrok
2. **Conversation memory** — CockroachDB-backed thread history
3. **Streaming UX** — Emoji reactions, assistant panel status, feedback buttons
4. **App Home dashboard** — Workspace status and quick actions
5. **Slack MCP integration** — User-context search via Slack MCP Server

## Token Architecture

### Current (draftly)
| Token | Where | Purpose |
|-------|-------|---------|
| `SLACK_SIGNING_SECRET` | env → `settings.slack_signing_secret` | HTTP webhook verification |
| `SLACK_BOT_TOKEN` | env → fallback in `slack_app.py` | Single-workspace fallback |
| Per-workspace `bot_token` | `slack_installations` table | Resolved by `CockroachInstallationStore` per team |
| Per-workspace `user_token` | `slack_installations` table | Stored but unused today |

### After Enhancement
| Token | Where | Purpose |
|-------|-------|---------|
| `SLACK_APP_TOKEN` | env → `settings.slack_app_token` | **NEW:** Socket Mode WebSocket (`xapp-...`) |
| All existing tokens | Unchanged | No changes to existing token flow |
| Per-workspace `user_token` | `slack_installations` | **NOW USED:** Slack MCP Server auth |

**Key principle:** `SLACK_APP_TOKEN` is only used by `AsyncSocketModeHandler`. It never touches the Bolt `AsyncApp` or any API calls. The `AsyncApp` continues to use per-workspace `bot_token` from the installation store.

## Architecture

### 1. Socket Mode

New `src/integrations/slack_socket.py` entry point. Shares the same `AsyncApp` from `slack_app.py`. `main.py` auto-detects: if `SLACK_APP_TOKEN` is set, start Socket Mode; otherwise use HTTP routes.

```
Socket Mode:  SLACK_APP_TOKEN → AsyncSocketModeHandler → AsyncApp(slack_app)
HTTP Mode:    FastAPI POST → AsyncSlackRequestHandler → AsyncApp(slack_app)
```

### 2. Conversation Memory

New `src/integrations/slack_conversation.py` with `ConversationStore` backed by CockroachDB. New migration for `slack_conversations` table. `slack_app.py` loads history before dispatch, stores user message after. `slack_runner.py` receives `message_history` and passes it to `DocumentationState`.

### 3. Streaming UX

- **Emoji reactions:** `:eyes:` on receipt (existing `add_reaction()`). Progress reactions (`:mag:`, `:pencil2:`, `:white_check_mark:`) via `update_progress_reaction()`.
- **Assistant panel:** `assistant.assistantThreadsSetStatus` calls during pipeline stages.
- **Feedback buttons:** `FeedbackButtonsElement` appended to final reply. `draftly_feedback` action handler logs to structlog.

### 4. App Home

New `src/integrations/slack_home.py` builder. `app_home_opened` event handler in `slack_app.py`. Shows workspace name, pipeline stats, quick action buttons. Messages tab gets suggested prompts.

### 5. Slack MCP

New `src/integrations/slack_mcp.py` wrapper. Uses `mcp` Python SDK's `MCPServerStreamableHTTP` to connect to `https://mcp.slack.com/mcp` with user token. `slack_runner.py` resolves user token from installation store, creates MCP toolset, passes to research node.

## Files Changed

| File | Change |
|------|--------|
| `src/config.py` | Add `slack_app_token` setting |
| `src/integrations/slack_socket.py` | **NEW:** Socket Mode entry point |
| `src/integrations/slack_conversation.py` | **NEW:** CockroachDB conversation store |
| `src/integrations/slack_home.py` | **NEW:** App Home view builder |
| `src/integrations/slack_mcp.py` | **NEW:** Slack MCP Server client |
| `src/integrations/slack_app.py` | Add `app_home_opened`, `draftly_feedback` handlers; integrate conversation store |
| `src/agents/runners/slack_runner.py` | Accept `message_history`, add progress reactions, resolve MCP tools |
| `src/agents/nodes/research.py` | Use MCP tools for Slack search when available |
| `main.py` | Add `--socket-mode` flag and auto-detect |
| `.env.example` | Add `SLACK_APP_TOKEN`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| `infrastructure/cockroachdb/migrations/010_add_slack_conversations.sql` | **NEW:** Conversation history table |
| `pyproject.toml` | Add `mcp` dependency |

## Non-Goals

- Replacing the LangGraph pipeline with Pydantic AI
- Persisting conversation memory beyond 30-day TTL
- Implementing OAuth token rotation
- Adding slash commands
