# Workflow Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between the described workflow in `context/WORKFLOW.md` and the actual implementation, enabling full inbound tracking, web-based research, and outbound delivery across GitHub, Slack, and Discord.

**Architecture:** Extend the existing FastAPI app with webhook endpoints for Slack and Discord, add web search tools for research, implement outbound delivery in the publish node, and add human review notifications via platform messages.

**Tech Stack:** Python, FastAPI, httpx, LangGraph, CockroachDB, GitHub API, Slack API, Discord API, SerpAPI/Google Custom Search

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/api/routes/slack.py` | Slack webhook endpoint (events API) |
| `src/api/routes/discord.py` | Discord webhook endpoint (interactions) |
| `src/agents/tools/web_tools.py` | Web search and documentation search tools |
| `src/agents/nodes/human.py` | Add platform notifications for review |
| `src/agents/nodes/publish.py` | Implement outbound delivery to all platforms |
| `src/integrations/slack.py` | Add thread reply and block message functions |
| `src/integrations/discord.py` | Add embed message function |
| `tests/test_slack_webhook.py` | Slack webhook endpoint tests |
| `tests/test_discord_webhook.py` | Discord webhook endpoint tests |
| `tests/test_web_tools.py` | Web search tool tests |
| `tests/test_publish_delivery.py` | Outbound delivery tests |

---

## Task 1: Slack Webhook Endpoint

**Files:**
- Create: `src/api/routes/slack.py`
- Modify: `src/api/app.py:1-50`
- Create: `tests/test_slack_webhook.py`

- [ ] **Step 1: Write the failing test for Slack URL verification**

```python
# tests/test_slack_webhook.py
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.api.app import create_app

app = create_app()
client = TestClient(app)


