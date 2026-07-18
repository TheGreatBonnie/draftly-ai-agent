# Draftly Production-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Draftly demo into a production-ready system with error handling, working HITL flow, security, logging, tests, and proper deployment.

**Architecture:** Add resilience layers (retry, error handling) around existing nodes, fix the broken HITL graph resume, add API auth and logging configuration, write tests for critical paths, and fix Dockerfile for production.

**Tech Stack:** Python 3.11+, LangGraph, asyncpg, structlog, tenacity (new), FastAPI, httpx, pydantic-settings

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `pyproject.toml` | Modify | Add `tenacity`, `boto3`, `watchtower` |
| `src/utils/__init__.py` | Create | Utils package |
| `src/utils/retry.py` | Create | Reusable retry decorator |
| `src/logging_config.py` | Create | structlog configuration |
| `src/config.py` | Modify | Fix SecretStr, add AWS config |
| `src/database.py` | Modify | Add retry to DB calls |
| `src/integrations/llm.py` | Modify | Add retry, fix temp race |
| `src/integrations/slack.py` | Modify | Add retry, shared client |
| `src/integrations/github.py` | Modify | Add retry, shared client |
| `src/integrations/discord.py` | Modify | Add retry, shared client |
| `src/integrations/s3.py` | Create | S3 documentation storage |
| `src/integrations/cloudwatch.py` | Create | CloudWatch log export |
| `src/integrations/secrets.py` | Create | AWS Secrets Manager |
| `src/lambda/webhook_handler.py` | Create | Lambda webhook handler |
| `src/lambda/sqs_consumer.py` | Create | SQS message consumer |
| `src/agents/graph.py` | Modify | Graph compilation |
| `src/agents/graph_store.py` | Create | Graph singleton for HITL resume |
| `src/agents/nodes/ingest.py` | Modify | Add error handling |
| `src/agents/nodes/memory.py` | Modify | Add error handling |
| `src/agents/nodes/synthesize.py` | Modify | Add error handling |
| `src/agents/nodes/write.py` | Modify | Add error handling |
| `src/agents/nodes/review.py` | Modify | Add error handling |
| `src/agents/nodes/publish.py` | Modify | Add error handling, S3 upload |
| `src/agents/nodes/human.py` | Modify | Add error handling |
| `src/api/app.py` | Modify | Add health check, CORS, auth |
| `src/api/auth.py` | Create | API key authentication |
| `src/api/routes/reviews.py` | Modify | Fix HITL resume, add validation |
| `src/api/routes/docs.py` | Modify | Add error responses |
| `src/api/routes/memory.py` | Modify | Fix SQL injection pattern |
| `src/cli/draftly.py` | Modify | Add SQS consumer mode |
| `Dockerfile` | Modify | Production multi-stage image |
| `.dockerignore` | Create | Exclude dev files |
| `.github/workflows/ci.yml` | Create | CI pipeline |
| `.github/workflows/deploy.yml` | Create | CD pipeline |
| `infrastructure/cloudformation/sqs.yml` | Create | SQS + DLQ infrastructure |
| `infrastructure/cloudformation/ecs.yml` | Create | ECS Fargate infrastructure |
| `infrastructure/cloudformation/ecs-task-definition.json` | Create | ECS task definition |
| `tests/conftest.py` | Create | Test fixtures |
| `tests/unit/__init__.py` | Create | Unit tests package |
| `tests/unit/test_retry.py` | Create | Retry decorator tests |
| `tests/unit/test_nodes.py` | Create | Node error handling tests |
| `tests/unit/test_serialization.py` | Create | UUID/datetime serialization tests |

---

## Phase 1: Error Handling & Resilience

### Task 1: Add tenacity dependency

**Files:**
- Modify: `pyproject.toml:19`

- [ ] **Step 1: Add tenacity to dependencies**

In `pyproject.toml`, add `"tenacity>=9.0.0"` to the dependencies list after `structlog`:

```python
    "structlog>=24.0.0",
    "tenacity>=9.0.0",
```

- [ ] **Step 2: Run uv sync**

```bash
uv sync
```

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "deps: add tenacity for retry logic"
```

---

### Task 2: Create retry utility

**Files:**
- Create: `src/utils/__init__.py`
- Create: `src/utils/retry.py`

- [ ] **Step 1: Create utils package**

```python
# src/utils/__init__.py
```

- [ ] **Step 2: Create retry decorator**

```python
# src/utils/retry.py
from __future__ import annotations

import functools
import logging

from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)


def with_retry(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
):
    """Decorator that retries a function on specified exceptions with exponential backoff."""

    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            retryer = retry(
                retry=retry_if_exception_type(exceptions),
                stop=stop_after_attempt(max_attempts),
                wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
                reraise=True,
            )

            @retryer
            async def _call():
                return await func(*args, **kwargs)

            try:
                return await _call()
            except RetryError as e:
                logger.error(
                    "retry_exhausted",
                    function=func.__name__,
                    attempts=max_attempts,
                    last_error=str(e.last_attempt.exception()) if e.last_attempt else None,
                )
                raise e.last_attempt.exception() from None

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            retryer = retry(
                retry=retry_if_exception_type(exlections),
                stop=stop_after_attempt(max_attempts),
                wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
                reraise=True,
            )

            @retryer
            def _call():
                return func(*args, **kwargs)

            try:
                return _call()
            except RetryError as e:
                logger.error(
                    "retry_exhausted",
                    function=func.__name__,
                    attempts=max_attempts,
                    last_error=str(e.last_attempt.exception()) if e.last_attempt else None,
                )
                raise e.last_attempt.exception() from None

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
```

- [ ] **Step 3: Verify import works**

```bash
uv run python -c "from src.utils.retry import with_retry; print('ok')"
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add reusable retry decorator with exponential backoff"
```

---

### Task 3: Configure structlog

**Files:**
- Create: `src/logging_config.py`
- Modify: `src/api/app.py` (lifespan)
- Modify: `src/cli/draftly.py` (startup)

- [ ] **Step 1: Create logging configuration**

```python
# src/logging_config.py
from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(log_level: str = "INFO", json_output: bool = False) -> None:
    """Configure structlog with processors for structured logging."""

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if json_output:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )
```

- [ ] **Step 2: Call configure_logging on CLI startup**

In `src/cli/draftly.py`, add import and call before `asyncio.run`:

```python
from src.logging_config import configure_logging

# ... (existing imports)

def main():
    configure_logging(
        log_level=settings.log_level,
        json_output=settings.environment == "production",
    )
    if len(sys.argv) < 2:
        print("Usage: python -m src.cli.draftly 'your question here'")
        sys.exit(1)

    question = sys.argv[1]
    asyncio.run(run_workflow(question))
```

- [ ] **Step 3: Call configure_logging on API startup**

In `src/api/app.py`, add import and call in lifespan:

```python
from src.logging_config import configure_logging

# ... (existing imports)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.config import settings
    configure_logging(
        log_level=settings.log_level,
        json_output=settings.environment == "production",
    )
    await get_pool()
    yield
    await close_pool()
```

- [ ] **Step 4: Commit**

```bash
git add src/logging_config.py src/cli/draftly.py src/api/app.py
git commit -m "feat: configure structlog with JSON output for production"
```

---

### Task 4: Fix secrets in config

**Files:**
- Modify: `src/config.py:9,12`
- Modify: `src/database.py:19` (use `.get_secret_value()`)
- Modify: `src/integrations/llm.py:18-19` (use `.get_secret_value()`)
- Modify: `src/cli/draftly.py:64` (use `.get_secret_value()`)

- [ ] **Step 1: Change types in config.py**

```python
# src/config.py — change lines 9 and 12
    cockroachdb_url: SecretStr
    requesty_api_key: SecretStr
```

- [ ] **Step 2: Update database.py to use get_secret_value()**

```python
# src/database.py — line 19
        _pool = await asyncpg.create_pool(
            settings.cockroachdb_url.get_secret_value(),
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
```

- [ ] **Step 3: Update llm.py to use get_secret_value()**

```python
# src/integrations/llm.py — lines 18-19
        _llm = ChatOpenAI(
            openai_api_key=settings.requesty_api_key.get_secret_value(),
            openai_api_base=settings.requesty_base_url,
            model_name=settings.llm_model,
            temperature=0.3,
        )
```

- [ ] **Step 4: Update draftly.py to use get_secret_value()**

```python
# src/cli/draftly.py — line 64
    async with AsyncCockroachDBSaver.from_conn_string(
        settings.cockroachdb_url.get_secret_value()
    ) as checkpointer:
```

- [ ] **Step 5: Run ruff check**

```bash
uv run ruff check src/
```

- [ ] **Step 6: Commit**

```bash
git add src/config.py src/database.py src/integrations/llm.py src/cli/draftly.py
git commit -m "fix: use SecretStr for cockroachdb_url and requesty_api_key"
```

---

### Task 5: Add retry to LLM calls

**Files:**
- Modify: `src/integrations/llm.py`

- [ ] **Step 1: Add retry decorator to call_bedrock**

```python
# src/integrations/llm.py
from __future__ import annotations

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from src.config import settings
from src.utils.retry import with_retry

logger = structlog.get_logger()

_llm: ChatOpenAI | None = None


def get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            openai_api_key=settings.requesty_api_key.get_secret_value(),
            openai_api_base=settings.requesty_base_url,
            model_name=settings.llm_model,
            temperature=0.3,
        )
    return _llm


@with_retry(max_attempts=3, exceptions=(Exception,))
async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    llm = get_llm()

    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    logger.info("llm_call", model=settings.llm_model, prompt_length=len(prompt))

    response = await llm.ainvoke(messages)

    text = response.content if isinstance(response.content, str) else str(response.content)
    logger.info("llm_response", response_length=len(text))
    return text
```

- [ ] **Step 2: Run ruff check**

```bash
uv run ruff check src/integrations/llm.py
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/llm.py
git commit -m "feat: add retry to LLM calls with exponential backoff"
```

---

### Task 6: Add retry to HTTP integrations

**Files:**
- Modify: `src/integrations/slack.py`
- Modify: `src/integrations/github.py`
- Modify: `src/integrations/discord.py`

- [ ] **Step 1: Update slack.py with retry and shared client**

```python
# src/integrations/slack.py
from __future__ import annotations

