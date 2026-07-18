# GitHub App Bot Implementation Plan

**Project:** Draftly - Autonomous Documentation Engineering
**Feature:** GitHub App Bot for Issue Triage & Documentation Generation
**Date:** 2025-07-18
**Status:** In Progress

---

## Quick Start

### 1. Create GitHub App

1. Go to GitHub Settings > Developer Settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in:
   - **Name:** `draftly-bot`
   - **Homepage URL:** `https://your-app-url.com`
   - **Webhook URL:** `https://your-app-url.com/api/github/webhook`
   - **Webhook Secret:** Generate a strong random string
4. Set permissions:
   - Issues: Read & Write
   - Metadata: Read-only
5. Subscribe to events: Issues
6. Create app and download private key (.pem)

### 2. Configure Environment

Add to your `.env` file:
```bash
GITHUB_APP_ID=your-app-id
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
```

### 3. Install App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select repositories to install

---

## Executive Summary

Implement a GitHub App bot that automatically triages new issues using AI and triggers the full Draftly LangGraph pipeline to generate documentation. The bot will authenticate via JWT, receive webhooks, process issues through the 8-node pipeline, and post results back to GitHub.

---

## Architecture

### Current State
- LangGraph pipeline: 8 nodes (ingest → memory_retrieve → research → synthesize → write_docs → ai_review → human_review → publish)
- GitHub integration: Outbound only (post_github_comment, get_github_issue)
- Webhook handling: Not implemented
- Pipeline trigger: CLI only

### Target State
- GitHub App receives webhooks for new issues
- JWT authentication with private key
- Full pipeline execution with HITL
- Automatic comments and labels on GitHub issues

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub                                    │
│  ┌─────────────┐                                               │
│  │ New Issue   │──┐                                            │
│  │ Created     │  │                                            │
│  └─────────────┘  │                                            │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Webhook Endpoint                                       │
│  POST /api/github/webhook                                       │
│                                                                 │
│  1. Verify signature (HMAC SHA256)                              │
│  2. Parse event type                                            │
│  3. Extract issue data                                          │
│  4. Get installation token                                      │
│  5. Return 200 immediately                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Background Task: run_github_pipeline()                         │
│                                                                 │
│  1. Get/create organization                                     │
│  2. Build DocumentationState                                    │
│  3. Compile graph with checkpointer                             │
│  4. Invoke pipeline                                             │
│  5. Handle HITL interrupt                                       │
│  6. Post results to GitHub                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LangGraph Pipeline                                             │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │ Ingest │─▶│Memory  │─▶│Research│─▶│Synthe- │─▶│Write   │  │
│  │        │  │Retrieve│  │        │  │size    │  │Docs    │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────┬───┘  │
│                                                        │       │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐      │       │
│  │Publish │◀─│ Human  │◀─│   AI   │◀─┘        │◀─────┘       │
│  │        │  │ Review │  │ Review │                        │   │
│  └────┬───┘  └────────┘  └────────┘                        │   │
│       │                                                     │   │
│       └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Post-Pipeline Actions                                          │
│                                                                 │
│  1. Post comment with generated documentation                   │
│  2. Add labels (doc_type, confidence)                           │
│  3. Link to Draftly dashboard                                   │
│  4. Store embeddings for future reference                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Environment Configuration

**File:** `.env.example`

Add GitHub App credentials:
```bash
# GitHub App
GITHUB_APP_ID=your-app-id
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
```

**Dependencies:** No new dependencies required (using existing `pyjwt`, `httpx`)

---

### Phase 2: GitHub Authentication Module

**New File:** `src/integrations/github_app.py`

#### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `generate_jwt()` | `() -> str` | Create JWT signed with RSA private key for GitHub API authentication |
| `get_installation_token()` | `(installation_id: int) -> str` | Exchange JWT for temporary repository-specific access token |
| `verify_webhook_signature()` | `(payload: bytes, signature: str) -> bool` | Validate webhook authenticity using HMAC SHA256 |
| `get_installation_repositories()` | `(token: str) -> list[dict] | List repositories accessible by installation |

#### Implementation Details

**JWT Generation:**
```python
def generate_jwt() -> str:
    """Generates a JSON Web Token signed with the App's private key."""
    payload = {
        "iat": int(time.time()) - 60,  # Issued at (60s ago for clock skew)
        "exp": int(time.time()) + (10 * 60),  # Expires in 10 minutes
        "iss": APP_ID  # GitHub App ID
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")
```

**Installation Token:**
```python
def get_installation_token(installation_id: int) -> str:
    """Swaps the global App JWT for a temporary, repository-specific access token."""
    jwt_token = generate_jwt()
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json"
    }
    response = requests.post(url, headers=headers)
    response.raise_for_status()
    return response.json()["token"]
```

**Signature Verification:**
```python
def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Secures webhook endpoint by validating traffic originates from GitHub."""
    if not signature:
        return False
    sha_name, signature_val = signature.split('=')
    if sha_name != 'sha256':
        return False
    mac = hmac.new(WEBHOOK_SECRET, msg=payload, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature_val)
```

---

### Phase 3: GitHub Webhook Router

**New File:** `src/api/routes/github.py`

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/github/webhook` | POST | Receive and process GitHub webhook events |

#### Event Handling Flow

```python
@router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    # 1. Read raw body for signature verification
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    # 2. Verify webhook signature
    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 3. Parse payload
    payload = json.loads(body)
    event_type = request.headers.get("X-GitHub-Event")

    # 4. Handle issue events
    if event_type == "issues" and payload.get("action") == "opened":
        installation_id = payload["installation"]["id"]

        # Get installation token
        token = get_installation_token(installation_id)

        # Offload to background task (GitHub timeout is 10s)
        background_tasks.add_task(
            run_github_pipeline,
            payload=payload,
            installation_token=token
        )
        return {"status": "Processing issue event"}

    return {"status": "Event ignored"}
```

#### Request/Response Models

```python
from pydantic import BaseModel

class WebhookResponse(BaseModel):
    status: str

class IssueData(BaseModel):
    owner: str
    repo: str
    issue_number: int
    title: str
    body: str
    labels: list[str]
    author: str
```

---

### Phase 4: GitHub Pipeline Runner

**New File:** `src/agents/runners/github_runner.py`

#### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `run_github_pipeline()` | `(payload: dict, installation_token: str) -> None` | Orchestrate full pipeline for GitHub issue |
| `build_github_state()` | `(payload: dict, org_id: str) -> DocumentationState` | Build initial state from GitHub issue data |
| `post_github_results()` | `(state: DocumentationState, token: str) -> None` | Post pipeline results back to GitHub |

#### Pipeline Orchestration

```python
async def run_github_pipeline(payload: dict, installation_token: str):
    """Orchestrate the full Draftly pipeline for a GitHub issue."""
    try:
        # 1. Extract issue data
        issue = payload["issue"]
        repo = payload["repository"]
        owner = repo["owner"]["login"]
        repo_name = repo["name"]
        installation_id = payload["installation"]["id"]

        # 2. Get or create organization
        org_id = await get_or_create_org(
            github_org=repo["owner"]["login"],
            name=repo["owner"]["login"]
        )

        # 3. Build initial state
        state = build_github_state(
            payload=payload,
            org_id=org_id
        )

        # 4. Compile and run graph
        checkpointer = AsyncCockroachDBSaver.from_conn_string(
            settings.cockroachdb_url
        )
        graph = build_graph().compile(checkpointer=checkpointer)

        config = {"configurable": {"thread_id": f"github-{repo['id']}-{issue['number']}"}}

        # 5. Invoke pipeline
        result = await graph.ainvoke(state, config)

        # 6. Handle HITL interrupt if present
        if result.get("human_decision") == "":
            # Pipeline paused for human review
            # Store workflow for later resume
            await store_workflow_for_resume(
                org_id=org_id,
                workflow_id=result.get("workflow_id"),
                github_context={
                    "owner": owner,
                    "repo": repo_name,
                    "issue_number": issue["number"],
                    "installation_id": installation_id,
                    "token": installation_token
                }
            )
        else:
            # Pipeline completed, post results
            await post_github_results(
                state=result,
                owner=owner,
                repo=repo_name,
                issue_number=issue["number"],
                token=installation_token
            )

    except Exception as e:
        logger.error("github_pipeline_failed", error=str(e))
        # Post error comment to GitHub
        await post_error_comment(owner, repo_name, issue["number"], installation_token)
```

#### State Builder

```python
def build_github_state(payload: dict, org_id: str) -> DocumentationState:
    """Build initial DocumentationState from GitHub issue data."""
    issue = payload["issue"]
    repo = payload["repository"]

    # Combine title and body for the question
    question = f"{issue['title']}\n\n{issue.get('body', '')}"

    return {
        "org_id": org_id,
        "source": "github",
        "channel_id": f"{repo['full_name']}",
        "thread_id": str(issue["number"]),
        "question": question,
        # Initialize all other fields to defaults
        "similar_threads": [],
        "existing_docs": [],
        "reviewer_feedback_history": [],
        "semantic_context": [],
        "github_context": [],
        "slack_context": [],
        "knowledge_package": {},
        "draft_content": "",
        "draft_title": "",
        "doc_type": "howto",
        "confidence_score": 0.0,
        "review_result": {},
        "review_feedback": "",
        "human_decision": "",
        "human_feedback": "",
        "published_urls": [],
        "support_thread_id": "",
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
    }
```

#### Results Poster

```python
async def post_github_results(
    state: DocumentationState,
    owner: str,
    repo: str,
    issue_number: int,
    token: str
):
    """Post pipeline results back to GitHub as comment and labels."""
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json"
    }

    # 1. Build comment with documentation
    comment_body = f"""## Generated Documentation