def test_slack_url_verification():
    """Slack sends URL verification challenge on first setup."""
    payload = {
        "type": "url_verification",
        "challenge": "test_challenge_token_123",
        "token": "test_token",
    }
    response = client.post("/api/slack/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"challenge": "test_challenge_token_123"}


def test_slack_event_callback():
    """Slack sends event callbacks for messages."""
    payload = {
        "type": "event_callback",
        "token": "test_token",
        "team_id": "T123456",
        "event": {
            "type": "message",
            "channel": "C123456",
            "user": "U123456",
            "text": "<@U789012> How do I configure webhooks?",
            "ts": "1234567890.123456",
        },
    }
    with patch("src.api.routes.slack.verify_slack_signature", return_value=True):
        with patch("src.api.routes.slack.process_slack_event") as mock_process:
            response = client.post("/api/slack/webhook", json=payload)
            assert response.status_code == 200
            assert response.json() == {"ok": True}
            mock_process.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_slack_webhook.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.api.routes.slack'"

- [ ] **Step 3: Write minimal implementation**

```python
# src/api/routes/slack.py
from __future__ import annotations

import hashlib
import hmac
import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from src.config import settings
from src.agents.runners.slack_runner import run_slack_pipeline

logger = structlog.get_logger()
router = APIRouter()


async def verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Slack request signature using signing secret."""
    if not settings.slack_signing_secret:
        logger.warning("slack_signing_not_configured")
        return True
    
    signing_secret = settings.slack_signing_secret.get_secret_value()
    basestring = f"v0:{timestamp.decode()}:{body.decode()}"
    expected = "v0=" + hmac.new(
        signing_secret.encode(), basestring.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def process_slack_event(event: dict, team_id: str):
    """Process Slack event in background."""
    event_type = event.get("type")
    
    if event_type == "message" and "bot_id" not in event:
        channel = event.get("channel")
        user = event.get("user")
        text = event.get("text", "")
        thread_ts = event.get("thread_ts", event.get("ts"))
        
        # Only process if bot is mentioned or in support channel
        if settings.slack_bot_token:
            bot_id = await get_bot_id()
            if f"<@{bot_id}>" in text or channel in settings.slack_support_channels:
                await run_slack_pipeline(
                    channel=channel,
                    thread_ts=thread_ts,
                    user=user,
                    text=text,
                    team_id=team_id,
                )


async def get_bot_id() -> str:
    """Get bot user ID from Slack API."""
    import httpx
    token = settings.slack_bot_token.get_secret_value()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        data = resp.json()
        return data.get("user_id", "")


@router.post("/webhook")
async def slack_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Slack webhook events."""
    body = await request.body()
    payload = await request.json()
    
    # Handle URL verification
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}
    
    # Handle event callbacks
    if payload.get("type") == "event_callback":
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "").encode()
        signature = request.headers.get("X-Slack-Signature", "")
        
        if not await verify_slack_signature(body, timestamp, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        event = payload.get("event", {})
        team_id = payload.get("team_id")
        
        background_tasks.add_task(process_slack_event, event, team_id)
        return {"ok": True}
    
    return {"ok": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_slack_webhook.py::test_slack_url_verification -v`
Run: `pytest tests/test_slack_webhook.py::test_slack_event_callback -v`
Expected: PASS

- [ ] **Step 5: Register router in app**

```python
# src/api/app.py (add import and router)
from src.api.routes.slack import router as slack_router
app.include_router(slack_router, prefix="/api/slack")
```

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/slack.py src/api/app.py tests/test_slack_webhook.py
git commit -m "feat: add Slack webhook endpoint for event callbacks"
```

---

## Task 2: Discord Webhook Endpoint

**Files:**
- Create: `src/api/routes/discord.py`
- Modify: `src/api/app.py:1-50`
- Create: `tests/test_discord_webhook.py`

- [ ] **Step 1: Write the failing test for Discord PING interaction**

```python
# tests/test_discord_webhook.py
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.api.app import create_app

app = create_app()
client = TestClient(app)


def test_discord_ping_interaction():
    """Discord sends PING interaction to verify endpoint."""
    payload = {
        "type": 1,  # PING
        "application_id": "123456789",
        "token": "test_token",
    }
    response = client.post("/api/discord/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"type": 1}  # PONG


def test_discord_command_interaction():
    """Discord sends slash command interactions."""
    payload = {
        "type": 2,  # APPLICATION_COMMAND
        "application_id": "123456789",
        "token": "test_token",
        "data": {
            "name": "draftly",
            "options": [
                {"name": "question", "type": 3, "value": "How do I configure webhooks?"}
            ],
        },
        "member": {
            "user": {"id": "U123456", "username": "testuser"},
            "guild_id": "G123456",
        },
        "channel_id": "C123456",
    }
    with patch("src.api.routes.discord.verify_discord_signature", return_value=True):
        with patch("src.api.routes.discord.process_discord_interaction") as mock_process:
            response = client.post("/api/discord/webhook", json=payload)
            assert response.status_code == 200
            assert response.json()["type"] == 5  # CHANNEL_MESSAGE_WITH_SOURCE (deferred)
            mock_process.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_discord_webhook.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.api.routes.discord'"

- [ ] **Step 3: Write minimal implementation**

```python
# src/api/routes/discord.py
from __future__ import annotations

import hashlib
import structlog
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

from src.config import settings
from src.agents.runners.discord_runner import run_discord_pipeline

logger = structlog.get_router()
router = APIRouter()


async def verify_discord_signature(body: bytes, signature: str, timestamp: str) -> bool:
    """Verify Discord request signature using Ed25519."""
    if not settings.discord_public_key:
        logger.warning("discord_public_not_configured")
        return True
    
    public_key = settings.discord_public_key.get_secret_value()
    try:
        verify_key = VerifyKey(bytes.fromhex(public_key))
        message = f"{timestamp.decode()}{body.decode()}"
        verify_key.verify(message.encode(), bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False


async def process_discord_interaction(interaction: dict):
    """Process Discord interaction in background."""
    interaction_type = interaction.get("type")
    
    if interaction_type == 2:  # APPLICATION_COMMAND
        data = interaction.get("data", {})
        command_name = data.get("name")
        
        if command_name == "draftly":
            options = data.get("options", [])
            question = next(
                (opt["value"] for opt in options if opt["name"] == "question"), ""
            )
            
            user = interaction.get("member", {}).get("user", {})
            channel_id = interaction.get("channel_id")
            guild_id = interaction.get("guild_id")
            
            await run_discord_pipeline(
                channel_id=channel_id,
                guild_id=guild_id,
                user_id=user.get("id"),
                question=question,
            )


@router.post("/webhook")
async def discord_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Discord webhook interactions."""
    body = await request.body()
    payload = await request.json()
    
    # Handle PING interaction
    if payload.get("type") == 1:
        return {"type": 1}  # PONG
    
    # Handle command interactions
    if payload.get("type") == 2:
        signature = request.headers.get("X-Signature-Ed25519", "")
        timestamp = request.headers.get("X-Signature-Timestamp", "").encode()
        
        if not await verify_discord_signature(body, signature, timestamp):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Return deferred response immediately
        background_tasks.add_task(process_discord_interaction, payload)
        return {"type": 5}  # CHANNEL_MESSAGE_WITH_SOURCE (deferred)
    
    return {"type": 1}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_discord_webhook.py::test_discord_ping_interaction -v`
Run: `pytest tests/test_discord_webhook.py::test_discord_command_interaction -v`
Expected: PASS

- [ ] **Step 5: Register router in app**

```python
# src/api/app.py (add import and router)
from src.api.routes.discord import router as discord_router
app.include_router(discord_router, prefix="/api/discord")
```

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/discord.py src/api/app.py tests/test_discord_webhook.py
git commit -m "feat: add Discord webhook endpoint for interactions"
```

---

## Task 3: Web Search Tools

**Files:**
- Create: `src/agents/tools/web_tools.py`
- Modify: `src/agents/nodes/research.py:1-50`
- Create: `tests/test_web_tools.py`

- [ ] **Step 1: Write the failing test for web search**

```python
# tests/test_web_tools.py
import pytest
from unittest.mock import AsyncMock, patch
from src.agents.tools.web_tools import search_web, search_documentation


@pytest.mark.asyncio
async def test_search_web():
    """Search web for relevant context."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "organic_results": [
            {
                "title": "How to Configure Webhooks",
                "link": "https://example.com/webhooks",
                "snippet": "Step 1: Go to settings. Step 2: Click webhooks...",
            }
        ]
    }
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await search_web.ainvoke(
            {"query": "how to configure webhooks", "limit": 5}
        )
        assert "How to Configure Webhooks" in result
        assert "https://example.com/webhooks" in result


@pytest.mark.asyncio
async def test_search_web_no_results():
    """Handle empty search results."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"organic_results": []}
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await search_web.ainvoke(
            {"query": "nonexistent topic", "limit": 5}
        )
        assert "No web results found" in result


@pytest.mark.asyncio
async def test_search_documentation():
    """Search documentation sites for relevant context."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "title": "Webhook Configuration Guide",
                "link": "https://docs.example.com/webhooks",
                "snippet": "Configure webhooks in your settings...",
            }
        ]
    }
    
    with patch("httpx.AsyncClient.get", return_value=mock_response):
        result = await search_documentation.ainvoke(
            {"query": "webhooks configuration", "limit": 5}
        )
        assert "Webhook Configuration Guide" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_web_tools.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.agents.tools.web_tools'"

- [ ] **Step 3: Write minimal implementation**

```python
# src/agents/tools/web_tools.py
from __future__ import annotations

import httpx
from langchain_core.tools import tool

from src.config import settings


@tool
async def search_web(query: str, limit: int = 10) -> str:
    """Search web using search API for relevant context and documentation."""
    api_key = settings.search_api_key
    if not api_key:
        return "Search API not configured"
    
    # Using SerpAPI as example (can be swapped for Google Custom Search, etc.)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://serpapi.com/search",
            params={
                "q": query,
                "api_key": api_key,
                "num": limit,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return f"Web search failed: {resp.status_code}"
        data = resp.json()
    
    results = data.get("organic_results", [])
    if not results:
        return "No web results found."
    
    return "\n".join(
        f"[{r.get('title', 'No Title')}]({r.get('link', '')})\n{r.get('snippet', '')}"
        for r in results[:limit]
    )


@tool
async def search_documentation(query: str, limit: int = 5) -> str:
    """Search official documentation sites for relevant context."""
    api_key = settings.search_api_key
    if not api_key:
        return "Search API not configured"
    
    # Search GitHub docs, Stack Overflow, MDN, etc.
    sites = ["docs.github.com", "stackoverflow.com", "developer.mozilla.org"]
    site_query = " OR ".join(f"site:{site}" for site in sites)
    full_query = f"{query} ({site_query})"
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://serpapi.com/search",
            params={
                "q": full_query,
                "api_key": api_key,
                "num": limit,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return f"Documentation search failed: {resp.status_code}"
        data = resp.json()
    
    results = data.get("organic_results", [])
    if not results:
        return "No documentation results found."
    
    return "\n".join(
        f"[{r.get('title', 'No Title')}]({r.get('link', '')})\n{r.get('snippet', '')}"
        for r in results[:limit]
    )


WEB_TOOLS = [search_web, search_documentation]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_web_tools.py::test_search_web -v`
Run: `pytest tests/test_web_tools.py::test_search_web_no_results -v`
Run: `pytest tests/test_web_tools.py::test_search_documentation -v`
Expected: PASS

- [ ] **Step 5: Update research node to use web tools**

```python
# src/agents/nodes/research.py
from src.agents.tools.web_tools import search_web, search_documentation

# In research_node function:
web_task = search_web.ainvoke(
    {
        "query": question,
        "limit": 10,
    }
)
doc_task = search_documentation.ainvoke(
    {
        "query": question,
        "limit": 5,
    }
)

# Update gather to include web tasks
web_result, doc_result = await asyncio.gather(
    web_task, doc_task, return_exceptions=True
)

web_context = (
    [web_result] if not isinstance(web_result, Exception) else [f"Error: {web_result}"]
)
doc_context = (
    [doc_result] if not isinstance(doc_result, Exception) else [f"Error: {doc_result}"]
)

# Update return to use web_context and doc_context
return {
    "web_context": web_context,
    "doc_context": doc_context,
}
```

- [ ] **Step 6: Update DocumentationState in state.py**

```python
# src/agents/state.py
class DocumentationState(TypedDict):
    # ... existing fields ...
    web_context: list[dict]      # Web search results
    doc_context: list[dict]      # Documentation search results
    # ... rest of fields ...
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest tests/test_research.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/agents/tools/web_tools.py src/agents/nodes/research.py src/agents/state.py tests/test_web_tools.py
git commit -m "feat: add web search tools for research node"
```

---

## Task 4: Implement Outbound Delivery in Publish Node

**Files:**
- Modify: `src/agents/nodes/publish.py:1-132`
- Create: `tests/test_publish_delivery.py`

- [ ] **Step 1: Write the failing test for GitHub delivery**

```python
# tests/test_publish_delivery.py
import pytest
from unittest.mock import AsyncMock, patch
from src.agents.nodes.publish import publish_node, _post_to_github, _post_to_slack, _post_to_discord


@pytest.mark.asyncio
async def test_post_to_github():
    """Post documentation to GitHub issue as a comment."""
    state = {
        "source": "github",
        "channel_id": "owner/repo",
        "thread_id": "42",
        "draft_title": "How to Configure Webhooks",
        "draft_content": "# How to Configure Webhooks\n\nStep 1: Go to settings...",
        "doc_type": "howto",
        "confidence_score": 0.85,
    }
    
    with patch("src.agents.nodes.publish.get_installation_token", return_value="test_token"):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_response = AsyncMock()
            mock_response.status_code = 201
            mock_response.json.return_value = {"html_url": "https://github.com/owner/repo/issues/42#issuecomment-123"}
            mock_post.return_value = mock_response
            
            await _post_to_github(state, [])
            mock_post.assert_called_once()
            assert "api.github.com" in str(mock_post.call_args)


@pytest.mark.asyncio
async def test_post_to_slack():
    """Post documentation to Slack thread."""
    state = {
        "source": "slack",
        "channel_id": "C123456",
        "thread_id": "1234567890.123456",
        "draft_title": "How to Configure Webhooks",
        "draft_content": "# How to Configure Webhooks\n\nStep 1: Go to settings...",
        "doc_type": "howto",
        "confidence_score": 0.85,
    }
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"ok": True}
        mock_post.return_value = mock_response
        
        await _post_to_slack(state, [])
        mock_post.assert_called_once()
        assert "slack.com" in str(mock_post.call_args)


@pytest.mark.asyncio
async def test_post_to_discord():
    """Post documentation to Discord thread."""
    state = {
        "source": "discord",
        "channel_id": "1234567890",
        "thread_id": "1234567890",
        "draft_title": "How to Configure Webhooks",
        "draft_content": "# How to Configure Webhooks\n\nStep 1: Go to settings...",
        "doc_type": "howto",
        "confidence_score": 0.85,
    }
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "1234567890"}
        mock_post.return_value = mock_response
        
        await _post_to_discord(state, [])
        mock_post.assert_called_once()
        assert "discord.com" in str(mock_post.call_args)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_publish_delivery.py -v`
Expected: FAIL with "AttributeError: 'coroutine' object has no attribute 'get'"

- [ ] **Step 3: Implement GitHub delivery**

```python
# src/agents/nodes/publish.py (replace _post_to_github)
async def _post_to_github(state: DocumentationState, published_urls: list[dict]):
    """Post documentation to GitHub issue as a comment."""
    try:
        channel_id = state.get("channel_id", "")
        if "/" not in channel_id:
            return
        
        owner, repo = channel_id.split("/")
        issue_number = state.get("thread_id", "")
        
        if not issue_number or not owner or not repo:
            return
        
        # Get installation token
        from src.memory.organizations import get_org_by_github
        org = await get_org_by_github(owner)
        if not org:
            return
        
        installation_id = org.get("github_installation_id")
        if not installation_id:
            return
        
        token = await get_installation_token(installation_id)
        
        # Format documentation as GitHub comment
        title = state.get("draft_title", "Documentation")
        content = state.get("draft_content", "")
        doc_type = state.get("doc_type", "howto")
        confidence = state.get("confidence_score", 0.0)
        
        comment_body = f"""## 📚 Generated Documentation

**Title:** {title}
**Type:** {doc_type}
**Confidence:** {confidence:.0%}

---

{content}

---

*Generated by [Draftly](https://draftly.ai) | [View in Dashboard]({state.get('workflow_id', '')})*"""
        
        # Post comment to GitHub
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json={"body": comment_body},
                timeout=10,
            )
            
            if resp.status_code in (200, 201):
                comment_data = resp.json()
                published_urls.append({
                    "platform": "github",
                    "url": comment_data.get("html_url", ""),
                })
                logger.info("github_post_success", url=comment_data.get("html_url"))
            else:
                logger.error("github_post_failed", status=resp.status_code, body=resp.text)
    
    except Exception as e:
        logger.error("github_post_error", error=str(e))
```

- [ ] **Step 4: Implement Slack delivery**

```python
# src/agents/nodes/publish.py (add _post_to_slack)
async def _post_to_slack(state: DocumentationState, published_urls: list[dict]):
    """Post documentation to Slack thread."""
    try:
        channel = state.get("channel_id", "")
        thread_ts = state.get("thread_id", "")
        
        if not channel:
            return
        
        # Format documentation as Slack message
        title = state.get("draft_title", "Documentation")
        content = state.get("draft_content", "")
        doc_type = state.get("doc_type", "howto")
        confidence = state.get("confidence_score", 0.0)
        
        # Convert markdown to Slack format (simplified)
        slack_text = f"""📚 *Generated Documentation*

*Title:* {title}
*Type:* {doc_type}
*Confidence:* {confidence:.0%}

---

{content[:2000]}"""  # Slack has text limits
        
        # Post to Slack
        from src.integrations.slack import send_slack_message
        result = await send_slack_message(
            channel=channel,
            text=slack_text,
            thread_ts=thread_ts,
        )
        
        if result.get("ok"):
            published_urls.append({
                "platform": "slack",
                "channel": channel,
                "thread_ts": thread_ts,
            })
            logger.info("slack_post_success", channel=channel)
        else:
            logger.error("slack_post_failed", error=result.get("error"))
    
    except Exception as e:
        logger.error("slack_post_error", error=str(e))
```

- [ ] **Step 5: Implement Discord delivery**

```python
# src/agents/nodes/publish.py (add _post_to_discord)
async def _post_to_discord(state: DocumentationState, published_urls: list[dict]):
    """Post documentation to Discord thread."""
    try:
        channel_id = state.get("channel_id", "")
        thread_id = state.get("thread_id", "")
        
        if not channel_id:
            return
        
        # Format documentation as Discord embed
        title = state.get("draft_title", "Documentation")
        content = state.get("draft_content", "")[:2000]  # Discord embed limit
        doc_type = state.get("doc_type", "howto")
        confidence = state.get("confidence_score", 0.0)
        
        embed = {
            "title": f"📚 {title}",
            "description": content,
            "color": 0x00FF00 if confidence >= 0.7 else 0xFFFF00,
            "fields": [
                {"name": "Type", "value": doc_type, "inline": True},
                {"name": "Confidence", "value": f"{confidence:.0%}", "inline": True},
            ],
            "footer": {"text": "Generated by Draftly"},
        }
        
        # Post to Discord
        import httpx
        token = settings.discord_bot_token.get_secret_value()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://discord.com/api/v10/channels/{channel_id}/messages",
                headers={
                    "Authorization": f"Bot {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "content": f"📚 **Generated Documentation**",
                    "embeds": [embed],
                    "message_reference": {"message_id": thread_id} if thread_id else None,
                },
                timeout=10,
            )
            
            if resp.status_code in (200, 201):
                message_data = resp.json()
                published_urls.append({
                    "platform": "discord",
                    "channel_id": channel_id,
                    "message_id": message_data.get("id", ""),
                })
                logger.info("discord_post_success", channel_id=channel_id)
            else:
                logger.error("discord_post_failed", status=resp.status_code, body=resp.text)
    
    except Exception as e:
        logger.error("discord_post_error", error=str(e))
```

- [ ] **Step 6: Update publish_node to call delivery functions**

```python
# src/agents/nodes/publish.py (update publish_node)
async def publish_node(state: DocumentationState) -> dict:
    # ... existing code ...
    
    # Post to platform
    published_urls = []
    source = state.get("source")
    
    if source == "github":
        await _post_to_github(state, published_urls)
    elif source == "slack":
        await _post_to_slack(state, published_urls)
    elif source == "discord":
        await _post_to_discord(state, published_urls)
    
    return {
        "published_urls": published_urls,
        "human_decision": "",
        "human_feedback": "",
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pytest tests/test_publish_delivery.py -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/agents/nodes/publish.py tests/test_publish_delivery.py
git commit -m "feat: implement outbound delivery to GitHub, Slack, and Discord"
```

---

## Task 5: Human Review Notifications

**Files:**
- Modify: `src/agents/nodes/human.py:1-53`
- Create: `tests/test_human_notifications.py`

- [ ] **Step 1: Write the failing test for Slack notification**

```python
# tests/test_human_notifications.py
import pytest
from unittest.mock import AsyncMock, patch
from src.agents.nodes.human import send_review_notification


@pytest.mark.asyncio
async def test_send_review_notification_slack():
    """Send review notification to Slack."""
    state = {
        "source": "slack",
        "channel_id": "C123456",
        "thread_id": "1234567890.123456",
        "draft_title": "How to Configure Webhooks",
        "doc_id": "doc_123",
        "confidence_score": 0.85,
    }
    
    with patch("src.integrations.slack.send_dm") as mock_send_dm:
        mock_send_dm.return_value = {"ok": True}
        
        await send_review_notification(state)
        mock_send_dm.assert_called_once()
        assert "How to Configure Webhooks" in str(mock_send_dm.call_args)


@pytest.mark.asyncio
async def test_send_review_notification_discord():
    """Send review notification to Discord."""
    state = {
        "source": "discord",
        "channel_id": "1234567890",
        "thread_id": "1234567890",
        "draft_title": "How to Configure Webhooks",
        "doc_id": "doc_123",
        "confidence_score": 0.85,
    }
    
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "1234567890"}
        mock_post.return_value = mock_response
        
        await send_review_notification(state)
        mock_post.assert_called_once()
        assert "discord.com" in str(mock_post.call_args)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_human_notifications.py -v`
Expected: FAIL with "ImportError: cannot import name 'send_review_notification'"

- [ ] **Step 3: Implement notification function**

```python
# src/agents/nodes/human.py (add at bottom)
async def send_review_notification(state: DocumentationState):
    """Send review notification to original platform."""
    try:
        source = state.get("source")
        doc_id = state.get("doc_id", "")
        title = state.get("draft_title", "Untitled")
        confidence = state.get("confidence_score", 0.0)
        review_url = f"{settings.review_dashboard_url}/review/{doc_id}"
        
        message = f"""📋 *Documentation Ready for Review*

*Title:* {title}
*Confidence:* {confidence:.0%}

Review and approve: {review_url}"""
        
        if source == "slack":
            from src.integrations.slack import send_dm
            # Get user who requested (stored in state or thread)
            user_id = state.get("requesting_user_id", "")
            if user_id:
                await send_dm(user_id=user_id, text=message)
        
        elif source == "discord":
            import httpx
            channel_id = state.get("channel_id", "")
            if channel_id:
                token = settings.discord_bot_token.get_secret_value()
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://discord.com/api/v10/channels/{channel_id}/messages",
                        headers={
                            "Authorization": f"Bot {token}",
                            "Content-Type": "application/json",
                        },
                        json={"content": message},
                        timeout=10,
                    )
        
        logger.info("review_notification_sent", source=source, doc_id=doc_id)
    
    except Exception as e:
        logger.error("review_notification_failed", error=str(e))
