# Reviewer Notification Integrations

This guide covers setting up Slack, Discord, and Email notifications so reviewers receive alerts when documentation needs their approval.

## Overview

When the Draftly pipeline generates documentation and routes it to human review, the `notify_reviewers` function checks each reviewer's notification preferences and sends alerts via their enabled platforms. Reviewers receive a link to approve, reject, or request changes — which resumes the pipeline.

---

## Slack Integration

### Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. App Name: `Draftly Bot`
4. Select your workspace → click **"Create App"**

### Step 2: Configure Bot Scopes

1. Left sidebar → **"OAuth & Permissions"**
2. Scroll to **"Bot Token Scopes"** → click **"Add an OAuth Scope"**
3. Add these scopes:
   - `chat:write` — send messages to channels and DMs
   - `im:write` — open direct message channels with users

### Step 3: Install to Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"** → review permissions → click **"Allow"**
3. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)

### Step 4: Configure Environment Variables

Add to your `.env` file:

```
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
```

To find the Signing Secret:
1. Left sidebar → **"Basic Information"**
2. Under **"App Credentials"** → copy **"Signing Secret"**

### Step 5: Find a User's Slack ID

To add a reviewer with their Slack user ID:
1. Click the user's profile in Slack
2. Click the **"More"** button (three dots)
3. Click **"Copy member ID"** (format: `U01ABC123XYZ`)

### Step 6: Create a Slack-Enabled Reviewer

```bash
curl -X POST http://localhost:8000/api/reviewers \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "your-org-uuid",
    "name": "Jane Doe",
    "slack_user_id": "U01ABC123XYZ",
    "notify_slack": true,
    "notify_discord": false,
    "notify_email": false
  }'
```

### Step 7: Test

1. Start the server: `uv run uvicorn src.api.app:app --reload`
2. Create a GitHub issue or run a CLI workflow that triggers human review
3. The reviewer should receive a DM from the Draftly Bot with the review link

---

## Discord Integration

### Step 1: Create a Discord Application

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name: `Draftly Bot` → click **"Create"**

### Step 2: Create and Configure the Bot

1. Left sidebar → **"Bot"**
2. Under **"Token"** → click **"Reset Token"** → copy the token
3. Under **"Privileged Gateway Intents"** → no special intents needed for sending messages

### Step 3: Generate Bot Invite Link

1. Left sidebar → **"OAuth2"** → **"URL Generator"**
2. Under **"Scopes"** → check `bot`
3. Under **"Bot Permissions"** → check `Send Messages`
4. Copy the **"Generated URL"** at the bottom
5. Open the URL in your browser → select your Discord server → authorize

### Step 4: Configure Environment Variables

Add to your `.env` file:

```
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_PUBLIC_KEY=your-public-key-here
```

To find the Public Key:
1. Left sidebar → **"General Information"**
2. Copy **"Public Key"**

### Step 5: Find a Channel ID

The Discord notification sends a message to a channel. To get the channel ID:
1. Open Discord → go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click the channel where you want notifications → **"Copy Channel ID"**
3. The ID is a numeric string (e.g., `123456789012345678`)

### Step 6: Create a Discord-Enabled Reviewer

```bash
curl -X POST http://localhost:8000/api/reviewers \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "your-org-uuid",
    "name": "John Smith",
    "discord_user_id": "123456789012345678",
    "notify_slack": false,
    "notify_discord": true,
    "notify_email": false
  }'
```

### Step 7: Test

1. Start the server
2. Trigger a pipeline that routes to human review
3. The bot should post a message in the specified Discord channel

---

## Email Integration (SendGrid)

### Step 1: Create a SendGrid Account

1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Sign up for a free account (100 emails/day included)

### Step 2: Create an API Key

