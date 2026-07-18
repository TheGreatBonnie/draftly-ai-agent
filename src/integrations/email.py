from __future__ import annotations

import structlog
from jinja2 import Template
import httpx

from src.config import settings

logger = structlog.get_logger()

# Email template for review notifications
REVIEW_NOTIFICATION_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4A90D9; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .confidence { font-size: 24px; font-weight: bold; color: #4A90D9; }
        .question { background: #fff; padding: 15px; border-left: 4px solid #4A90D9; margin: 15px 0; }
        .actions { margin: 20px 0; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .btn-approve { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-revise { background: #ffc107; color: black; }
        .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
        .link { color: #4A90D9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 Documentation Review Required</h1>
        </div>
        <div class="content">
            <h2>{{ title }}</h2>
            <p><strong>Source:</strong> {{ source }}</p>
            <p><strong>Confidence:</strong> <span class="confidence">{{ confidence }}%</span></p>
            
            <div class="question">
                <strong>Original Question:</strong>
                <p>{{ question }}</p>
            </div>
            
            <div class="actions">
                <a href="{{ app_url }}/review/{{ token }}/approve" class="btn btn-approve">✓ Approve</a>
                <a href="{{ app_url }}/review/{{ token }}/reject" class="btn btn-reject">✗ Reject</a>
                <a href="{{ app_url }}/review/{{ token }}/revise" class="btn btn-revise">✎ Request Changes</a>
            </div>
            
            <p>Or <a href="{{ dashboard_url }}/review/{{ review_id }}" class="link">review in dashboard</a> for detailed editing.</p>
        </div>
        <div class="footer">
            <p>This review was requested by Draftly AI. Link expires in 24 hours.</p>
        </div>
    </div>
</body>
</html>
"""


async def send_email(to: str, subject: str, html_content: str) -> dict:
    """Send email via SendGrid API."""
    if not settings.sendgrid_api_key:
        logger.warning("sendgrid_not_configured")
        return {"ok": False, "error": "SendGrid not configured"}

    api_key = settings.sendgrid_api_key.get_secret_value()

    payload = {
        "personalizations": [
            {
                "to": [{"email": to}],
                "subject": subject,
            }
        ],
        "from": {
            "email": settings.sendgrid_from_email,
            "name": settings.sendgrid_from_name,
        },
        "content": [
            {
                "type": "text/html",
                "value": html_content,
            }
        ],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )

        if resp.status_code in (200, 201, 202):
            logger.info("email_sent", to=to, subject=subject)
            return {"ok": True}
        else:
            logger.error("email_failed", to=to, status=resp.status_code, error=resp.text)
            return {"ok": False, "error": resp.text}


async def send_review_notification(
    to: str,
    reviewer_name: str,
    state: dict,
    review_id: str,
    token: str,
) -> dict:
    """Send review notification email with quick action links."""
    title = state.get("draft_title", "Untitled")
    confidence = state.get("confidence_score", 0)
    source = state.get("source_type", "unknown")
    question = state["question"]

    template = Template(REVIEW_NOTIFICATION_TEMPLATE)
    html_content = template.render(
        reviewer_name=reviewer_name,
        title=title,
        source=source,
        confidence=f"{confidence:.0%}",
        question=question[:500] + ("..." if len(question) > 500 else ""),
        app_url=settings.app_url,
        dashboard_url=settings.review_dashboard_url,
        token=token,
        review_id=review_id,
    )

    subject = f"Review Required: {title}"

    return await send_email(to, subject, html_content)