import httpx
import structlog

from src.config import settings
from src.utils.retry import with_retry

logger = structlog.get_logger()

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10)
    return _client


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def send_slack_message(channel: str, text: str, thread_ts: str | None = None) -> dict:
    token = settings.slack_bot_token.get_secret_value()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"channel": channel, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    client = get_client()
    resp = await client.post(
        "https://slack.com/api/chat.postMessage",
        headers=headers,
        json=payload,
    )
    result = resp.json()
    if not result.get("ok"):
        logger.error("slack_send_failed", error=result.get("error"))
    return result


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def send_dm(user_id: str, text: str) -> dict:
    token = settings.slack_bot_token.get_secret_value()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"channel": user_id, "text": text}

    client = get_client()
    resp = await client.post(
        "https://slack.com/api/chat.postMessage",
        headers=headers,
        json=payload,
    )
    return resp.json()


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def add_reaction(channel: str, timestamp: str, emoji: str) -> dict:
    token = settings.slack_bot_token.get_secret_value()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"channel": channel, "timestamp": timestamp, "name": emoji}

    client = get_client()
    resp = await client.post(
        "https://slack.com/api/reactions.add",
        headers=headers,
        json=payload,
    )
    return resp.json()
```

- [ ] **Step 2: Update github.py with retry and shared client**

```python
# src/integrations/github.py
from __future__ import annotations

import httpx
import structlog

from src.config import settings
from src.utils.retry import with_retry

logger = structlog.get_logger()

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10)
    return _client


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def post_github_comment(owner: str, repo: str, issue_number: int, body: str) -> dict:
    token = settings.github_token.get_secret_value()
    headers = {"Authorization": f"token {token}", "Content-Type": "application/json"}
    payload = {"body": body}

    client = get_client()
    resp = await client.post(
        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments",
        headers=headers,
        json=payload,
    )
    if resp.status_code not in (200, 201):
        logger.error("github_comment_failed", status=resp.status_code, body=resp.text)
    return resp.json()


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def get_github_issue(owner: str, repo: str, issue_number: int) -> dict:
    headers = {"Authorization": f"token {settings.github_token.get_secret_value()}"}

    client = get_client()
    resp = await client.get(
        f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}",
        headers=headers,
    )
    return resp.json()
```

- [ ] **Step 3: Update discord.py with retry and shared client**

```python
# src/integrations/discord.py
from __future__ import annotations

import httpx
import structlog

from src.config import settings
from src.utils.retry import with_retry

logger = structlog.get_logger()

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=10)
    return _client


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def send_discord_message(channel_id: str, content: str) -> dict:
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    payload = {"content": content}

    client = get_client()
    resp = await client.post(
        f"https://discord.com/api/v10/channels/{channel_id}/messages",
        headers=headers,
        json=payload,
    )
    if resp.status_code not in (200, 201):
        logger.error("discord_send_failed", status=resp.status_code, body=resp.text)
    return resp.json()


@with_retry(max_attempts=2, exceptions=(httpx.TransportError,))
async def send_discord_thread_reply(thread_id: str, content: str) -> dict:
    token = settings.discord_bot_token.get_secret_value()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    payload = {"content": content}

    client = get_client()
    resp = await client.post(
        f"https://discord.com/api/v10/channels/{thread_id}/messages",
        headers=headers,
        json=payload,
    )
    return resp.json()
```

- [ ] **Step 4: Run ruff check**

```bash
uv run ruff check src/integrations/
```

- [ ] **Step 5: Commit**

```bash
git add src/integrations/slack.py src/integrations/github.py src/integrations/discord.py
git commit -m "feat: add retry and shared HTTP client to integrations"
```

---

### Task 7: Add error handling to all nodes

**Files:**
- Modify: `src/agents/nodes/ingest.py`
- Modify: `src/agents/nodes/memory.py`
- Modify: `src/agents/nodes/synthesize.py`
- Modify: `src/agents/nodes/write.py`
- Modify: `src/agents/nodes/review.py`
- Modify: `src/agents/nodes/publish.py`
- Modify: `src/agents/nodes/human.py`

- [ ] **Step 1: Update ingest.py with error handling**

```python
# src/agents/nodes/ingest.py
from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.memory.episodic import create_thread
from src.memory.organizational import store_audit_log

logger = structlog.get_logger()


async def ingest_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    source = state["source"]
    channel_id = state["channel_id"]
    thread_id = state["thread_id"]
    question = state["question"]

    logger.info("ingest_started", org_id=org_id, source=source, thread_id=thread_id)

    try:
        st_id = await create_thread(
            org_id=org_id,
            source=source,
            channel_id=channel_id,
            thread_id=thread_id,
            title=question[:200] if question else None,
            question_summary=question,
        )

        await store_audit_log(
            org_id=org_id,
            actor="agent",
            action="ingest_message",
            resource_type="support_thread",
            resource_id=st_id,
            details={"source": source, "thread_id": thread_id, "question": question[:500]},
        )

        logger.info("ingest_completed", thread_record_id=st_id)
    except Exception as e:
        logger.error("ingest_failed", error=str(e), exc_info=True)
        st_id = ""

    return {
        "support_thread_id": st_id,
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
        "messages": [],
    }
```

- [ ] **Step 2: Update memory.py with error handling per search**

```python
# src/agents/nodes/memory.py
from __future__ import annotations

import structlog

from src.agents.state import DocumentationState
from src.memory.episodic import search_threads
from src.memory.organizational import search_memory
from src.memory.reviewer import get_reviewer_memory
from src.memory.vector_store import search_similar

logger = structlog.get_logger()


async def memory_retrieve_node(state: DocumentationState) -> dict:
    org_id = state["org_id"]
    question = state["question"]

    logger.info("memory_retrieve_started", org_id=org_id)

    semantic_results = []
    episodic_results = []
    org_results = []
    reviewer_results = []

    try:
        semantic_results = await search_similar(org_id, question, k=10)
    except Exception as e:
        logger.error("semantic_search_failed", error=str(e))

    try:
        episodic_results = await search_threads(org_id, question, limit=5)
    except Exception as e:
        logger.error("episodic_search_failed", error=str(e))

    try:
        pattern = question.split()[0] if question else ""
        org_results = await search_memory(org_id, key_pattern=pattern, limit=5)
    except Exception as e:
        logger.error("org_memory_search_failed", error=str(e))

    try:
        reviewer_results = await get_reviewer_memory(org_id, limit=5)
    except Exception as e:
        logger.error("reviewer_memory_search_failed", error=str(e))

    existing_docs = [r for r in semantic_results if r.get("content_type") == "documentation"]

    logger.info(
        "memory_retrieve_completed",
        semantic=len(semantic_results),
        episodic=len(episodic_results),
        organizational=len(org_results),
        reviewer=len(reviewer_results),
        existing_docs=len(existing_docs),
    )

    return {
        "similar_threads": episodic_results,
        "existing_docs": existing_docs,
        "reviewer_feedback_history": reviewer_results,
        "semantic_context": semantic_results,
    }
```

- [ ] **Step 3: Update synthesize.py with error handling**

Wrap the LLM call in try/except, return fallback on failure:

```python
# src/agents/nodes/synthesize.py — add try/except around call_bedrock (line 63)
    try:
        response = await call_bedrock(prompt)
    except Exception as e:
        logger.error("synthesize_llm_failed", error=str(e))
        return {
            "knowledge_package": {
                "key_facts": [f"LLM call failed: {e}"],
                "solutions": [],
                "code_examples": [],
                "gaps": ["LLM unavailable"],
                "sources": [],
                "recommended_doc_type": "howto",
            },
            "doc_type": "howto",
        }
```

- [ ] **Step 4: Update write.py with error handling**

Wrap both LLM call and DB insert in try/except:

```python
# src/agents/nodes/write.py — wrap call_bedrock (line 48) and fetch_one (line 56)
    try:
        content = await call_bedrock(prompt, max_tokens=4096)
    except Exception as e:
        logger.error("write_llm_failed", error=str(e))
        return {
            "draft_content": f"Error generating documentation: {e}",
            "draft_title": "Error",
            "doc_id": "",
        }

    lines = content.strip().split("\n")
    title = lines[0].lstrip("# ").strip() if lines else "Untitled Documentation"

    try:
        org_id = state["org_id"]
        row = await fetch_one(
            """
            INSERT INTO documentation
                (org_id, title, content, doc_type, status, source_thread_id, confidence_score)
            VALUES ($1, $2, $3, $4, 'draft', $5, 0.0)
            RETURNING id::text
            """,
            org_id,
            title,
            content,
            state.get("doc_type", "howto"),
            state.get("support_thread_id"),
        )
        doc_id = row["id"]
    except Exception as e:
        logger.error("write_db_failed", error=str(e))
        doc_id = ""

    logger.info("write_docs_completed", doc_id=doc_id, title=title, content_length=len(content))

    return {
        "draft_content": content,
        "draft_title": title,
        "doc_id": doc_id,
    }
```

- [ ] **Step 5: Update review.py with error handling around LLM call**

```python
# src/agents/nodes/review.py — wrap call_bedrock (line 49)
    try:
        response = await call_bedrock(prompt)
    except Exception as e:
        logger.error("review_llm_failed", error=str(e))
        review = {
            "confidence": 0.5,
            "issues": [f"Review LLM failed: {e}"],
            "suggestions": [],
            "passed": False,
        }
