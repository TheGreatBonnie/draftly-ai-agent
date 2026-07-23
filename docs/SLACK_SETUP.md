# Slack App Setup Guide

Three methods to set up Draftly's Slack integration.

---

## Prerequisites

- Slack workspace with admin access
- Draftly backend running (`uv run uvicorn src.api.app:app --reload`)
- Migration applied (`uv run python scripts/init_db.py`)

---

## Method 1: Web UI (Manual)

### Step 1: Create the App

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**
2. Name: "Draftly", select your workspace

### Step 2: OAuth & Permissions

**Redirect URLs:**
- `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback`

**Bot Token Scopes:**

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Read app mentions |
| `channels:history` | Read channel messages |
| `channels:read` | List channels |
| `chat:write` | Post messages |
| `groups:history` | Read private channel messages |
| `groups:read` | List private channels |
| `im:history` | Read DM history |
| `im:read` | Read DMs |
| `im:write` | Send DMs |
| `reactions:read` | Read emoji reactions |
| `reactions:write` | Add emoji reactions |
| `users:read` | Look up users |
| `assistant:write` | AI assistant features |

**User Token Scopes:**

| Scope | Purpose |
|-------|---------|
| `search:read` | Search messages |
| `channels:history` | Read channel messages |
| `channels:read` | List channels |
| `groups:history` | Read private channel messages |
| `groups:read` | List private channels |
| `im:history` | Read DM history |
| `mpim:history` | Read group DM history |
| `users:read` | Look up users |
| `chat:write` | Post messages as user |
| `canvases:read` | Read canvases |
| `canvases:write` | Create/edit canvases |
| `users:read.email` | Read user emails |

### Step 3: Event Subscriptions

- Toggle **Enable Events** ON
- Request URL: `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events`
- Subscribe to bot events:
  - `app_home_opened` — App home opened
  - `app_mention` — @mentions
  - `message.channels` — Public channel messages
  - `message.groups` — Private channel messages
  - `message.im` — Direct messages

### Step 4: Interactivity

- Toggle **Interactivity** ON
- Request URL: `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events`

### Step 5: App Home

- Enable **Home Tab**
- Enable **Messages Tab**
- Disable **Messages Tab Read Only**

### Step 6: Features

- Enable **Socket Mode**
- Enable **Org Deploy** (optional)
- Enable **MCP** (optional)

### Step 7: Get Credentials

From **Basic Information**, copy:
- Client ID
- Client Secret
- Signing Secret

---

## Method 2: Slack Apps (App Directory)

### Step 1: Create from Manifest URL

1. Go to https://api.slack.com/apps → **Create New App** → **From an app manifest**
2. Select your workspace
3. Paste the JSON or YAML manifest below

### JSON Manifest

```json
{
  "display_information": {
    "name": "Draftly",
    "description": "Autonomous documentation engineering for support requests",
    "background_color": "#4A154B"
  },
  "features": {
    "agent_view": {
      "agent_description": "Hi, I am Draftly — an autonomous documentation agent built using Bolt for Python. I help resolve support requests and generate documentation.",
      "suggested_prompts": [
        "How do I configure webhooks?",
        "Help me troubleshoot API errors"
      ]
    },
    "app_home": {
      "home_tab_enabled": true,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "bot_user": {
      "display_name": "Draftly",
      "always_online": true
    }
  },
  "oauth_config": {
    "redirect_urls": [
      "https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback"
    ],
    "scopes": {
      "user": [
        "search:read",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "mpim:history",
        "users:read",
        "chat:write",
        "canvases:read",
        "canvases:write",
        "users:read.email"
      ],
      "bot": [
        "app_mentions:read",
        "channels:history",
        "channels:read",
        "chat:write",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "im:write",
        "reactions:write",
        "reactions:read",
        "users:read",
        "assistant:write"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events",
      "bot_events": [
        "app_home_opened",
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im"
      ]
    },
    "interactivity": {
      "is_enabled": true,
      "request_url": "https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events"
    },
    "is_mcp_enabled": true,
    "org_deploy_enabled": true,
    "socket_mode_enabled": true,
    "token_rotation_enabled": false
  }
}
```

### YAML Manifest