1. Left sidebar → **"Settings"** → **"API Keys"**
2. Click **"Create API Key"**
3. Name: `Draftly` → click **"Create & View"**
4. Copy the key immediately (it won't be shown again)

### Step 3: Verify Sender Identity

Emails can only be sent from verified addresses. Choose one:

**Option A: Single Sender Verification (quick)**
1. Left sidebar → **"Settings"** → **"Sender Authentication"**
2. Click **"Verify a Single Sender"**
3. Fill in your email details → check your inbox for verification email

**Option B: Domain Authentication (professional)**
1. Left sidebar → **"Settings"** → **"Sender Authentication"**
2. Click **"Authenticate Your Domain"**
3. Follow the DNS setup instructions (add CNAME records to your domain)

### Step 4: Configure Environment Variables

Add to your `.env` file:

```
SENDGRID_API_KEY=SG.your-api-key-here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Draftly
```

`SENDGRID_FROM_EMAIL` must be the email address or domain you verified in Step 3.

### Step 5: Create an Email-Enabled Reviewer

```bash
curl -X POST http://localhost:8000/api/reviewers \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "your-org-uuid",
    "name": "Alice Brown",
    "email": "alice@example.com",
    "notify_slack": false,
    "notify_discord": false,
    "notify_email": true
  }'
```

### Step 6: Test

1. Start the server
2. Trigger a pipeline that routes to human review
3. The reviewer should receive an HTML email with Approve / Reject / Request Changes buttons

---

## Multi-Channel Reviewer

A reviewer can receive notifications on all platforms simultaneously:

```bash
curl -X POST http://localhost:8000/api/reviewers \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "your-org-uuid",
    "name": "Super Reviewer",
    "email": "super@example.com",
    "slack_user_id": "U01ABC123XYZ",
    "discord_user_id": "123456789012345678",
    "notify_slack": true,
    "notify_discord": true,
    "notify_email": true
  }'
```

When triggered, this reviewer receives a Slack DM, a Discord message, and an email — each with a unique approve/reject/revise link.

---

## Updating Notification Preferences

To change which platforms a reviewer uses:

```bash
curl -X PUT http://localhost:8000/api/reviewers/{reviewer_id} \
  -H "Content-Type: application/json" \
  -d '{
    "notify_slack": true,
    "notify_discord": false,
    "notify_email": true
  }'
```

---

## Listing Reviewers

```bash
curl "http://localhost:8000/api/reviewers?org_id=your-org-uuid"
```

---

## How the Notification Flow Works

```
Pipeline runs → ai_review → human_review_node
                                │
                    create_review_session() stores thread_id
                    generate_review_token() creates 24h token
                                │
                    For each active reviewer:
                      ├─ notify_slack=true + slack_user_id?
                      │    → Slack DM with review link
                      ├─ notify_discord=true + discord_user_id?
                      │    → Discord message with review link
                      └─ notify_email=true + email?
                           → HTML email with approve/reject/revise buttons
                                │
                    interrupt() pauses graph
                                │
                    Reviewer clicks link or button
                                │
                    POST /api/review/{token}/action
                                │
                    complete_review() updates DB
                    resume_review() resumes graph
                                │
                    approve → publish node → reply to source
                    reject → END
                    revise → write_docs → ai_review → ...
```

---

## Environment Variables Reference

| Variable | Required For | Default | Description |
|----------|-------------|---------|-------------|
| `SLACK_BOT_TOKEN` | Slack | `""` | Bot OAuth token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Slack | `""` | App signing secret |
| `DISCORD_BOT_TOKEN` | Discord | `""` | Bot token from Developer Portal |
| `DISCORD_PUBLIC_KEY` | Discord | `""` | App public key |
| `SENDGRID_API_KEY` | Email | `""` | SendGrid API key (`SG...`) |
| `SENDGRID_FROM_EMAIL` | Email | `noreply@draftly.app` | Verified sender email |
| `SENDGRID_FROM_NAME` | Email | `Draftly` | Sender display name |
| `REVIEW_DASHBOARD_URL` | All | `http://localhost:8000` | URL for review links in notifications |
| `SECRET_KEY` | Token signing | `change-me-in-production` | HMAC key for review tokens |

---

## Troubleshooting

### Slack: "not_authed" error
- Bot token is missing or invalid. Regenerate in Slack App → OAuth & Permissions.

### Slack: "channel_not_found" error
- The `slack_user_id` is incorrect, or the bot hasn't been invited to the workspace.
- Make sure you installed the app to the workspace (Step 3).

### Discord: 401 Unauthorized
- Bot token is wrong. Regenerate in Discord Developer Portal → Bot → Reset Token.

### Discord: 403 Forbidden
- Bot lacks permissions. Re-invite with `Send Messages` permission.

### Email: 403 from SendGrid
- API key is invalid or doesn't have "Mail Send" permission.
- Sender email is not verified.

### Email: Emails going to spam
- Complete domain authentication in SendGrid (Option B in Step 3).
- Add SPF, DKIM, and DMARC DNS records.

### Notifications not sending
- Check that the reviewer has `is_active=true`.
- Check that the correct notification toggle is enabled (`notify_slack`, `notify_discord`, `notify_email`).
- Check that the corresponding ID field is populated (`slack_user_id`, `discord_user_id`, `email`).
- Check server logs for `notification_failed` errors.