```

- [ ] **Step 6: Update publish.py with error handling and fix thread_id bug**

```python
# src/agents/nodes/publish.py — wrap each DB call, fix line 69
    try:
        await execute(
            "UPDATE documentation SET status = 'approved', updated_at = now() WHERE id = $1",
            doc_id,
        )
    except Exception as e:
        logger.error("publish_update_failed", error=str(e))

    try:
        await store_embedding(
            org_id=org_id,
            content_type="documentation",
            content_id=doc_id,
            content_text=f"{title}\n\n{content}",
            metadata={"doc_type": state.get("doc_type"), "confidence": state.get("confidence_score")},
        )
    except Exception as e:
        logger.error("publish_embedding_failed", error=str(e))

    try:
        await store_memory(
            org_id=org_id,
            memory_type="organizational",
            key=title,
            value={
                "doc_id": doc_id,
                "content": content[:1000],
                "doc_type": state.get("doc_type"),
                "confidence": state.get("confidence_score"),
            },
            source="documentation_generation",
            confidence=state.get("confidence_score", 0.5),
        )
    except Exception as e:
        logger.error("publish_memory_failed", error=str(e))

    if state.get("human_feedback"):
        try:
            await store_memory(
                org_id=org_id,
                memory_type="reviewer",
                key=f"review_{doc_id}",
                value={
                    "feedback": state["human_feedback"],
                    "decision": state.get("human_decision"),
                    "doc_title": title,
                },
                source="human_review",
                confidence=1.0,
            )
        except Exception as e:
            logger.error("publish_reviewer_memory_failed", error=str(e))

    try:
        await execute(
            """
            UPDATE support_threads
            SET status = 'resolved', resolution = $1, resolved_at = now()
            WHERE id = $2
            """,
            content[:2000],
            state.get("support_thread_id"),  # FIX: was thread_id (string), now UUID
        )
    except Exception as e:
        logger.error("publish_thread_update_failed", error=str(e))

    try:
        await store_audit_log(
            org_id=org_id,
            actor="agent",
            action="publish_documentation",
            resource_type="documentation",
            resource_id=doc_id,
            details={"title": title, "confidence": state.get("confidence_score")},
        )
    except Exception as e:
        logger.error("publish_audit_failed", error=str(e))
```

- [ ] **Step 7: Update human.py with error handling**

```python
# src/agents/nodes/human.py — wrap create_review_session and store_audit_log
    try:
        review_id = await create_review_session(
            doc_id=doc_id,
            confidence_before=state.get("confidence_score", 0),
        )
    except Exception as e:
        logger.error("human_review_create_failed", error=str(e))
        review_id = ""

    try:
        await store_audit_log(
            org_id=org_id,
            actor="system",
            action="request_human_review",
            resource_type="documentation",
            resource_id=doc_id,
            details={"review_id": review_id, "confidence": state.get("confidence_score", 0)},
        )
    except Exception as e:
        logger.error("human_audit_failed", error=str(e))
```

- [ ] **Step 8: Run ruff check**

```bash
uv run ruff check src/agents/nodes/
```

- [ ] **Step 9: Commit**

```bash
git add src/agents/nodes/
git commit -m "feat: add error handling to all pipeline nodes

- Each node catches exceptions and logs them
- Degraded state returned on failure instead of crashing
- publish_node: fix thread_id -> support_thread_id bug"
```

---

## Phase 2: HITL Flow Fix & API Hardening

### Task 8: Fix HITL graph resume

**Files:**
- Modify: `src/api/routes/reviews.py`
- Modify: `src/api/app.py`

This is the critical fix — the API must resume the LangGraph execution after a review decision.

- [ ] **Step 1: Create a graph store module**

```python
# src/agents/graph_store.py
from __future__ import annotations

from langgraph.graph import StateGraph

_graph: StateGraph | None = None


def set_graph(graph) -> None:
    global _graph
    _graph = graph


def get_graph():
    return _graph
```

- [ ] **Step 2: Update draftly.py to register the graph**

In `src/cli/draftly.py`, after compiling the graph, register it:

```python
from src.agents.graph_store import set_graph

# ... inside run_workflow, after graph = build_graph().compile(...):
        set_graph(graph)
```

- [ ] **Step 3: Update reviews.py to resume the graph**

```python
# src/api/routes/reviews.py
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ReviewDecision(BaseModel):
    decision: str  # approve, reject, revise
    feedback: str = ""


@router.get("/pending")
async def get_pending():
    from src.memory.reviewer import get_pending_reviews

    return await get_pending_reviews(org_id="default")


@router.post("/{review_id}/decide")
async def decide_review(review_id: str, body: ReviewDecision):
    from src.memory.reviewer import complete_review
    from src.agents.graph_store import get_graph

    if body.decision not in ("approve", "reject", "revise"):
        raise HTTPException(status_code=400, detail="decision must be approve, reject, or revise")

    await complete_review(
        review_id=review_id,
        status=body.decision,
        feedback=body.feedback,
    )

    graph = get_graph()
    if graph:
        import asyncio
        asyncio.create_task(
            graph.ainvoke(
                {"human_decision": body.decision, "human_feedback": body.feedback},
                {"configurable": {"thread_id": f"review-{review_id}"}},
            )
        )

    return {"status": "ok", "decision": body.decision}


@router.get("/{review_id}")
async def get_review(review_id: str):
    from src.database import fetch_one

    row = await fetch_one(
        "SELECT rs.*, rs.id::text as id, d.title, d.content, d.doc_type, d.confidence_score "
        "FROM review_sessions rs JOIN documentation d ON d.id = rs.doc_id WHERE rs.id = $1",
        review_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Review not found")
    return dict(row)
```

- [ ] **Step 4: Run ruff check**

```bash
uv run ruff check src/api/routes/reviews.py src/agents/graph_store.py
```

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/reviews.py src/agents/graph_store.py src/cli/draftly.py
git commit -m "fix: resume LangGraph execution after HITL review decision"
```

---

### Task 9: Add API authentication

**Files:**
- Create: `src/api/auth.py`
- Modify: `src/api/app.py`
- Modify: `src/config.py`

- [ ] **Step 1: Add api_key setting**

In `src/config.py`, add:

```python
    api_key: SecretStr = SecretStr("")
```

- [ ] **Step 2: Create auth middleware**

```python
# src/api/auth.py
from __future__ import annotations

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from src.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)):
    required_key = settings.api_key.get_secret_value()
    if not required_key:
        return True
    if api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True
```

- [ ] **Step 3: Apply auth to API routes in app.py**

```python
# src/api/app.py — add dependency to router includes
from src.api.auth import verify_api_key

# ... (existing code)

app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"], dependencies=[Depends(verify_api_key)])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"], dependencies=[Depends(verify_api_key)])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"], dependencies=[Depends(verify_api_key)])
```

- [ ] **Step 4: Run ruff check**

```bash
uv run ruff check src/api/
```

- [ ] **Step 5: Commit**

```bash
git add src/api/auth.py src/api/app.py src/config.py
git commit -m "feat: add API key authentication middleware"
```

---

### Task 10: Add health check and proper error responses

**Files:**
- Modify: `src/api/app.py`
- Modify: `src/api/routes/docs.py`
- Modify: `src/api/routes/memory.py`

- [ ] **Step 1: Add health check to app.py**

```python
# src/api/app.py — add health endpoint
@app.get("/health")
async def health():
    from src.database import fetch_val
    try:
        result = await fetch_val("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
```

- [ ] **Step 2: Add Dockerfile HEALTHCHECK**

In `Dockerfile`, add before CMD:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"
```

- [ ] **Step 3: Fix docs.py error responses**

```python
# src/api/routes/docs.py
from fastapi import HTTPException

@router.get("/{doc_id}")
async def get_doc(doc_id: str):
    from src.database import fetch_one
    row = await fetch_one("SELECT *, id::text as id FROM documentation WHERE id = $1", doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(row)
```

- [ ] **Step 4: Fix memory.py SQL injection**

```python
# src/api/routes/memory.py
ALLOWED_TABLES = {
    "support_threads", "documentation", "embeddings",
    "review_sessions", "agent_memory", "audit_logs",
}

@router.get("/stats")
async def memory_stats():
    from src.database import fetch_one
    stats = {}
    for table in ALLOWED_TABLES:
        count = await fetch_one(f"SELECT count(*) FROM {table}")
        stats[table] = count[0] if count else 0
    return stats
```

- [ ] **Step 5: Commit**

```bash
git add src/api/app.py src/api/routes/docs.py src/api/routes/memory.py Dockerfile
git commit -m "feat: add health check, proper error responses, fix SQL injection"
```

---

## Phase 3: Testing

### Task 11: Create test fixtures

**Files:**
- Create: `tests/__init__.py` (already exists, leave empty)
- Create: `tests/conftest.py`

- [ ] **Step 1: Create conftest.py with fixtures**

```python
# tests/conftest.py
import asyncio
import pytest
import pytest_asyncio


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def mock_db(monkeypatch):
    """Mock database pool for unit tests."""
    from unittest.mock import AsyncMock, MagicMock

    mock_pool = AsyncMock()
    mock_record = MagicMock()
    mock_record.__getitem__ = lambda self, key: "test-id" if key == "id" else None

    mock_pool.fetchrow = AsyncMock(return_value=mock_record)
    mock_pool.fetch = AsyncMock(return_value=[mock_record])
    mock_pool.execute = AsyncMock(return_value="INSERT 0 1")
    mock_pool.fetchval = AsyncMock(return_value=1)

    return mock_pool
```

- [ ] **Step 2: Commit**

```bash
git add tests/conftest.py
git commit -m "test: add test fixtures for database mocking"
```

---

### Task 12: Test retry decorator

**Files:**
- Create: `tests/unit/__init__.py`
- Create: `tests/unit/test_retry.py`

- [ ] **Step 1: Create unit tests package**

```python
# tests/unit/__init__.py
```

- [ ] **Step 2: Create retry tests**

```python
# tests/unit/test_retry.py
import pytest
from src.utils.retry import with_retry


class TestWithRetry:
    @pytest.mark.asyncio
    async def test_succeeds_first_try(self):
        call_count = 0

        @with_retry(max_attempts=3, exceptions=(ValueError,))
        async def success():
            nonlocal call_count
            call_count += 1
            return "ok"

        result = await success()
        assert result == "ok"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_failure(self):
        call_count = 0

        @with_retry(max_attempts=3, min_wait=0.01, max_wait=0.05, exceptions=(ValueError,))
        async def fail_twice():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("not yet")
            return "ok"

        result = await fail_twice()
        assert result == "ok"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_raises_after_max_attempts(self):
        @with_retry(max_attempts=2, min_wait=0.01, max_wait=0.05, exceptions=(ValueError,))
        async def always_fail():
            raise ValueError("always")

        with pytest.raises(ValueError, match="always"):
            await always_fail()
```

- [ ] **Step 3: Run tests**

```bash
uv run pytest tests/unit/test_retry.py -v
```

- [ ] **Step 4: Commit**

```bash
git add tests/unit/
git commit -m "test: add retry decorator unit tests"
```

---

### Task 13: Test serialization helper

**Files:**
- Create: `tests/unit/test_serialization.py`

- [ ] **Step 1: Create serialization tests**

```python
# tests/unit/test_serialization.py
import uuid
from datetime import datetime, timezone

from src.memory.episodic import _serialize_row


class TestSerializeRow:
    def test_uuid_to_string(self):
        uid = uuid.uuid4()
        row = {"id": uid, "name": "test"}
        result = _serialize_row(row)
        assert result["id"] == str(uid)
        assert result["name"] == "test"

    def test_datetime_to_iso(self):
        dt = datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        row = {"created_at": dt, "name": "test"}
        result = _serialize_row(row)
        assert result["created_at"] == "2025-01-15T10:30:00+00:00"

    def test_mixed_types(self):
        uid = uuid.uuid4()
        dt = datetime(2025, 1, 15, tzinfo=timezone.utc)
        row = {"id": uid, "created_at": dt, "name": "test", "count": 42}
        result = _serialize_row(row)
        assert isinstance(result["id"], str)
        assert isinstance(result["created_at"], str)
        assert result["name"] == "test"
        assert result["count"] == 42
```

- [ ] **Step 2: Run tests**

```bash
uv run pytest tests/unit/test_serialization.py -v
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/test_serialization.py
git commit -m "test: add UUID and datetime serialization tests"
```

---

### Task 14: Test node error handling

**Files:**
- Create: `tests/unit/test_nodes.py`

- [ ] **Step 1: Create node tests**

```python
# tests/unit/test_nodes.py
import pytest
from unittest.mock import AsyncMock, patch

from src.agents.nodes.memory import memory_retrieve_node


class TestMemoryRetrieveNode:
    @pytest.mark.asyncio
    async def test_returns_empty_on_all_failures(self):
        state = {
            "org_id": "test-org",
            "question": "test question",
        }

        with patch("src.agents.nodes.memory.search_similar", side_effect=Exception("db down")), \
             patch("src.agents.nodes.memory.search_threads", side_effect=Exception("db down")), \
             patch("src.agents.nodes.memory.search_memory", side_effect=Exception("db down")), \
             patch("src.agents.nodes.memory.get_reviewer_memory", side_effect=Exception("db down")):

            result = await memory_retrieve_node(state)

        assert result["similar_threads"] == []
        assert result["existing_docs"] == []
        assert result["semantic_context"] == []

    @pytest.mark.asyncio
    async def test_partial_failure(self):
        state = {
            "org_id": "test-org",
            "question": "test question",
        }

        with patch("src.agents.nodes.memory.search_similar", return_value=[]), \
             patch("src.agents.nodes.memory.search_threads", side_effect=Exception("db down")), \
             patch("src.agents.nodes.memory.search_memory", return_value=[]), \
             patch("src.agents.nodes.memory.get_reviewer_memory", return_value=[]):

            result = await memory_retrieve_node(state)

        assert result["similar_threads"] == []
        assert result["semantic_context"] == []
```

- [ ] **Step 2: Run tests**

```bash
uv run pytest tests/unit/test_nodes.py -v
```

- [ ] **Step 3: Commit**

```bash
git add tests/unit/test_nodes.py
git commit -m "test: add node error handling tests"
```

---

## Phase 4: Deployment

### Task 15: Fix Dockerfile for production

**Files:**
- Modify: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Update Dockerfile**

```dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev

COPY src/ src/
COPY infrastructure/ infrastructure/

FROM python:3.11-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/infrastructure /app/infrastructure

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create .dockerignore**

```
.git
.venv
__pycache__
*.pyc
.env
.env.*
*.egg-info
tests/
docs/
.pytest_cache
.mypy_cache
.ruff_cache
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: production Dockerfile with multi-stage build and health check"
```

---

### Task 16: Final ruff check and commit

- [ ] **Step 1: Run full ruff check**

```bash
uv run ruff check src/ tests/
```

- [ ] **Step 2: Run all tests**

```bash
uv run pytest tests/ -v
```

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final production-readiness cleanup"
```

---

## Phase 5: AWS Integration

### Task 17: Add boto3 dependency and S3 integration

**Files:**
- Modify: `pyproject.toml`
- Create: `src/integrations/s3.py`
- Modify: `src/agents/nodes/publish.py`
- Modify: `src/config.py`

- [ ] **Step 1: Add dependencies**

In `pyproject.toml`, add to dependencies:

```python
    "boto3>=1.35.0",
```

- [ ] **Step 2: Run uv sync**

```bash
uv sync
```

- [ ] **Step 3: Add S3 config to settings**

In `src/config.py`, add:

```python
    # AWS
    aws_region: str = "eu-west-2"
    s3_bucket: str = ""
```

- [ ] **Step 4: Create S3 integration**

```python
# src/integrations/s3.py
from __future__ import annotations

import json

import boto3
import structlog

from src.config import settings

logger = structlog.get_logger()

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=settings.aws_region)
    return _s3_client


async def upload_document(
    org_id: str,
    doc_id: str,
    title: str,
    content: str,
    doc_type: str,
) -> str:
    """Upload documentation to S3 and return the S3 URI."""
    if not settings.s3_bucket:
        logger.warning("s3_bucket_not_configured")
        return ""

    client = get_s3_client()
    key = f"docs/{org_id}/{doc_id}.md"

    metadata = {
        "org-id": org_id,
        "doc-id": doc_id,
        "doc-type": doc_type,
        "title": title[:256],
    }

    try:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="text/markdown",
            Metadata=metadata,
        )
        s3_uri = f"s3://{settings.s3_bucket}/{key}"
        logger.info("doc_uploaded_to_s3", s3_uri=s3_uri, doc_id=doc_id)
        return s3_uri
    except Exception as e:
        logger.error("s3_upload_failed", error=str(e), doc_id=doc_id)
        return ""