```yaml
display_information:
  name: Draftly
  description: Autonomous documentation engineering for support requests
  background_color: "#4A154B"
features:
  agent_view:
    agent_description: "Hi, I am Draftly — an autonomous documentation agent built using Bolt for Python. I help resolve support requests and generate documentation."
    suggested_prompts:
      - "How do I configure webhooks?"
      - "Help me troubleshoot API errors"
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: Draftly
    always_online: true
oauth_config:
  redirect_urls:
    - https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback
  scopes:
    user:
      - search:read
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - im:history
      - mpim:history
      - users:read
      - chat:write
      - canvases:read
      - canvases:write
      - users:read.email
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - groups:history
      - groups:read
      - im:history
      - im:read
      - im:write
      - reactions:write
      - reactions:read
      - users:read
      - assistant:write
settings:
  event_subscriptions:
    request_url: https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events
    bot_events:
      - app_home_opened
      - app_mention
      - message.channels
      - message.groups
      - message.im
  interactivity:
    is_enabled: true
    request_url: https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events
  is_mcp_enabled: true
  org_deploy_enabled: true
  socket_mode_enabled: true
  token_rotation_enabled: false
```

### Step 2: Review & Create

1. Slack shows a summary of all permissions — review and click **Create**
2. Go to **Basic Information** to get credentials

### Step 3: Update App Later

1. Go to **Basic Information** → **App Manifest**
2. Edit the manifest JSON/YAML directly in the browser
3. Click **Save Changes**

---

## Method 3: Slack CLI

### Install

```bash
brew install slack-cli/tap/slack-cli
slack login
```

### Create App from Manifest

Create `manifest.yaml` in the project root:

```yaml
display_information:
  name: Draftly
  description: Autonomous documentation engineering for support requests
  background_color: "#4A154B"
features:
  agent_view:
    agent_description: "Hi, I am Draftly — an autonomous documentation agent built using Bolt for Python. I help resolve support requests and generate documentation."
    suggested_prompts:
      - "How do I configure webhooks?"
      - "Help me troubleshoot API errors"
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: Draftly
    always_online: true
oauth_config:
  redirect_urls:
    - https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback
  scopes:
    user:
      - search:read
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - im:history
      - mpim:history
      - users:read
      - chat:write
      - canvases:read
      - canvases:write
      - users:read.email
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - groups:history
      - groups:read
      - im:history
      - im:read
      - im:write
      - reactions:write
      - reactions:read
      - users:read
      - assistant:write
settings:
  event_subscriptions:
    request_url: https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events
    bot_events:
      - app_home_opened
      - app_mention
      - message.channels
      - message.groups
      - message.im
  interactivity:
    is_enabled: true
    request_url: https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events
  is_mcp_enabled: true
  org_deploy_enabled: true
  socket_mode_enabled: true
  token_rotation_enabled: false
```

```bash
slack create draftly --manifest manifest.yaml
```

### Update App Later

Edit `manifest.yaml`, then:

```bash
slack manifest update --manifest manifest.yaml
```

### Useful CLI Commands

```bash
slack app info           # View current config
slack credentials list   # See auth tokens
slack logs tail          # Debug event delivery
slack trigger create --trigger-def trigger.yaml  # Test events
```

---

## Environment Variables

Add to `.env`:

```
SLACK_CLIENT_ID=<from OAuth & Permissions>
SLACK_CLIENT_SECRET=<from Basic Information>
SLACK_SIGNING_SECRET=<from Basic Information>
SLACK_REDIRECT_URI=https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback
```

---

## Install to Workspace

1. Start dev server: `uv run uvicorn src.api.app:app --reload`
2. Visit: `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/install`
3. Click **Allow**

---

## Test It

- @mention the bot: `@Draftly How do I configure webhooks?`
- Or DM the bot directly
- Check logs: `slack logs tail` (CLI) or Event Diagnostics (web UI)

---

## Webhook URLs Summary

| Endpoint | URL |
|----------|-----|
| Events API | `POST /api/slack/events` |
| Interactivity | `POST /api/slack/events` |
| OAuth Install | `GET /api/slack/install` |
| OAuth Callback | `GET /api/slack/oauth/callback` |
| Installations API | `GET /api/slack/installations` |
