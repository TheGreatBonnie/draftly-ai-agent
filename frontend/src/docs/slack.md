# Slack Integration

Draftly connects to your Slack workspace to monitor support conversations and generate documentation from them. This guide walks you through installation, configuration, and daily usage.

## Installing the Slack App

1. Go to **Settings** in the Draftly dashboard
2. Scroll to the **Slack Integration** section
3. Click **Install to Slack** — this opens Slack's OAuth flow
4. Review the requested permissions and authorize the app
5. You'll be redirected back to Draftly with Slack connected

### Required Permissions

Draftly requests these Slack scopes:

| Scope | Purpose |
|-------|---------|
| `channels:history` | Read messages in public channels |
| `groups:history` | Read messages in private channels |
| `chat:write` | Send messages and review cards |
| `files:write` | Upload files when needed |
| `users:read` | Look up user information |

## Configuring Channels

After installation, you need to tell Draftly which channels to monitor:

1. Go to **Settings** → **Slack Integration**
2. You'll see a list of channels in your workspace
3. Select the channels where support conversations happen
4. Draftly will start listening for new messages in those channels

### Triggering Documentation

There are two ways to trigger documentation generation:

**Bot Mention:** Mention `@Draftly` in a support thread with your question or request.

**Manual Trigger:** React to a message with a specific emoji (configurable in settings) to flag it for documentation generation.

## Reviewing via Slack

When Draftly generates documentation, it sends an interactive review card to the channel:

- **View Document** — Click to see the full generated doc in the dashboard
- **Approve** — Click to publish immediately
- **Request Changes** — Opens a text input for feedback
- **Reject** — Discard the document

Review cards use Slack's Block Kit interactive buttons. You can review without leaving Slack.

## Notification Settings

Configure when Draftly sends notifications:

- **Review Ready** — Notified when a document is ready for review
- **Doc Published** — Notified when a document is approved and published
- **Errors** — Notified if the pipeline fails

These can be toggled per reviewer in the **Reviewers** page.

## Troubleshooting

### Bot not responding

- Verify the bot is installed in your workspace (check Slack App Settings)
- Ensure the bot has been added to the channel (`/invite @Draftly`)
- Check that the channel is selected in Draftly's Settings

### Review cards not appearing

- Verify Draftly has `chat:write` permission
- Check that the channel isn't archived
- Look at the Draftly dashboard for any pipeline errors

### Wrong channel being monitored

- Go to Settings → Slack Integration and update your channel selection
- Changes take effect immediately for new conversations
