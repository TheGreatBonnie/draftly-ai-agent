# Discord Bot Setup Guide

Step-by-step instructions to create and configure a Discord bot for Draftly review notifications.

## Prerequisites

- A Discord account
- A Discord server where you have **Manage Server** permissions
- The Draftly app running locally or deployed

---

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** in the top-right
3. Enter a name (e.g., `Draftly`) and click **Create**
4. Note the **Application ID** on the General Information page (used for reference only)

---

## Step 2: Create the Bot

1. In the left sidebar, click **Bot**
2. Click **Add Bot** → confirm with **Yes, do it!**
3. Under the bot's username, click **Reset Token** to generate a new token
4. Copy the token immediately — you won't be able to see it again
5. This is your `DISCORD_BOT_TOKEN`

### Bot Permissions (Privileged Gateway Intents)

Under **Privileged Gateway Intents**, keep all toggles **off** (Draftly uses the REST API only, no gateway connection required):

- PRESENCE INTENT → Off
- SERVER MEMBERS INTENT → Off
- MESSAGE CONTENT INTENT → Off

---

## Step 3: Get the Public Key

1. In the left sidebar, click **General Information**
2. Copy the **Public Key** value
3. This is your `DISCORD_PUBLIC_KEY` (used for Ed25519 interaction signature verification)

---

## Step 4: Configure Environment Variables

Add to your `.env` file:

```env
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_PUBLIC_KEY=your-public-key-here
```

Verify they load correctly:

```bash
python3 -c "from src.config import settings; print('Bot token set:', bool(settings.discord_bot_token.get_secret_value())); print('Public key set:', bool(settings.discord_public_key.get_secret_value()))"
```

---

## Step 5: Invite the Bot to Your Server

1. In the Developer Portal, go to **OAuth2** → **URL Generator**
2. Under **Scopes**, check `bot`
3. Under **Bot Permissions**, check:
   - **Send Messages** (required)
   - **Send Messages in Threads** (required for thread replies)
   - **Use Slash Commands** (optional, for future use)
4. Copy the generated URL at the bottom of the page
5. Open the URL in your browser
6. Select your Discord server from the dropdown
7. Click **Authorize**

The bot should now appear in your server's member list (offline until it sends a message).

---

## Step 6: Set Up Reviewers

Each reviewer needs their Discord user ID stored in Draftly.

### Getting a Discord User ID

1. In Discord, go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click any user → **Copy User ID**

### Option A: Self-Registration (Reviewer)

In the Draftly frontend:

1. Navigate to **Reviewers** page
2. Click **Self Register**
3. Enter your Discord user ID
4. Toggle **Notify via Discord** on
5. Submit

### Option B: Admin Creates Reviewer

```bash
curl -X POST http://localhost:8000/api/reviewers \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "discord_user_id": "123456789012345678",
    "notify_discord": true
  }'
```

### Option C: Update Existing Reviewer

```bash
curl -X PUT http://localhost:8000/api/reviewers/<reviewer-id> \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "discord_user_id": "123456789012345678",
    "notify_discord": true
  }'
```

---

## Step 7: Test the Integration

1. Ensure the Draftly server is running:

   ```bash
   uv run uvicorn src.api.app:app --reload
   ```

2. Run the pipeline with a test question:

   ```bash
   uv run python -m src.cli.draftly "How do I configure SSO?" --org-id <your-org-id>
   ```

3. Check the reviewer's Discord DMs — they should receive an interactive card with:
   - Document title, source, and confidence score
   - Draft preview in a code block
   - **Approve**, **Reject**, and **Revise** buttons
   - Quick feedback dropdown

4. Click a button — the message should update to show the result (green for approved, red for rejected, yellow for needs changes).

---

## Troubleshooting

### Bot doesn't send messages

- Verify `DISCORD_BOT_TOKEN` is set correctly in `.env`
- Ensure the bot is in the server (check member list)
- Check bot permissions include **Send Messages**
- Review server logs for `discord_send_failed` errors

### Messages arrive as plain text (no buttons)

- This means the interactive endpoint isn't being used yet
- Ensure Unit 3 (Discord interactions endpoint) is implemented
- Check that `/api/discord/interactions` is registered in `src/api/app.py`

### Button clicks don't work

- Verify `DISCORD_PUBLIC_KEY` is set correctly
- Ensure the interactions endpoint is reachable from the internet (use ngrok for local dev)
- Check that Discord's Interactions Endpoint URL is configured (see Step 3 below)

### Discord Interactions Endpoint URL (for production)

For button clicks to work, Discord needs to know where to send interactions:

1. In the Developer Portal, go to **General Information**
2. Under **Interactions Endpoint URL**, enter:
   ```
   https://your-app-url.com/api/discord/interactions
   ```
3. Discord will send a PING to verify — the endpoint must be live and responding
4. For local development, use ngrok:
   ```bash
   ngrok http 8000
   ```
   Then set the ngrok URL (e.g., `https://abc123.ngrok.io/api/discord/interactions`)

### Token expired errors

- HMAC review tokens expire after 24 hours
- This is expected — reviewers must act within the window
- The dashboard link always works regardless of token expiry

---

## Bot Permissions Summary

| Permission               | Required | Purpose                          |
| ------------------------ | -------- | -------------------------------- |
| Send Messages            | Yes      | Send review notifications via DM |
| Send Messages in Threads | Yes      | Reply to originating threads     |
| Use Slash Commands       | No       | Reserved for future use          |
| Read Message History     | No       | Not needed (REST API only)       |
| Manage Messages          | No       | Not needed                       |

---

## Server Setup Checklist

- [ ] Discord application created
- [ ] Bot created with token copied
- [ ] Public key copied
- [ ] `DISCORD_BOT_TOKEN` set in `.env`
- [ ] `DISCORD_PUBLIC_KEY` set in `.env`
- [ ] Bot invited to Discord server with correct permissions
- [ ] Interactions endpoint URL configured (for button functionality)
- [ ] At least one reviewer with `discord_user_id` and `notify_discord=true`
- [ ] Test notification received in Discord DM
- [ ] Button clicks successfully update the message