```

- [ ] **Step 4: Update human_review_node to send notification**

```python
# src/agents/nodes/human.py (update human_review_node)
async def human_review_node(state: DocumentationState) -> dict:
    # ... existing code ...
    
    # Send notification to platform
    await send_review_notification(state)
    
    decision = interrupt(
        # ... existing code ...
    )
    
    # ... rest of existing code ...
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_human_notifications.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/agents/nodes/human.py tests/test_human_notifications.py
git commit -m "feat: add human review notifications to Slack and Discord"
```

---

## Task 6: Update WORKFLOW.md

**Files:**
- Modify: `context/WORKFLOW.md:1-1`

- [ ] **Step 1: Update workflow with implementation status**

```markdown
# Draftly Workflow

## Overview

Draftly automatically generates documentation from support requests across multiple platforms using an 8-node LangGraph pipeline with human-in-the-loop review.

## Supported Platforms

- **GitHub**: Issues and discussions
- **Slack**: Support channel messages and threads
- **Discord**: Support server messages and threads
- **CLI**: Direct API input

## Complete Workflow

### 1. Inbound Tracking (Webhook Endpoints)

✅ **Implemented**

- GitHub: POST /api/github/webhook
- Slack: POST /api/slack/webhook  
- Discord: POST /api/discord/webhook

