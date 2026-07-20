# Slack Block Kit Notification Enhancement Design

## Overview

Enhance the Slack notification message in `notify_reviewers()` from plain text markdown to a rich, interactive Block Kit card with inline actions and a feedback dropdown.

## Current State

The current Slack notification (lines 33-39 in `src/agents/nodes/human.py`) is a plain text markdown string:

```
📝 *Documentation Review Required*

*Title:* {title}
*Source:* {source}
*Confidence:* {confidence:.0%}

[Review Documentation]({dashboard_url})
Or use: `/approve {token}` | `/reject {token}` | `/revise {token}`
```

This same text is sent to both Slack and Discord. Email uses a separate rich HTML template.

## Goals

1. Replace plain text with a structured Block Kit card
2. Add interactive "Review Documentation" link button to dashboard
3. Add inline Approve/Reject/Revise buttons that trigger interactivity endpoint
4. Add a feedback dropdown for quick feedback selection
5. Include a truncated draft content preview (~500 chars) inline in the card
6. Maintain backward compatibility with existing review flow

## Design

### Block Kit Card Structure

```
┌─────────────────────────────────────────────────┐
│ 📝 Documentation Review Required                │
│ (Header block - blue accent)                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ Title: Fix authentication flow for mobile apps  │
│ Source: GitHub Issue #142                       │
│ Confidence: 85%                                 │
│                                                 │
│ (Section block with fields)                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ Draft Preview:                                  │
│ ```markdown                                     │
│ # Fix Authentication Flow                       │
│                                                 │
│ This document covers the auth flow changes...   │
│ (truncated to ~500 chars)                       │
│ ```                                             │
│                                                 │
│ (Section block with mrkdwn code block)          │
├─────────────────────────────────────────────────┤
│                                                 │
│ [ Read Full Draft ]                             │
│ (Primary action - button with dashboard URL)    │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ [ ✅ Approve ] [ ❌ Reject ] [ 🔄 Revise ]      │
│ (Action buttons - triggers interactivity)       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ Quick Feedback: [ Needs context ▼ ]             │
│ (Static select dropdown)                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Block Kit JSON Structure

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "📝 Documentation Review Required"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Title:* {title}"
        },
        {
          "type": "mrkdwn",
          "text": "*Source:* {source}"
        },
        {
          "type": "mrkdwn",
          "text": "*Confidence:* {confidence:.0%}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Draft Preview:*\n```markdown\n{truncated_draft_content}\n```"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Read Full Draft",
            "emoji": true
          },
          "url": "{dashboard_url}",
          "style": "primary"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "✅ Approve",
            "emoji": true
          },
          "action_id": "approve_review",
          "value": "{token}",
          "style": "primary"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "❌ Reject",
            "emoji": true
          },
          "action_id": "reject_review",
          "value": "{token}",
          "style": "danger"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "🔄 Revise",
            "emoji": true
          },
          "action_id": "revise_review",
          "value": "{token}"
        }
      ]
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Quick Feedback:*"
      },
      "accessory": {
        "type": "static_select",
        "placeholder": {
          "type": "plain_text",
          "text": "Select feedback option"
        },
        "action_id": "feedback_select",
        "options": [
          {
            "text": {
              "type": "plain_text",
              "text": "Needs more context"
            },
            "value": "needs_context"
          },
          {
            "text": {
              "type": "plain_text",
              "text": "Formatting issues"
            },
            "value": "formatting_issues"
          },
          {
            "text": {
              "type": "plain_text",
              "text": "Content unclear"
            },
            "value": "content_unclear"
          },
          {
            "text": {
              "type": "plain_text",
              "text": "Missing information"
            },
            "value": "missing_info"
          },
          {
            "text": {
              "type": "plain_text",
              "text": "Looks good, minor edits needed"
            },
            "value": "minor_edits"
          }
        ]
      }
    }
  ],
  "text": "Documentation Review Required: {title}"
}
```

### Interactivity Flow

1. User clicks a button (Approve/Reject/Revise) or selects from dropdown
2. Slack sends POST request to configured request URL
3. Endpoint receives: `{ type: "block_actions", user, actions, container }`
4. Extract action (`approve`/`reject`/`revise`) and `review_token` from action value
5. Call existing `POST /api/review/{token}/action` endpoint internally
6. Return Slack response to update message (optional: show confirmation)

### Files to Modify

1. **`src/integrations/slack.py`**
   - Update `send_slack_message()` to accept `blocks` parameter
   - Keep `text` parameter as fallback

2. **`src/agents/nodes/human.py`**
   - Update `notify_reviewers()` to build Block Kit JSON
   - Pass `draft_content` from state to card builder
   - Import block builder helper

### Files to Create

1. **`src/integrations/slack_blocks.py`**
   - Helper functions to build Block Kit JSON structures
   - `build_review_notification_card()` function

2. **`src/api/routes/slack.py`**
   - Interactivity endpoint: `POST /api/slack/interactivity`
   - Verify Slack request signature
   - Dispatch to existing review action logic

### Backward Compatibility

- `text` parameter remains as fallback for notifications
- Block Kit blocks added as new parameter
- Email template unchanged
- Discord continues to use plain text
- Token handling unchanged (HMAC-signed, 24hr expiry)

### Testing Strategy

**Unit tests:**
- Test Block Kit JSON builder produces valid structure
- Test draft content is truncated correctly at word boundary
- Test draft content with empty/null values falls back gracefully
- Test interactivity endpoint processes button clicks correctly
- Test feedback dropdown values are captured

**Integration tests:**
- Test `notify_reviewers()` sends Block Kit message with draft preview
- Test interactivity endpoint calls review action logic
- Test error handling when Slack API fails

**Manual verification:**
- Send test notification to Slack workspace
- Verify card renders correctly
- Click each button and verify behavior
- Select dropdown and verify feedback captured

### Design Decisions

1. **Feedback dropdown behavior**: Dropdown selection stores feedback but does NOT automatically trigger an action. User must still click an action button. This keeps the flow explicit and prevents accidental submissions.

2. **Message updates after action**: After an action button is clicked, update the message to show a confirmation (e.g., "✅ Approved by {user}") and disable the action buttons. This provides clear feedback to all reviewers.

3. **Interactivity fallback**: If Slack interactivity is not configured, fall back to the original plain text message with slash commands. This ensures notifications work even without interactivity setup.

4. **Draft content preview**: Truncate `draft_content` to ~500 characters at a word boundary, append `...` suffix, and render inside a fenced markdown code block (`\`\`\`markdown ... \`\`\``). This gives reviewers enough context to make an informed decision without overwhelming the card. A "Read Full Draft" button links to the full dashboard view. Slack's mrkdwn sections support up to 3,000 chars, well within the 500-char truncation limit.

## Success Criteria

- [ ] Slack notifications display as rich Block Kit cards
- [ ] "Read Full Draft" button links to dashboard
- [ ] Draft content preview shows truncated content (~500 chars) in a markdown code block
- [ ] Approve/Reject/Revise buttons trigger correct actions
- [ ] Feedback dropdown captures selection
- [ ] All existing tests pass
- [ ] New tests cover Block Kit builder, draft truncation, and interactivity
