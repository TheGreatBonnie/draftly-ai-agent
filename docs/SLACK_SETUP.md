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
| `channels:history` | Read channel messages |
| `channels:read` | List channels |
| `chat:write` | Post messages |
| `users:read` | Look up users |
| `groups:read` | Read private channels |
| `im:read` | Read DMs |
| `im:write` | Send DMs |

### Step 3: Event Subscriptions

- Toggle **Enable Events** ON
- Request URL: `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/events`
- Subscribe to bot events:
  - `app_mention` — @mentions
  - `message.im` — direct messages

### Step 4: Interactivity

- Toggle **Interactivity** ON
- Request URL: `https://grit-flagstone-recreate.ngrok-free.dev/api/slack/interactivity`

### Step 5: Get Credentials

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
    "bot_user": {
      "display_name": "Draftly",
      "always_online": true
    },
    "app_home": {
      "messages_tab_read_only_enabled": false
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "channels:history",
        "channels:read",
        "chat:write",
        "users:read",
        "groups:read",
        "im:read",
        "im:write"
      ]
    },
    "redirect_urls": [
      "https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback"
    ]
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.im"
      ]
    },
    "interactivity": {
      "is_enabled": true
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false
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
  bot_user:
    display_name: Draftly
    always_online: true
  app_home:
    messages_tab_read_only_enabled: false
oauth_config:
  scopes:
    bot:
      - channels:history
      - channels:read
      - chat:write
      - users:read
      - groups:read
      - im:read
      - im:write
  redirect_urls:
    - https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: false
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
  bot_user:
    display_name: Draftly
    always_online: true
  app_home:
    messages_tab_read_only_enabled: false
oauth_config:
  scopes:
    bot:
      - channels:history
      - channels:read
      - chat:write
      - users:read
      - groups:read
      - im:read
      - im:write
  redirect_urls:
    - https://grit-flagstone-recreate.ngrok-free.dev/api/slack/oauth/callback
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  interactivity:
    is_enabled: true
  org_deploy_enabled: false
  socket_mode_enabled: false
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
| Interactivity | `POST /api/slack/interactivity` |
| OAuth Install | `GET /api/slack/install` |
| OAuth Callback | `GET /api/slack/oauth/callback` |
| Installations API | `GET /api/slack/installations` |