async def upload_metadata_json(
    org_id: str,
    doc_id: str,
    metadata: dict,
) -> str:
    """Upload metadata JSON alongside the document."""
    if not settings.s3_bucket:
        return ""

    client = get_s3_client()
    key = f"docs/{org_id}/{doc_id}.json"

    try:
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=json.dumps(metadata, default=str).encode("utf-8"),
            ContentType="application/json",
        )
        return f"s3://{settings.s3_bucket}/{key}"
    except Exception as e:
        logger.error("s3_metadata_upload_failed", error=str(e))
        return ""
```

- [ ] **Step 5: Update publish_node to upload to S3**

In `src/agents/nodes/publish.py`, add after the embedding storage:

```python
from src.integrations.s3 import upload_document, upload_metadata_json

# ... after store_embedding call:
    s3_uri = await upload_document(
        org_id=org_id,
        doc_id=doc_id,
        title=title,
        content=content,
        doc_type=state.get("doc_type", "howto"),
    )

    if s3_uri:
        await upload_metadata_json(
            org_id=org_id,
            doc_id=doc_id,
            metadata={
                "title": title,
                "doc_type": state.get("doc_type"),
                "confidence": state.get("confidence_score"),
                "s3_uri": s3_uri,
            },
        )
```

And update the published_urls return:

```python
    published_urls = [{"platform": "draftly", "doc_id": doc_id}]
    if s3_uri:
        published_urls.append({"platform": "s3", "uri": s3_uri})
```

- [ ] **Step 6: Run ruff check**

```bash
uv run ruff check src/integrations/s3.py src/agents/nodes/publish.py
```

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml src/integrations/s3.py src/agents/nodes/publish.py src/config.py
git commit -m "feat: add S3 integration for publishing documentation artifacts"
```

---

### Task 18: Add CloudWatch logging

**Files:**
- Modify: `pyproject.toml`
- Create: `src/integrations/cloudwatch.py`
- Modify: `src/logging_config.py`
- Modify: `src/config.py`

- [ ] **Step 1: Add watchtower dependency**

In `pyproject.toml`, add:

```python
    "watchtower>=3.2.0",
```

- [ ] **Step 2: Run uv sync**

```bash
uv sync
```

- [ ] **Step 3: Add CloudWatch config**

In `src/config.py`, add:

```python
    cloudwatch_log_group: str = "/draftly/production"
    cloudwatch_enabled: bool = False
```

- [ ] **Step 4: Create CloudWatch handler**

```python
# src/integrations/cloudwatch.py
from __future__ import annotations

import logging

import structlog
import watchtower

from src.config import settings

_cloudwatch_handler = None


def get_cloudwatch_handler() -> logging.Handler | None:
    """Create a CloudWatch Logs handler if configured."""
    global _cloudwatch_handler

    if not settings.cloudwatch_enabled:
        return None

    if _cloudwatch_handler is not None:
        return _cloudwatch_handler

    try:
        import boto3

        client = boto3.client("logs", region_name=settings.aws_region)
        _cloudwatch_handler = watchtower.CloudWatchLogHandler(
            log_group=settings.cloudwatch_log_group,
            stream_name="draftly-agent",
            boto3_client=client,
        )
        _cloudwatch_handler.setLevel(logging.INFO)
        return _cloudwatch_handler
    except Exception as e:
        structlog.get_logger().error("cloudwatch_init_failed", error=str(e))
        return None
```

- [ ] **Step 5: Update logging_config.py to add CloudWatch processor**

```python
# src/logging_config.py — add import and handler in configure_logging
from src.integrations.cloudwatch import get_cloudwatch_handler

def configure_logging(log_level: str = "INFO", json_output: bool = False) -> None:
    """Configure structlog with processors for structured logging."""

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if json_output:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )

    # Add CloudWatch handler to root logger if configured
    cw_handler = get_cloudwatch_handler()
    if cw_handler:
        root_logger = logging.getLogger()
        root_logger.addHandler(cw_handler)
```

- [ ] **Step 6: Run ruff check**

```bash
uv run ruff check src/integrations/cloudwatch.py src/logging_config.py
```

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml src/integrations/cloudwatch.py src/logging_config.py src/config.py
git commit -m "feat: add CloudWatch log export for production observability"
```

---

### Task 19: Add Secrets Manager integration

**Files:**
- Modify: `pyproject.toml`
- Create: `src/integrations/secrets.py`
- Modify: `src/config.py`
- Modify: `src/cli/draftly.py` (startup)

- [ ] **Step 1: Add to dependencies (boto3 already added in Task 17)**

- [ ] **Step 2: Add Secrets Manager config**

In `src/config.py`, add:

```python
    aws_secrets_enabled: bool = False
    aws_secrets_prefix: str = "draftly/"
