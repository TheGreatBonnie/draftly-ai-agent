# Implementation Plan: Reviewer Notification Preferences

**Date:** 2025-07-19
**Feature:** Email notifications and reviewer platform preference selection
**Status:** Ready for implementation

---

## Overview

Add reviewer management with notification preferences (Slack, Discord, Email) and auto-assign all active org reviewers when human review is needed. Reviewers can select their preferred notification platform and use secure token links for quick actions.

---

## User Decisions

| Decision | Choice |
|----------|--------|
| Storage approach | Dedicated `reviewers` table |
| Email provider | SendGrid |
| Assignment logic | Auto-assign to all org reviewers |
| Quick actions | Both secure token links + dashboard login |

---

## Phase 1: Database Schema

### 1.1 Create reviewers table

**File:** `infrastructure/cockroachdb/schema.sql`

```sql
-- 9. Reviewers (notification recipients)
CREATE TABLE IF NOT EXISTS reviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name STRING NOT NULL,
    email STRING,
    slack_user_id STRING,
    discord_user_id STRING,
    notification_channel STRING DEFAULT 'slack' CHECK (notification_channel IN ('slack', 'discord', 'email')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now() ON UPDATE now()
);

CREATE INDEX IF NOT EXISTS idx_reviewers_org ON reviewers(org_id);
CREATE INDEX IF NOT EXISTS idx_reviewers_active ON reviewers(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewers_email_org ON reviewers(org_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewers_slack_org ON reviewers(org_id, slack_user_id) WHERE slack_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviewers_discord_org ON reviewers(org_id, discord_user_id) WHERE discord_user_id IS NOT NULL;
```

### 1.2 Update review_sessions foreign key

```sql
ALTER TABLE review_sessions ADD CONSTRAINT fk_reviewer 
    FOREIGN KEY (reviewer_id) REFERENCES reviewers(id) ON DELETE SET NULL;
```

### 1.3 Create migration file

**File:** `infrastructure/cockroachdb/migrations/002_add_reviewers.sql`

---

## Phase 2: Configuration

### 2.1 Add SendGrid settings

**File:** `src/config.py`

```python
# Email (SendGrid)
sendgrid_api_key: SecretStr = SecretStr("")
sendgrid_from_email: str = "noreply@draftly.app"
sendgrid_from_name: str = "Draftly"
```

### 2.2 Update .env.example

**File:** `.env.example`

```bash
# Email (SendGrid)
SEND_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@draftly.app
SENDGRID_FROM_NAME=Draftly
```

---

## Phase 3: Email Integration

### 3.1 Create email module

**File:** `src/integrations/email.py`

Functions:
- `send_email(to: str, subject: str, html_content: str) -> dict`
- `send_review_notification(reviewer, state, review_id, token) -> dict`

### 3.2 Create email templates

