from __future__ import annotations


def _truncate_draft(content: str, max_chars: int = 500) -> str:
    """Truncate draft content to max_chars at a word boundary."""
    if len(content) <= max_chars:
        return content
    truncated = content[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > max_chars // 2:
        truncated = truncated[:last_space]
    return truncated + "..."


def build_review_notification_card(
    title: str,
    source: str,
    confidence: float,
    dashboard_url: str,
    review_token: str,
    draft_content: str = "",
) -> dict:
    """Build a Block Kit card for documentation review notifications."""
    truncated_draft = _truncate_draft(draft_content)
    draft_preview = f"*Draft Preview:*\n```markdown\n{truncated_draft}\n```"

    return {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "\U0001f4dd Documentation Review Required",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Title:* {title}"},
                    {"type": "mrkdwn", "text": f"*Source:* {source}"},
                    {"type": "mrkdwn", "text": f"*Confidence:* {confidence:.0%}"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": draft_preview,
                },
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Read Full Draft",
                            "emoji": True,
                        },
                        "url": dashboard_url,
                        "style": "primary",
                    },
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "\u2705 Approve",
                            "emoji": True,
                        },
                        "action_id": "approve_review",
                        "value": review_token,
                        "style": "primary",
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "\u274c Reject",
                            "emoji": True,
                        },
                        "action_id": "reject_review",
                        "value": review_token,
                        "style": "danger",
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "\U0001f504 Revise",
                            "emoji": True,
                        },
                        "action_id": "revise_review",
                        "value": review_token,
                    },
                ],
            },
            {"type": "divider"},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*Quick Feedback:*"},
                "accessory": {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select feedback option",
                    },
                    "action_id": "feedback_select",
                    "options": [
                        {
                            "text": {"type": "plain_text", "text": "Needs more context"},
                            "value": "needs_context",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Formatting issues"},
                            "value": "formatting_issues",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Content unclear"},
                            "value": "content_unclear",
                        },
                        {
                            "text": {"type": "plain_text", "text": "Missing information"},
                            "value": "missing_info",
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Looks good, minor edits needed",
                            },
                            "value": "minor_edits",
                        },
                    ],
                },
            },
        ],
        "text": f"Documentation Review Required: {title}",
    }