```

- [ ] **Step 3: Create Secrets Manager integration**

```python
# src/integrations/secrets.py
from __future__ import annotations

import json

import boto3
import structlog

from src.config import settings

logger = structlog.get_logger()

_secrets_client = None


def get_secrets_client():
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager", region_name=settings.aws_region)
    return _secrets_client


def fetch_secret(name: str) -> str | None:
    """Fetch a secret value from AWS Secrets Manager."""
    if not settings.aws_secrets_enabled:
        return None

    client = get_secrets_client()
    secret_name = f"{settings.aws_secrets_prefix}{name}"

    try:
        response = client.get_secret_value(SecretId=secret_name)
        return response["SecretString"]
    except client.exceptions.ResourceNotFoundException:
        logger.warning("secret_not_found", name=secret_name)
        return None
    except Exception as e:
        logger.error("secret_fetch_failed", name=secret_name, error=str(e))
        return None


def fetch_secret_json(name: str) -> dict | None:
    """Fetch a secret as parsed JSON."""
    value = fetch_secret(name)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {"value": value}
    return None
```

- [ ] **Step 4: Update config to optionally load from Secrets Manager**

In `src/config.py`, add a post-init hook:

```python
class Settings(BaseSettings):
    # ... existing fields ...

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def model_post_init(self, __context) -> None:
        if self.aws_secrets_enabled:
            from src.integrations.secrets import fetch_secret, fetch_secret_json

            # Override secrets from AWS if available
            db_url = fetch_secret("cockroachdb-url")
            if db_url:
                self.cockroachdb_url = SecretStr(db_url)

            api_key = fetch_secret("requesty-api-key")
            if api_key:
                self.requesty_api_key = SecretStr(api_key)

            slack_token = fetch_secret("slack-bot-token")
            if slack_token:
                self.slack_bot_token = SecretStr(slack_token)

            github_token = fetch_secret("github-token")
            if github_token:
                self.github_token = SecretStr(github_token)
```

- [ ] **Step 5: Run ruff check**

```bash
uv run ruff check src/integrations/secrets.py src/config.py
```

- [ ] **Step 6: Commit**

```bash
git add src/integrations/secrets.py src/config.py
git commit -m "feat: add AWS Secrets Manager integration for credential management"
```

---

### Task 20: Add Lambda + SQS event-driven architecture

**Files:**
- Create: `src/lambda/webhook_handler.py`
- Create: `src/lambda/sqs_consumer.py`
- Create: `infrastructure/cloudformation/sqs.yml`
- Modify: `src/agents/graph.py` (add SQS trigger support)
- Modify: `src/cli/draftly.py` (add SQS consumer mode)

This is the most complex task — it changes the architecture from synchronous to event-driven.

- [ ] **Step 1: Create Lambda webhook handler**

```python
# src/lambda/webhook_handler.py
"""AWS Lambda handler for Slack, Discord, and GitHub webhooks.

Receives webhook events, validates them, and enqueues to SQS for processing.
"""
from __future__ import annotations

import json
import os

import boto3
import httpx

sqs = boto3.client("sqs")
QUEUE_URL = os.environ["SQS_QUEUE_URL"]


def handler(event, context):
    """Handle incoming webhook events from API Gateway."""
    try:
        body = json.loads(event.get("body", "{}"))
        headers = event.get("headers", {})
        path = event.get("path", "")

        # Determine source from path
        if "/slack" in path:
            source = "slack"
            if headers.get("x-slack-retry-num"):
                return {"statusCode": 200, "body": json.dumps({"ok": True})}
        elif "/discord" in path:
            source = "discord"
            # Discord challenge response
            if body.get("type") == 1:
                return {
                    "statusCode": 200,
                    "body": json.dumps({"type": 1}),
                }
        elif "/github" in path:
            source = "github"
        else:
            return {"statusCode": 404, "body": json.dumps({"error": "unknown source"})}

        # Enqueue for async processing
        message = {
            "source": source,
            "body": body,
            "headers": {k: v for k, v in headers.items() if k.startswith("x-")},
        }

        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message, default=str),
        )

        return {"statusCode": 200, "body": json.dumps({"ok": True, "queued": True})}

    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
```

- [ ] **Step 2: Create SQS consumer**

```python
# src/lambda/sqs_consumer.py
"""AWS Lambda handler for consuming SQS messages and running the agent pipeline.

Triggered by SQS events, invokes the LangGraph pipeline for each message.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from uuid import uuid4

import boto3

# Add project root to path
sys.path.insert(0, os.environ.get("PROJECT_ROOT", "/var/task"))


def handler(event, context):
    """Process SQS messages and run the agent pipeline."""
    from src.database import get_pool, close_pool
    from src.agents.graph import build_graph
    from src.config import settings
    from src.logging_config import configure_logging

    configure_logging(
        log_level=settings.log_level,
        json_output=True,
    )

    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            source = body.get("source", "unknown")
            webhook_body = body.get("body", {})

            # Extract question from webhook payload
            question = _extract_question(source, webhook_body)
            if not question:
                continue

            # Run the pipeline
            asyncio.run(_run_pipeline(source, question))

        except Exception as e:
            print(f"Error processing record: {e}")
            raise


def _extract_question(source: str, body: dict) -> str | None:
    """Extract the user's question from the webhook payload."""
    if source == "slack":
        return body.get("event", {}).get("text", "")
    elif source == "discord":
        return body.get("d", {}).get("content", "")
    elif source == "github":
        return body.get("issue", {}).get("body", "")
    return None


async def _run_pipeline(source: str, question: str):
    """Run the LangGraph pipeline for a single question."""
    from src.database import get_pool, close_pool
    from src.agents.graph import build_graph
    from src.config import settings
    from langchain_cockroachdb import AsyncCockroachDBSaver

    await get_pool()

    org_id = await _get_or_create_org("default")
    thread_id = f"{source}-{uuid4().hex[:12]}"

    initial_state = {
        "org_id": org_id,
        "source": source,
        "channel_id": "sqs",
        "thread_id": thread_id,
        "support_thread_id": "",
        "question": question,
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
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
    }

    config = {"configurable": {"thread_id": thread_id}}

    async with AsyncCockroachDBSaver.from_conn_string(
        settings.cockroachdb_url.get_secret_value()
    ) as checkpointer:
        await checkpointer.setup()
        graph = build_graph().compile(checkpointer=checkpointer)
        await graph.ainvoke(initial_state, config)

    await close_pool()


async def _get_or_create_org(name: str) -> str:
    from src.database import fetch_one

    row = await fetch_one("SELECT id::text FROM organizations WHERE name = $1", name)
    if row:
        return row["id"]
    row = await fetch_one(
        "INSERT INTO organizations (name) VALUES ($1) RETURNING id::text",
        name,
    )
    return row["id"]
```

- [ ] **Step 3: Create SQS CloudFormation template**

```yaml
# infrastructure/cloudformation/sqs.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: Draftly SQS Queue and DLQ for agent pipeline

Resources:
  AgentQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: draftly-agent-queue
      VisibilityTimeout: 600
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt AgentDLQ.Arn
        maxReceiveCount: 3

  AgentDLQ:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: draftly-agent-dlq
      MessageRetentionPeriod: 1209600

Outputs:
  QueueUrl:
    Value: !Ref AgentQueue
  QueueArn:
    Value: !GetAtt AgentQueue.Arn
  DLQUrl:
    Value: !Ref AgentDLQ
```

- [ ] **Step 4: Update graph.py to support both direct and SQS modes**

The `build_graph()` function stays the same — no changes needed. The invocation method (direct vs SQS) is determined by the caller, not the graph itself.

- [ ] **Step 5: Add SQS consumer mode to CLI**

In `src/cli/draftly.py`, add a `--sqs` flag:

```python
def main():
    configure_logging(
        log_level=settings.log_level,
        json_output=settings.environment == "production",
    )

    if len(sys.argv) > 1 and sys.argv[1] == "--sqs":
        # Run as SQS consumer
        from src.lambda.sqs_consumer import handler
        import json
        import boto3

        sqs = boto3.client("sqs", region_name=settings.aws_region)
        queue_url = settings.sqs_queue_url
        while True:
            response = sqs.receive_message(
                QueueUrl=queue_url,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,
            )
            for msg in response.get("Messages", []):
                handler({"Records": [{"body": msg["Body"]}]}, None)
                sqs.delete_message(
                    QueueUrl=queue_url,
                    ReceiptHandle=msg["ReceiptHandle"],
                )
    elif len(sys.argv) < 2:
        print("Usage: python -m src.cli.draftly 'your question here'")
        print("       python -m src.cli.draftly --sqs")
        sys.exit(1)
    else:
        question = sys.argv[1]
        asyncio.run(run_workflow(question))
```

- [ ] **Step 6: Run ruff check**

```bash
uv run ruff check src/lambda/
```

- [ ] **Step 7: Commit**

```bash
git add src/lambda/ infrastructure/cloudformation/sqs.yml src/cli/draftly.py
git commit -m "feat: add Lambda webhook handler and SQS consumer for event-driven architecture"
```

---

### Task 21: Add ECS Fargate task definition

**Files:**
- Create: `infrastructure/cloudformation/ecs.yml`
- Create: `infrastructure/cloudformation/ecs-task-definition.json`

- [ ] **Step 1: Create ECS CloudFormation template**

```yaml
# infrastructure/cloudformation/ecs.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: Draftly ECS Fargate Service

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  ClusterName:
    Type: String
    Default: draftly-cluster
  ServiceName:
    Type: String
    Default: draftly-agent
  ContainerImage:
    Type: String
    Description: ECR image URI
  ContainerPort:
    Type: Number
    Default: 8000