**File:** `src/api/templates/emails/review_notification.html`

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
        .header { background: #4A90D9; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .confidence { font-size: 24px; font-weight: bold; }
        .actions { margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; margin: 5px; text-decoration: none; border-radius: 5px; }
        .btn-approve { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-revise { background: #ffc107; color: black; }
        .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
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
            <p><strong>Original Question:</strong></p>
            <blockquote>{{ question }}</blockquote>
            
            <div class="actions">
                <a href="{{ app_url }}/review/{{ token }}/approve" class="btn btn-approve">✓ Approve</a>
                <a href="{{ app_url }}/review/{{ token }}/reject" class="btn btn-reject">✗ Reject</a>
                <a href="{{ app_url }}/review/{{ token }}/revise" class="btn btn-revise">✎ Request Changes</a>
            </div>
            
            <p>Or <a href="{{ dashboard_url }}/review/{{ review_id }}">review in dashboard</a> for detailed editing.</p>
        </div>
        <div class="footer">
            <p>This review was requested by Draftly AI. Link expires in 24 hours.</p>
        </div>
    </div>
</body>
</html>
```

---

## Phase 4: Reviewer Management

### 4.1 Create reviewer memory module

**File:** `src/memory/reviewers.py`

Functions:
```python
async def create_reviewer(
    org_id: str,
    name: str,
    email: str | None = None,
    slack_user_id: str | None = None,
    discord_user_id: str | None = None,
    notification_channel: str = "slack",
) -> dict

async def get_reviewers_by_org(
    org_id: str,
    active_only: bool = True,
) -> list[dict]

async def get_reviewer_by_id(reviewer_id: str) -> dict | None

async def update_reviewer(
    reviewer_id: str,
    **kwargs,
) -> dict

async def delete_reviewer(reviewer_id: str) -> bool

async def get_active_reviewer_ids(org_id: str) -> list[str]
```

### 4.2 Create reviewer API endpoints

**File:** `src/api/routes/reviewers.py`

Endpoints:
- `POST /api/reviewers` - Create reviewer
- `GET /api/reviewers` - List org reviewers
- `GET /api/reviewers/{reviewer_id}` - Get reviewer
- `PUT /api/reviewers/{reviewer_id}` - Update reviewer
- `DELETE /api/reviewers/{reviewer_id}` - Delete reviewer

---

## Phase 5: Secure Token System

### 5.1 Create token module

**File:** `src/security/tokens.py`

```python
import hashlib
import hmac
import json
import base64
from datetime import datetime, timedelta

SECRET_KEY = settings.secret_key  # Add to config

def generate_review_token(
    reviewer_id: str,
    review_id: str,
    expiry_hours: int = 24,
) -> str:
    """Generate time-limited token for quick actions."""
    payload = {
        "reviewer_id": reviewer_id,
        "review_id": review_id,
        "expires_at": (datetime.utcnow() + timedelta(hours=expiry_hours)).isoformat(),
    }
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{signature}"

def verify_review_token(token: str) -> dict | None:
    """Verify and decode review token. Returns None if invalid/expired."""
    try:
        data, signature = token.split(".")
        expected = hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(data))
        if datetime.fromisoformat(payload["expires_at"]) < datetime.utcnow():
            return None
        return payload
    except Exception:
        return None
```

### 5.2 Add secret key to config

**File:** `src/config.py`

```python
secret_key: str = "change-me-in-production"
```

---

## Phase 6: Notification System

### 6.1 Update human review node

**File:** `src/agents/nodes/human.py`

```python
async def notify_reviewers(state: DocumentationState, review_id: str):
    """Notify all active org reviewers based on their preferences."""
    from src.memory.reviewers import get_reviewers_by_org
    from src.security.tokens import generate_review_token
    from src.integrations.email import send_review_notification
    from src.integrations.slack import send_slack_message
    from src.integrations.discord import send_discord_message
    
    reviewers = await get_reviewers_by_org(state["org_id"])
    title = state.get("draft_title", "Untitled")
    confidence = state.get("confidence_score", 0)
    source = state.get("source_type", "unknown")
    question = state["question"]
    
    results = {}
    
    for reviewer in reviewers:
        token = generate_review_token(reviewer["id"], review_id)
        dashboard_url = f"{settings.review_dashboard_url}/review/{token}"
        
        message = (
            f"📝 *Documentation Review Required*\n\n"
            f"*Title:* {title}\n"
            f"*Source:* {source}\n"
            f"*Confidence:* {confidence:.0%}\n\n"
            f"[Review Documentation]({dashboard_url})\n"
            f"Or use: `/approve {token}` | `/reject {token}` | `/revise {token}`"
        )
        
        try:
            if reviewer["notification_channel"] == "slack" and reviewer.get("slack_user_id"):
                await send_slack_message(reviewer["slack_user_id"], message)
                results[reviewer["id"]] = {"channel": "slack", "status": "sent"}
                
            elif reviewer["notification_channel"] == "discord" and reviewer.get("discord_user_id"):
                await send_discord_message(reviewer["discord_user_id"], message)
                results[reviewer["id"]] = {"channel": "discord", "status": "sent"}
                
            elif reviewer["notification_channel"] == "email" and reviewer.get("email"):
                await send_review_notification(
                    to=reviewer["email"],
                    reviewer_name=reviewer["name"],
                    state=state,
                    review_id=review_id,
                    token=token,
                )
                results[reviewer["id"]] = {"channel": "email", "status": "sent"}
                
        except Exception as e:
            logger.error("notification_failed", reviewer_id=reviewer["id"], error=str(e))
            results[reviewer["id"]] = {"status": "failed", "error": str(e)}
    
    return results
```

### 6.2 Update human_review_node to call notifications

```python
async def human_review_node(state: DocumentationState) -> dict:
    # ... existing code ...
    
    review_id = await create_review_session(
        doc_id=doc_id,
        confidence_before=state.get("confidence_score", 0),
    )
    
    # NEW: Notify reviewers
    notification_results = await notify_reviewers(state, review_id)
    logger.info("notifications_sent", results=notification_results)
    
    # ... rest of existing code ...
```

---

## Phase 7: Quick Action Endpoints

### 7.1 Create review action endpoints

**File:** `src/api/routes/review.py`

```python
from fastapi import APIRouter, HTTPException
from src.security.tokens import verify_review_token
from src.memory.reviewers import get_reviewer_by_id
from src.memory.reviewer import update_review_status

router = APIRouter()

@router.get("/{token}")
async def get_review_by_token(token: str):
    """Verify token and return review details."""
    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    reviewer = await get_reviewer_by_id(payload["reviewer_id"])
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    
    return {
        "review_id": payload["review_id"],
        "reviewer": reviewer,
        "expires_at": payload["expires_at"],
    }

@router.post("/{token}/action")
async def execute_quick_action(token: str, action: str, feedback: str = ""):
    """Execute approve/reject/revise action via token."""
    if action not in ("approve", "reject", "revise"):
        raise HTTPException(status_code=400, detail="Invalid action")
    
    payload = verify_review_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    await update_review_status(
        review_id=payload["review_id"],
        reviewer_id=payload["reviewer_id"],
        status="approved" if action == "approve" else "rejected" if action == "reject" else "needs_changes",
        feedback=feedback,
    )
    
    return {"status": "success", "action": action}
```

---

## Phase 8: Tests

### 8.1 Reviewer tests

**File:** `tests/test_reviewers.py`

Test cases:
- Create reviewer with all fields
- Create reviewer with minimal fields
- List reviewers by org
- Update reviewer preferences
- Delete reviewer
- Get active reviewer IDs

### 8.2 Email tests

**File:** `tests/test_email.py`

Test cases:
- Send review notification email
- Handle SendGrid API errors
- Email template rendering

### 8.3 Token tests

**File:** `tests/test_tokens.py`

Test cases:
- Generate and verify valid token
- Reject expired token
- Reject tampered token

### 8.4 Notification tests

**File:** `tests/test_notifications.py`

Test cases:
- Notify reviewers on all channels
- Handle partial failures
- Skip inactive reviewers

---

## Implementation Order

| Step | Task | Branch | Estimated Time |
|------|------|--------|----------------|
| 1 | Database schema (reviewers table) | `feature/reviewers-schema` | 30 min |
| 2 | Config updates (SendGrid + secret key) | `feature/reviewers-config` | 15 min |
| 3 | Email integration (SendGrid) | `feature/email-integration` | 1 hour |
| 4 | Reviewer memory/CRUD | `feature/reviewers-crud` | 1 hour |
| 5 | Reviewer API endpoints | `feature/reviewers-api` | 1 hour |
| 6 | Secure token system | `feature/secure-tokens` | 45 min |
| 7 | Notification sending in human node | `feature/review-notifications` | 1.5 hours |
| 8 | Quick action endpoints | `feature/quick-actions` | 1 hour |
| 9 | Tests | `feature/reviewers-tests` | 1 hour |
| 10 | Documentation update | `docs/reviewers` | 30 min |

**Total estimated time:** ~8.5 hours

---

## Dependencies

- SendGrid account and API key
- Existing Slack/Discord integrations (already implemented)
- Existing review_sessions table (already exists)

---

## Success Criteria

1. Reviewers can be created with notification preferences
2. All active reviewers receive notifications when review is needed
3. Notifications sent via selected platform (Slack/Discord/Email)
4. Quick action links work for approve/reject/revise
5. Dashboard shows reviewer assignments
6. All tests pass

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SendGrid API limits | Implement rate limiting, queue notifications |
| Token security | Use HMAC signing, short expiry (24h) |
| Notification failures | Log errors, continue processing other reviewers |
| Duplicate notifications | Track notification status in review_sessions |
