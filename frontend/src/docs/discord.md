# Discord Integration

Draftly connects to your Discord server to monitor support conversations and generate documentation from community interactions. This guide covers bot setup, server linking, and the review workflow.

## Bot Setup

1. Go to **Settings** in the Draftly dashboard
2. Scroll to the **Discord Integration** section
3. Enter your **Guild ID** (server ID) in the input field
4. Click **Link** to connect your server
5. Copy the **Invite URL** and open it in your browser
6. Select your Discord server and authorize the bot

### Finding Your Guild ID

1. Open Discord Settings → Advanced → enable Developer Mode
2. Right-click your server name → Copy Server ID
3. This is your Guild ID

### Required Permissions

The bot requests permission integer **36932**, which includes:

| Permission | Purpose |
|------------|---------|
| Read Messages | Monitor channels for support conversations |
| Send Messages | Send review cards and responses |
| Read Message History | Access thread context |
| Use Slash Commands | Bot interaction commands |

## Configuring Trigger Channels

After linking your server, select which channels Draftly monitors:

1. Go to **Settings** → **Discord Integration**
2. You'll see a multi-select list of channels in your server
3. Select the channels where support conversations happen
4. Draftly listens for new messages in these channels

### Triggering Documentation

**@Mention:** Mention `@Draftly` in a support thread to flag it for documentation.

**Slash Command:** Use `/draftly` in a channel to trigger documentation generation from the current thread.

## Reviewing via Discord

When documentation is generated, Draftly sends an interactive embed to the channel:

- **View** — Link to the full document in the dashboard
- **Approve** — Publish the document
- **Revise** — Submit feedback for changes
- **Reject** — Discard the document

Review buttons appear as interactive components on the embed.

## Real-Time Event Handling

Draftly uses Discord's Gateway WebSocket for real-time event handling:

- **MESSAGE_CREATE** — Detects new messages in trigger channels
- **Auto-reconnect** — Maintains persistent connection with exponential backoff
- **Thread monitoring** — Tracks full conversation threads, not just individual messages

## Troubleshooting

### Bot not appearing in server

- Verify the invite URL includes the correct Guild ID
- Check that the bot has been authorized in your server
- Ensure the bot role has sufficient permissions in channel settings

### Not detecting messages

- Confirm the channel is listed as a trigger channel in Settings
- Check that the bot has Read Message permissions in that channel
- Verify the Discord Gateway connection is active (check server logs)

### Review embeds not sending

- Ensure the bot has Send Messages permission
- Check that the channel isn't read-only or rate-limited
- Look at the Draftly dashboard for any pipeline errors