### 2. Issue Ingestion (`ingest_node`)

✅ **Implemented**

### 3. Memory Retrieval (`memory_retrieve_node`)

✅ **Implemented**

### 4. Research (`research_node`)

✅ **Implemented** (with web search)

- Web Search: search_web() - searches web using SerpAPI/Google
- Documentation: search_documentation() - searches official docs

### 5. Synthesis (`synthesize_node`)

✅ **Implemented**

### 6. Documentation Generation (`write_docs_node`)

✅ **Implemented**

### 7. AI Review (`ai_review_node`)

✅ **Implemented**

### 8. Human Review (`human_review_node`)

✅ **Implemented** (with platform notifications)

### 9. Publishing (`publish_node`)

✅ **Implemented** (with outbound delivery)

## Gaps Closed

- [x] Slack webhook endpoint
- [x] Discord webhook endpoint  
- [x] Web search tools for research
- [x] Documentation search tools
- [x] Outbound delivery to GitHub
- [x] Outbound delivery to Slack
- [x] Outbound delivery to Discord
- [x] Human review notifications
```

- [ ] **Step 2: Commit**

```bash
git add context/WORKFLOW.md
git commit -m "docs: update workflow with web search implementation"
```

---

## Verification

After completing all tasks, run the full test suite:

```bash
pytest tests/ -v
```

Run linting:

```bash
ruff check src/
mypy src/
```

Test the complete flow:

1. Start the server: `uvicorn src.api.app:app --reload`
2. Send test webhook to each endpoint
3. Verify pipeline executes
4. Verify documentation is generated
5. Verify notification is sent
6. Verify documentation is posted back to platform