**Title:** {state['draft_title']}
**Type:** {state['doc_type']}
**Confidence:** {state['confidence_score']:.0%}

---

{state['draft_content']}

---

*This documentation was automatically generated by [Draftly](https://draftly.ai) from this issue.*
*Review status: {state.get('review_result', {}).get('status', 'pending')}*
"""

    # 2. Post comment
    comment_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments"
    await httpx.AsyncClient().post(comment_url, headers=headers, json={"body": comment_body})

    # 3. Add labels
    labels = [state["doc_type"]]
    if state["confidence_score"] >= 0.7:
        labels.append("high-confidence")
    else:
        labels.append("needs-review")

    label_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/labels"
    await httpx.AsyncClient().post(label_url, headers=headers, json={"labels": labels})

    logger.info("github_results_posted", owner=owner, repo=repo, issue=issue_number)
```

---

### Phase 5: Organization Management

**New File:** `src/memory/organizations.py`

#### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `get_or_create_org()` | `(github_org: str, name: str) -> str` | Get existing org or create new one |
| `get_org_by_github()` | `(github_org: str) -> dict | None` | Find org by GitHub org name |

```python
async def get_or_create_org(github_org: str, name: str) -> str:
    """Get or create organization for GitHub repo."""
    # Try to find existing org
    existing = await fetch_one(
        "SELECT id::text FROM organizations WHERE github_org = $1",
        github_org
    )
    if existing:
        return existing["id"]

    # Create new org
    org_id = await fetch_val(
        "INSERT INTO organizations (name, github_org) VALUES ($1, $2) RETURNING id::text",
        name,
        github_org
    )
    return org_id
```

---

### Phase 6: Update Publish Node

**File:** `src/agents/nodes/publish.py`

Add GitHub-specific publish logic:

```python
# In publish_node function, add after existing publish logic:

# Post to GitHub if source is github
if state.get("source") == "github":
    from src.integrations.github_app import get_installation_token
    from src.agents.runners.github_runner import post_github_results

    # Get installation token from workflow context
    workflow_context = await get_workflow_context(state.get("workflow_id"))
    if workflow_context:
        token = get_installation_token(workflow_context["installation_id"])
        await post_github_results(
            state=state,
            owner=workflow_context["owner"],
            repo=workflow_context["repo"],
            issue_number=workflow_context["issue_number"],
            token=token
        )
```

---

### Phase 7: Register Routes

**File:** `src/api/app.py`

Add GitHub router:

```python
from src.api.routes import github

app.include_router(github.router, prefix="/api/github", tags=["github"])
```

---

## Database Changes

### New Table: `github_installations`

```sql
CREATE TABLE IF NOT EXISTS github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    installation_id INT NOT NULL UNIQUE,
    github_org STRING NOT NULL,
    repositories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now() ON UPDATE now()
);

CREATE INDEX idx_installations_org ON github_installations(org_id);
CREATE INDEX idx_installations_github_org ON github_installations(github_org);
```

### New Table: `github_workflows`

```sql
CREATE TABLE IF NOT EXISTS github_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL,
    installation_id INT NOT NULL,
    owner STRING NOT NULL,
    repo STRING NOT NULL,
    issue_number INT NOT NULL,
    status STRING DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_github_workflows_status ON github_workflows(status);
```

---

## Testing Strategy

### Unit Tests

| Test File | Tests |
|-----------|-------|
| `tests/test_github_app.py` | JWT generation, signature verification, token exchange |
| `tests/test_github_runner.py` | State building, pipeline orchestration |
| `tests/test_github_webhook.py` | Webhook endpoint, event handling |

### Integration Tests

| Test | Purpose |
|------|---------|
| Webhook → Pipeline → GitHub | End-to-end flow with mock GitHub API |
| HITL Resume | Test workflow resumption after human review |
| Error Handling | Test error scenarios (invalid signature, API failures) |

### Test Commands

```bash
# Run all GitHub-related tests
uv run pytest tests/ -v -k github

# Run specific test file
uv run pytest tests/test_github_app.py -v
```

---

## Deployment

### Local Development

```bash
# 1. Start ngrok
ngrok http 8000

# 2. Update webhook URL in GitHub App settings
# Use the https://... URL from ngrok

# 3. Run server
uv run uvicorn src.api.app:app --reload
```

### Production

1. Update GitHub App webhook URL to production domain
2. Store private key in AWS Secrets Manager or environment variable
3. Deploy with existing CI/CD pipeline

---

## Security Considerations

1. **Webhook Signature Verification** - Always validate HMAC SHA256 signature
2. **JWT Expiration** - GitHub JWTs expire after 10 minutes
3. **Installation Tokens** - Expire after 1 hour, refresh as needed
4. **Private Key Storage** - Never commit to git, use secrets manager
5. **Rate Limiting** - GitHub API has rate limits, implement backoff

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Webhook processing time | < 5 seconds |
| Pipeline completion time | < 5 minutes |
| Documentation accuracy | >= 80% confidence |
| GitHub comment success rate | >= 99% |

---

## Future Enhancements

1. **PR Review** - Auto-review pull requests
2. **Issue Updates** - Update comments when issue is edited
3. **Label Sync** - Sync Draftly labels with GitHub
4. **Multi-Repo** - Process issues across multiple repos
5. **Batch Processing** - Handle multiple issues concurrently

---

## Implementation Checklist

- [ ] Phase 1: Environment configuration
- [ ] Phase 2: GitHub authentication module
- [ ] Phase 3: GitHub webhook router
- [ ] Phase 4: GitHub pipeline runner
- [ ] Phase 5: Organization management
- [ ] Phase 6: Update publish node
- [ ] Phase 7: Register routes
- [ ] Database migrations
- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation
- [ ] Deployment