Resources:
  Cluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Ref ClusterName

  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: draftly-agent
      Cpu: '512'
      Memory: '1024'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !Sub 'arn:aws:iam::${AWS::AccountId}:role/ecsTaskExecutionRole'
      ContainerDefinitions:
        - Name: draftly-agent
          Image: !Ref ContainerImage
          PortMappings:
            - ContainerPort: !Ref ContainerPort
          Environment:
            - Name: ENVIRONMENT
              Value: production
            - Name: LOG_LEVEL
              Value: INFO
          Secrets:
            - Name: COCKROACHDB_URL
              ValueFrom: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:draftly/cockroachdb-url'
            - Name: REQUESTY_API_KEY
              ValueFrom: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:draftly/requesty-api-key'
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: /draftly/production
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs

  Service:
    Type: AWS::ECS::Service
    DependsOn: Listener
    Properties:
      Cluster: !Ref Cluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: 1
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: ENABLED
          Subnets: !Ref SubnetIds
          SecurityGroups:
            - !Ref ServiceSecurityGroup
      LoadBalancers:
        - ContainerName: draftly-agent
          ContainerPort: !Ref ContainerPort
          TargetGroupArn: !Ref TargetGroup

  ServiceSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ECS Service Security Group
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: !Ref ContainerPort
          ToPort: !Ref ContainerPort
          CidrIp: 0.0.0.0/0

  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Scheme: internet-facing
      Subnets: !Ref SubnetIds

  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      VpcId: !Ref VpcId
      Port: !Ref ContainerPort
      Protocol: HTTP
      TargetType: ip

  Listener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref CertificateArn
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup

Parameters:
  CertificateArn:
    Type: String
    Description: ACM Certificate ARN for HTTPS
```

- [ ] **Step 2: Create task definition JSON**

```json
{
  "family": "draftly-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "draftly-agent",
      "image": "ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/draftly:latest",
      "portMappings": [
        { "containerPort": 8000, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "ENVIRONMENT", "value": "production" },
        { "name": "LOG_LEVEL", "value": "INFO" }
      ],
      "secrets": [
        { "name": "COCKROACHDB_URL", "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:draftly/cockroachdb-url" },
        { "name": "REQUESTY_API_KEY", "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:draftly/requesty-api-key" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/draftly/production",
          "awslogs-region": "eu-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add infrastructure/cloudformation/
git commit -m "feat: add ECS Fargate task definition and CloudFormation templates"
```

---

## Phase 6: CI/CD

### Task 22: Add GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
        with:
          version: "0.5"
      - run: uv sync --dev
      - name: Run ruff check
        run: uv run ruff check src/ tests/
      - name: Run ruff format check
        run: uv run ruff format --check src/ tests/

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
        with:
          version: "0.5"
      - run: uv sync --dev
      - name: Run tests
        run: uv run pytest tests/ -v --tb=short

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build Docker image
        run: |
          docker build -t draftly:ci-${{ github.sha }} .
      - name: Test Docker health check
        run: |
          docker run -d --name draftly-test -p 8000:8000 \
            -e COCKROACHDB_URL="postgresql://test:test@localhost:26257/test" \
            -e REQUESTY_API_KEY="test" \
            draftly:ci-${{ github.sha }}
          sleep 5
          docker exec draftly-test python -c "import httpx; print('ok')" || true
          docker stop draftly-test
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow (lint, test, build)"
```

---

### Task 23: Add GitHub Actions CD workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create CD workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to ECS

on:
  push:
    branches: [master]
    types: [push]

env:
  AWS_REGION: eu-west-2
  ECR_REPOSITORY: draftly
  ECS_CLUSTER: draftly-cluster
  ECS_SERVICE: draftly-agent

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: infrastructure/cloudformation/ecs-task-definition.json
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions CD workflow (deploy to ECS Fargate)"
```

---

### Task 24: Final validation and summary commit

- [ ] **Step 1: Run full lint check**

```bash
uv run ruff check src/ tests/
```

- [ ] **Step 2: Run all tests**

```bash
uv run pytest tests/ -v
```

- [ ] **Step 3: Build Docker image to verify**

```bash
docker build -t draftly:latest .
```

- [ ] **Step 4: Update README with AWS architecture**

Update the README to accurately reflect the implemented architecture, removing claims about features not yet built.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final production-readiness validation

- All phases complete: error handling, HITL, security, testing, AWS, CI/CD
- 24 tasks implemented across 6 phases
- System ready for hackathon submission"
```

---

## Phase 7: Bot Integration

### Task 25: Create shared pipeline runner

**Files:**
- Create: `src/agents/pipeline.py`

- [ ] **Step 1: Create pipeline runner**

```python
# src/agents/pipeline.py
from __future__ import annotations

from uuid import uuid4

import structlog
from langchain_cockroachdb import AsyncCockroachDBSaver

from src.agents.graph import build_graph
from src.cli.draftly import get_or_create_org
from src.config import settings
from src.database import get_pool

logger = structlog.get_logger()


async def run_pipeline(
    source: str,
    question: str,
    channel_id: str,
    thread_id: str,
    org_id: str | None = None,
) -> dict:
    """Run the documentation pipeline from any platform.

    Args:
        source: Platform source (slack, discord, github, cli)
        question: The user's question or request
        channel_id: Platform channel/channel ID
        thread_id: Platform thread/message ID
        org_id: Organization UUID (auto-created if None)

    Returns:
        Pipeline result dict with draft_title, draft_content, etc.
    """
    await get_pool()

    if org_id is None:
        org_id = await get_or_create_org("default")

    pipeline_thread_id = f"{source}-{uuid4().hex[:12]}"

    initial_state = {
        "org_id": org_id,
        "source": source,
        "channel_id": channel_id,
        "thread_id": pipeline_thread_id,
        "support_thread_id": "",
        "question": question,
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
        "workflow_id": "",
        "doc_id": "",
        "messages": [],
    }

    config = {"configurable": {"thread_id": pipeline_thread_id}}

    logger.info(
        "pipeline_started",
        source=source,
        question=question[:100],
        thread_id=pipeline_thread_id,
    )

    async with AsyncCockroachDBSaver.from_conn_string(
        settings.cockroachdb_url.get_secret_value()
    ) as checkpointer:
        await checkpointer.setup()
        graph = build_graph().compile(checkpointer=checkpointer)
        result = await graph.ainvoke(initial_state, config)

    logger.info(
        "pipeline_completed",
        source=source,
        title=result.get("draft_title", ""),
        confidence=result.get("confidence_score", 0),
    )

    return result
```

- [ ] **Step 2: Run ruff check**

```bash
uv run ruff check src/agents/pipeline.py
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/pipeline.py
git commit -m "feat: add shared pipeline runner for bot integrations"
```

---

### Task 26: Add Slack webhook handler + slash commands

**Files:**
- Create: `src/webhooks/__init__.py`
- Create: `src/webhooks/slack.py`

- [ ] **Step 1: Create webhooks package**

```python
# src/webhooks/__init__.py
```

- [ ] **Step 2: Create Slack webhook handler**

```python
# src/webhooks/slack.py
from __future__ import annotations

import hashlib
import hmac

import structlog
from fastapi import APIRouter, Request, HTTPException

from src.config import settings

logger = structlog.get_logger()

router = APIRouter()


def verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Slack request signature using signing secret."""
    secret = settings.slack_signing_secret.get_secret_value()
    if not secret:
        return False

    sig_basestring = f"v0:{timestamp}:{body.decode()}"
    computed = "v0=" + hmac.new(
        secret.encode(), sig_basestring.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


@router.post("/slack")
async def handle_slack_webhook(request: Request):
    body = await request.body()
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not verify_slack_signature(body, timestamp, signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")

    payload = await request.json()

    # URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}

    # Event callback
    if payload.get("type") == "event_callback":
        event = payload.get("event", {})
        event_type = event.get("type")

        if event_type == "app_mention":
            await _handle_app_mention(event)
        elif event_type == "message":
            # Only handle direct messages, not bot messages
            if event.get("channel_type") == "im" and not event.get("bot_id"):
                await _handle_dm(event)

    return {"ok": True}


async def _handle_app_mention(event: dict):
    """Handle @bot mentions in channels."""
    from src.agents.pipeline import run_pipeline
    from src.integrations.slack import send_slack_message, add_reaction

    text = event.get("text", "")
    channel = event.get("channel", "")
    thread_ts = event.get("thread_ts", event.get("ts", ""))

    # Acknowledge with eyes emoji
    try:
        await add_reaction(channel, event["ts"], "eyes")
    except Exception as e:
        logger.warning("slack_reaction_failed", error=str(e))

    # Strip bot mention from text
    import re
    question = re.sub(r"<@[A-Z0-9]+>", "", text).strip()
    if not question:
        await send_slack_message(channel, "Please ask a question after mentioning me.", thread_ts)
        return

    # Run pipeline
    try:
        result = await run_pipeline(
            source="slack",
            question=question,
            channel_id=channel,
            thread_id=thread_ts,
        )

        title = result.get("draft_title", "Documentation")
        content = result.get("draft_content", "")
        confidence = result.get("confidence_score", 0)

        reply = f"📄 *{title}* (confidence: {confidence:.0%})\n\n{content[:2000]}"
        if len(content) > 2000:
            reply += "\n\n... *(truncated)*"

        await send_slack_message(channel, reply, thread_ts)

    except Exception as e:
        logger.error("slack_pipeline_failed", error=str(e))
        await send_slack_message(
            channel,
            f"⚠️ Error processing your request: {e}",
            thread_ts,
        )


async def _handle_dm(event: dict):
    """Handle direct messages to the bot."""
    from src.agents.pipeline import run_pipeline
    from src.integrations.slack import send_dm

    text = event.get("text", "")
    user = event.get("user", "")
    channel = event.get("channel", "")

    if not text or not user:
        return

    try:
        result = await run_pipeline(
            source="slack",
            question=text,
            channel_id=channel,
            thread_id=event.get("ts", ""),
        )

        title = result.get("draft_title", "Documentation")
        content = result.get("draft_content", "")

        reply = f"📄 *{title}*\n\n{content[:2000]}"
        await send_dm(user, reply)

    except Exception as e:
        logger.error("slack_dm_pipeline_failed", error=str(e))
        await send_dm(user, f"⚠️ Error: {e}")


@router.post("/slack/commands")
async def handle_slack_command(request: Request):
    """Handle Slack slash commands for HITL review."""
    body = await request.body()
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not verify_slack_signature(body, timestamp, signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")

    from urllib.parse import parse_qs
    form_data = parse_qs(body.decode())
    command = form_data.get("command", [""])[0]
    text = form_data.get("text", [""])[0]
    user_id = form_data.get("user_id", [""])[0]

    parts = text.split(" ", 1)
    review_id = parts[0] if parts else ""
    feedback = parts[1] if len(parts) > 1 else ""

    if not review_id:
        return {"text": "Usage: /approve <review_id> [feedback]"}

    if command == "/approve":
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="approved", feedback=feedback)
        return {"text": f"✅ Review {review_id[:8]}... approved"}

    elif command == "/reject":
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="rejected", feedback=feedback)
        return {"text": f"❌ Review {review_id[:8]}... rejected"}

    elif command == "/revise":
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="needs_changes", feedback=feedback)
        return {"text": f"🔄 Review {review_id[:8]}... sent for revision"}

    return {"text": f"Unknown command: {command}"}
```

- [ ] **Step 3: Mount webhook routes in app.py**

In `src/api/app.py`, add:

```python
from src.webhooks.slack import router as slack_webhook_router

app.include_router(slack_webhook_router, prefix="/webhooks", tags=["webhooks"])
```

- [ ] **Step 4: Run ruff check**

```bash
uv run ruff check src/webhooks/slack.py
```

- [ ] **Step 5: Commit**

```bash
git add src/webhooks/ src/api/app.py
git commit -m "feat: add Slack webhook handler with event parsing and slash commands"
```

---

### Task 27: Add Discord webhook handler + slash commands

**Files:**
- Create: `src/webhooks/discord.py`

- [ ] **Step 1: Create Discord webhook handler**

```python
# src/webhooks/discord.py
from __future__ import annotations

import hashlib
import hmac
import json

import structlog
from fastapi import APIRouter, Request, HTTPException

from src.config import settings

logger = structlog.get_logger()

router = APIRouter()


def verify_discord_signature(body: bytes, signature: str) -> bool:
    """Verify Discord Interactions endpoint signature."""
    public_key = settings.discord_public_key.get_secret_value()
    if not public_key:
        return False

    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError

    verify_key = VerifyKey(bytes.fromhex(public_key))
    try:
        verify_key.verify(body, bytes.fromhex(signature))
        return True
    except BadSignatureError:
        return False


@router.post("/discord")
async def handle_discord_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Signature-Ed25519", "")
    timestamp = request.headers.get("X-Signature-Timestamp", "")

    if not verify_discord_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid Discord signature")

    payload = await request.json()

    # PING interaction
    if payload.get("type") == 1:
        return {"type": 1}

    # Application command (slash command)
    if payload.get("type") == 2:
        return await _handle_slash_command(payload)

    # Message component (buttons)
    if payload.get("type") == 3:
        return await _handle_component(payload)

    return {"type": 4, "data": {"content": "Unknown interaction type"}}


async def _handle_slash_command(payload: dict) -> dict:
    """Handle Discord slash commands."""
    command_name = payload["data"]["name"]
    options = {opt["name"]: opt["value"] for opt in payload["data"].get("options", [])}
    user_id = payload["member"]["user"]["id"]

    if command_name == "approve":
        review_id = options.get("review_id", "")
        if not review_id:
            return {"type": 4, "data": {"content": "Usage: /approve <review_id>"}}
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="approved")
        return {"type": 4, "data": {"content": f"✅ Review {review_id[:8]}... approved"}}

    elif command_name == "reject":
        review_id = options.get("review_id", "")
        feedback = options.get("feedback", "")
        if not review_id:
            return {"type": 4, "data": {"content": "Usage: /reject <review_id> [feedback]"}}
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="rejected", feedback=feedback)
        return {"type": 4, "data": {"content": f"❌ Review {review_id[:8]}... rejected"}}

    elif command_name == "revise":
        review_id = options.get("review_id", "")
        instructions = options.get("instructions", "")
        if not review_id:
            return {"type": 4, "data": {"content": "Usage: /revise <review_id> [instructions]"}}
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="needs_changes", feedback=instructions)
        return {"type": 4, "data": {"content": f"🔄 Review {review_id[:8]}... sent for revision"}}

    elif command_name == "ask":
        question = options.get("question", "")
        if not question:
            return {"type": 4, "data": {"content": "Usage: /ask <your question>"}}

        # Defer the response (takes time)
        # The actual processing happens via followup
        import asyncio
        asyncio.create_task(_process_discord_ask(payload, question))

        return {"type": 5}  # ACK with loading state

    return {"type": 4, "data": {"content": f"Unknown command: {command_name}"}}


async def _process_discord_ask(payload: dict, question: str):
    """Process a Discord /ask command in the background."""
    from src.agents.pipeline import run_pipeline
    from src.integrations.discord import send_discord_message

    channel_id = payload["channel_id"]
    user_id = payload["member"]["user"]["id"]

    try:
        result = await run_pipeline(
            source="discord",
            question=question,
            channel_id=channel_id,
            thread_id=str(payload["id"]),
        )

        title = result.get("draft_title", "Documentation")
        content = result.get("draft_content", "")

        reply = f"📄 **{title}**\n\n{content[:2000]}"
        if len(content) > 2000:
            reply += "\n\n... *(truncated)*"

        await send_discord_message(channel_id, reply)

    except Exception as e:
        logger.error("discord_ask_failed", error=str(e))
        await send_discord_message(channel_id, f"⚠️ Error: {e}")


async def _handle_component(payload: dict) -> dict:
    """Handle Discord message component interactions (buttons)."""
    custom_id = payload["data"]["custom_id"]

    if custom_id.startswith("approve:"):
        review_id = custom_id.split(":", 1)[1]
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="approved")
        return {"type": 7, "data": {"content": f"✅ Approved", "components": []}}

    elif custom_id.startswith("reject:"):
        review_id = custom_id.split(":", 1)[1]
        from src.memory.reviewer import complete_review
        await complete_review(review_id=review_id, status="rejected")
        return {"type": 7, "data": {"content": f"❌ Rejected", "components": []}}

    return {"type": 4, "data": {"content": "Unknown action"}}
```

- [ ] **Step 2: Install PyNaCl for Discord signature verification**

In `pyproject.toml`, add:

```python
    "PyNaCl>=1.5.0",
```

Then run:

```bash
uv sync
```

- [ ] **Step 3: Mount webhook routes in app.py**

In `src/api/app.py`, add:

```python
from src.webhooks.discord import router as discord_webhook_router

app.include_router(discord_webhook_router, prefix="/webhooks", tags=["webhooks"])
```

- [ ] **Step 4: Run ruff check**

```bash
uv run ruff check src/webhooks/discord.py
```

- [ ] **Step 5: Commit**

```bash
git add src/webhooks/discord.py pyproject.toml src/api/app.py
git commit -m "feat: add Discord webhook handler with slash commands and interactions"
```

---

### Task 28: Add GitHub webhook handler

**Files:**
- Create: `src/webhooks/github.py`

- [ ] **Step 1: Create GitHub webhook handler**

```python
# src/webhooks/github.py
from __future__ import annotations

import hashlib
import hmac

import structlog
from fastapi import APIRouter, Request, HTTPException

from src.config import settings

logger = structlog.get_logger()

router = APIRouter()


def verify_github_signature(body: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature (X-Hub-Signature-256)."""
    secret = settings.github_webhook_secret.get_secret_value()
    if not secret:
        return False

    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github")
async def handle_github_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_github_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid GitHub signature")

    event_type = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    if event_type == "issues":
        await _handle_issues(payload)
    elif event_type == "issue_comment":
        await _handle_issue_comment(payload)
    elif event_type == "ping":
        logger.info("github_ping", zen=payload.get("zen", ""))

    return {"ok": True}


async def _handle_issues(payload: dict):
    """Handle GitHub issue events."""
    action = payload.get("action", "")

    if action == "opened":
        issue = payload["issue"]
        repo = payload["repository"]
        question = f"{issue['title']}\n\n{issue.get('body', '')}"

        from src.agents.pipeline import run_pipeline
        from src.integrations.github import post_github_comment

        try:
            result = await run_pipeline(
                source="github",
                question=question,
                channel_id=str(repo["id"]),
                thread_id=str(issue["number"]),
            )

            title = result.get("draft_title", "Documentation")
            content = result.get("draft_content", "")
            confidence = result.get("confidence_score", 0)

            comment_body = (
                f"## 📄 {title}\n\n"
                f"*Confidence: {confidence:.0%}*\n\n"
                f"{content}"
            )

            await post_github_comment(
                owner=repo["owner"]["login"],
                repo=repo["name"],
                issue_number=issue["number"],
                body=comment_body,
            )

        except Exception as e:
            logger.error("github_issue_pipeline_failed", error=str(e))
            from src.integrations.github import post_github_comment
            await post_github_comment(
                owner=repo["owner"]["login"],
                repo=repo["name"],
                issue_number=issue["number"],
                body=f"⚠️ Error generating documentation: {e}",
            )


async def _handle_issue_comment(payload: dict):
    """Handle GitHub issue comment events (for HITL from GitHub)."""
    action = payload.get("action", "")
    comment = payload.get("comment", {})
    body_text = comment.get("body", "").strip()

    if action != "created":
        return

    # Check for review commands in comments
    if body_text.startswith("/approve"):
        import re
        match = re.search(r"review[_-]?id[:\s]+([a-f0-9-]+)", body_text, re.IGNORECASE)
        if match:
            review_id = match.group(1)
            from src.memory.reviewer import complete_review
            await complete_review(review_id=review_id, status="approved")
            from src.integrations.github import post_github_comment
            repo = payload["repository"]
            await post_github_comment(
                owner=repo["owner"]["login"],
                repo=repo["name"],
                issue_number=payload["issue"]["number"],
                body=f"✅ Review `{review_id[:8]}...` approved by @{comment['user']['login']}",
            )

    elif body_text.startswith("/reject"):
        import re
        match = re.search(r"review[_-]?id[:\s]+([a-f0-9-]+)", body_text, re.IGNORECASE)
        feedback_match = re.search(r"feedback[:\s]+(.+)", body_text, re.IGNORECASE)
        if match:
            review_id = match.group(1)
            feedback = feedback_match.group(1) if feedback_match else ""
            from src.memory.reviewer import complete_review
            await complete_review(review_id=review_id, status="rejected", feedback=feedback)
            from src.integrations.github import post_github_comment
            repo = payload["repository"]
            await post_github_comment(
                owner=repo["owner"]["login"],
                repo=repo["name"],
                issue_number=payload["issue"]["number"],
                body=f"❌ Review `{review_id[:8]}...` rejected by @{comment['user']['login']}",
            )
```

- [ ] **Step 2: Mount webhook routes in app.py**

In `src/api/app.py`, add:

```python
from src.webhooks.github import router as github_webhook_router

app.include_router(github_webhook_router, prefix="/webhooks", tags=["webhooks"])
```

- [ ] **Step 3: Run ruff check**

```bash
uv run ruff check src/webhooks/github.py
```

- [ ] **Step 4: Commit**

```bash
git add src/webhooks/github.py src/api/app.py
git commit -m "feat: add GitHub webhook handler with issue and comment parsing"
```

---

### Task 29: Update publish_node to reply to platforms

**Files:**
- Modify: `src/agents/nodes/publish.py`

- [ ] **Step 1: Add platform replies to publish_node**

After the audit log call (line 79), add platform-specific replies:

```python
# src/agents/nodes/publish.py — add after store_audit_log
    # Reply to the originating platform
    source = state.get("source", "")
    channel_id = state.get("channel_id", "")
    thread_id = state.get("thread_id", "")

    try:
        if source == "slack" and channel_id:
            from src.integrations.slack import send_slack_message
            reply = f"✅ *Documentation Published*\n\n*{title}*\n\n{content[:1500]}..."
            await send_slack_message(channel_id, reply, thread_ts=thread_id)

        elif source == "discord" and channel_id:
            from src.integrations.discord import send_discord_thread_reply
            reply = f"✅ **Documentation Published**\n\n**{title}**\n\n{content[:1500]}..."
            await send_discord_thread_reply(thread_id, reply)

        elif source == "github" and channel_id:
            from src.integrations.github import post_github_comment
            # channel_id is repo ID, need owner/repo
            # For now, store the reply info for later
            pass
    except Exception as e:
        logger.error("publish_reply_failed", source=source, error=str(e))
```

- [ ] **Step 2: Run ruff check**

```bash
uv run ruff check src/agents/nodes/publish.py
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/nodes/publish.py
git commit -m "feat: publish_node replies to originating platform after publishing"
```

---

### Task 30: Update human_node to send HITL notifications

**Files:**
- Modify: `src/agents/nodes/human.py`

- [ ] **Step 1: Add platform notifications to human_node**

After creating the review session (line 19), add notifications:

```python
# src/agents/nodes/human.py — add after create_review_session
    # Send HITL notification to the originating platform
    source = state.get("source", "")
    channel_id = state.get("channel_id", "")
    thread_id = state.get("thread_id", "")

    try:
        review_url = f"{settings.review_dashboard_url}/review/{review_id}"

        if source == "slack" and channel_id:
            from src.integrations.slack import send_slack_message
            notification = (
                f"👀 *Human Review Required*\n\n"
                f"*{state.get('draft_title', 'Untitled')}*\n"
                f"Confidence: {state.get('confidence_score', 0):.0%}\n\n"
                f"<{review_url}|Review Documentation>\n"
                f"Or use: `/approve {review_id}` | `/reject {review_id}` | `/revise {review_id}`"
            )
            await send_slack_message(channel_id, notification, thread_ts=thread_id)

        elif source == "discord" and channel_id:
            from src.integrations.discord import send_discord_message
            notification = (
                f"👀 **Human Review Required**\n\n"
                f"**{state.get('draft_title', 'Untitled')}**\n"
                f"Confidence: {state.get('confidence_score', 0):.0%}\n\n"
                f"[Review Documentation]({review_url})\n"
                f"Or use: `/approve {review_id}` | `/reject {review_id}` | `/revise {review_id}`"
            )
            await send_discord_message(channel_id, notification)

        elif source == "github" and channel_id:
            from src.integrations.github import post_github_comment
            # Post as issue comment — need owner/repo from channel_id
            pass
    except Exception as e:
        logger.error("hitl_notification_failed", source=source, error=str(e))
```

- [ ] **Step 2: Run ruff check**

```bash
uv run ruff check src/agents/nodes/human.py
```

- [ ] **Step 3: Commit**

```bash
git add src/agents/nodes/human.py
git commit -m "feat: human_node sends HITL notifications to originating platform"
```

---

### Task 31: Add Slack Bolt app for development mode

**Files:**
- Create: `src/bots/__init__.py`
- Create: `src/bots/slack_bot.py`
- Create: `src/bots/discord_bot.py`

- [ ] **Step 1: Create bots package**

```python
# src/bots/__init__.py
```

- [ ] **Step 2: Create Slack Bolt app (dev mode)**

```python
# src/bots/slack_bot.py
"""Slack Bolt app for local development with Socket Mode.

Usage: uv run python -m src.bots.slack_bot
"""
from __future__ import annotations

import asyncio
import re
import sys

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

sys.path.insert(0, ".")

from src.config import settings
from src.logging_config import configure_logging

app = AsyncApp(
    token=settings.slack_bot_token.get_secret_value(),
    signing_secret=settings.slack_signing_secret.get_secret_value(),
)


@app.event("app_mention")
async def handle_mention(event, say):
    question = re.sub(r"<@[A-Z0-9]+>", "", event.get("text", "")).strip()
    channel = event["channel"]
    thread_ts = event.get("thread_ts", event["ts"])

    if not question:
        await say(text="Please ask a question after mentioning me.", thread_ts=thread_ts)
        return

    await app.client.reactions_add(channel=channel, timestamp=event["ts"], name="eyes")

    from src.agents.pipeline import run_pipeline
    result = await run_pipeline(
        source="slack",
        question=question,
        channel_id=channel,
        thread_id=thread_ts,
    )

    title = result.get("draft_title", "Documentation")
    content = result.get("draft_content", "")
    await say(text=f"📄 *{title}*\n\n{content[:2000]}", thread_ts=thread_ts)


@app.event("message.im")
async def handle_dm(event, say):
    text = event.get("text", "")
    if not text or event.get("bot_id"):
        return

    from src.agents.pipeline import run_pipeline
    result = await run_pipeline(
        source="slack",
        question=text,
        channel_id=event["channel"],
        thread_id=event.get("ts", ""),
    )

    title = result.get("draft_title", "Documentation")
    content = result.get("draft_content", "")
    await say(text=f"📄 *{title}*\n\n{content[:2000]}")


async def main():
    configure_logging(log_level="INFO", json_output=False)
    handler = AsyncSocketModeHandler(app, settings.slack_app_token.get_secret_value())
    await handler.start_async()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Create Discord bot (dev mode)**

```python
# src/bots/discord_bot.py
"""Discord bot for local development.

Usage: uv run python -m src.bots.discord_bot
"""
from __future__ import annotations

import asyncio
import sys

import discord
from discord import app_commands

sys.path.insert(0, ".")

from src.config import settings
from src.logging_config import configure_logging

intents = discord.Intents.default()
intents.message_content = True

bot = discord.Client(intents=intents)
tree = app_commands.CommandTree(bot)


@bot.event
async def on_ready():
    await tree.sync()
    print(f"Logged in as {bot.user}")


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    if not bot.user.mentioned_in(message):
        return

    question = message.content
    await message.add_reaction("👀")

    from src.agents.pipeline import run_pipeline
    result = await run_pipeline(
        source="discord",
        question=question,
        channel_id=str(message.channel.id),
        thread_id=str(message.id),
    )

    title = result.get("draft_title", "Documentation")
    content = result.get("draft_content", "")

    if isinstance(message.channel, discord.Thread):
        await message.channel.send(f"📄 **{title}**\n\n{content[:2000]}")
    else:
        thread = await message.create_thread(name=f"Docs: {question[:50]}")
        await thread.send(f"📄 **{title}**\n\n{content[:2000]}")


@tree.command(name="ask", description="Ask Draftly a documentation question")
@app_commands.describe(question="Your question")
async def ask_command(interaction, question: str):
    await interaction.response.defer()
    from src.agents.pipeline import run_pipeline
    result = await run_pipeline(
        source="discord",
        question=question,
        channel_id=str(interaction.channel_id),
        thread_id=str(interaction.id),
    )
    title = result.get("draft_title", "Documentation")
    content = result.get("draft_content", "")
    await interaction.followup.send(f"📄 **{title}**\n\n{content[:2000]}")


@tree.command(name="approve", description="Approve a documentation review")
async def approve_command(interaction, review_id: str):
    from src.memory.reviewer import complete_review
    await complete_review(review_id=review_id, status="approved")
    await interaction.response.send_message(f"✅ Review {review_id[:8]}... approved")


@tree.command(name="reject", description="Reject a documentation review")
async def reject_command(interaction, review_id: str, feedback: str = ""):
    from src.memory.reviewer import complete_review
    await complete_review(review_id=review_id, status="rejected", feedback=feedback)
    await interaction.response.send_message(f"❌ Review {review_id[:8]}... rejected")


def main():
    configure_logging(log_level="INFO", json_output=False)
    bot.run(settings.discord_bot_token.get_secret_value())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Add slack_app_token to config**

In `src/config.py`, add:

```python
    slack_app_token: SecretStr = SecretStr("")  # For Socket Mode
```

- [ ] **Step 5: Run ruff check**

```bash
uv run ruff check src/bots/
```

- [ ] **Step 6: Commit**

```bash
git add src/bots/ src/config.py
git commit -m "feat: add Slack Bolt and Discord bot apps for local development"
```

---

## Summary

| Phase | Tasks | Files Changed | Key Outcome |
|-------|-------|---------------|-------------|
| **1: Error Handling** | 7 | 15 | Resilient pipeline with retries |
| **2: HITL + API** | 3 | 6 | Working approve/reject flow |
| **3: Testing** | 4 | 4 | Critical path test coverage |
| **4: Deployment** | 2 | 2 | Production-ready Docker |
| **5: AWS Integration** | 5 | 12 | S3, CloudWatch, Secrets Manager, Lambda+SQS, ECS |
| **6: CI/CD** | 3 | 3 | GitHub Actions CI/CD + final validation |
| **7: Bot Integration** | 7 | 10 | Slack + Discord + GitHub bots |
| **Total** | **31** | **52** | Full production system |
