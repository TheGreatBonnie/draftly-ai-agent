# NVIDIA Models Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the NVIDIA models already defined in `.env` (`NVIDIA_API_KEY`, `GLM_5.2_MODEL`, `DEEPSEEK_V4_PRO_MODEL`, `DEEPSEEK_V4_FLASH_MODEL`, `MINIMAX_M3_MODEL`, `KIMI_K2.6_MODEL`) into Draftly via a per-stage provider switch, so each graph stage (research/review/rubric/analysis) can route to NVIDIA's `ChatNVIDIA` instead of Requesty.

**Architecture:** Add NVIDIA settings to `src/config.py` (using `validation_alias` to read the dotted `.env` var names). Extend the single LLM choke point `src/integrations/llm.py` to dispatch between the existing Requesty `ChatOpenAI` and a new cached `ChatNVIDIA`, selected by a `provider` parameter. Each stage resolves its model+provider through one helper, so call sites stay one-liners. Keep `call_llm()` returning content-only `str` (reasoning is logged, not returned) so existing JSON parsers and `AsyncMock`-based tests stay green.

**Tech Stack:** Python 3.11, LangChain (`ChatOpenAI`, `ChatNVIDIA` 1.4.3), langchain-nvidia-ai-endpoints (already a dependency), pydantic-settings, structlog, pytest (asyncio_mode=auto).

---

## File Structure

### New files
- `tests/integrations/test_llm.py` — unit tests for NVIDIA dispatch, reasoning logging, stage resolver, streaming

### Modified files
- `src/config.py` — NVIDIA API key, named model refs (aliased to dotted env vars), per-stage provider + per-stage NVIDIA model
- `src/integrations/llm.py` — `_get_requesty_llm`, `get_nvidia_llm`, `get_llm(provider=...)`, `call_llm(provider=...)`, `stream_llm`, `stage_llm_kwargs`
- `src/agents/nodes/research.py` — use `stage_llm_kwargs("research")`
- `src/agents/nodes/review.py` — use `stage_llm_kwargs("review")`
- `src/agents/middleware/rubric.py` — use `stage_llm_kwargs("rubric_grader")`
- `src/analytics/analyzer.py` — use `stage_llm_kwargs("analysis")`
- `src/analytics/improver.py` — use `stage_llm_kwargs("analysis")`
- `pyproject.toml` — add `langchain_nvidia_ai_endpoints.*` to mypy `ignore_missing_imports`
- `.env.example` — document the NVIDIA + per-stage provider section

### Unchanged (intentionally)
- `src/agents/nodes/synthesize.py` and `write.py` keep using `call_bedrock` (Requesty default). Switching these to NVIDIA is out of scope.

---

### Task 1: Add NVIDIA settings to `src/config.py`

**Files:**
- Modify: `src/config.py:7-15` (Requesty/NVIDIA block)
- Test: `tests/integrations/test_llm.py` (created in this task)

- [ ] **Step 1: Write the failing test**

Create `tests/integrations/test_llm.py`:

```python
from src.config import Settings


def test_nvidia_model_aliases_read_dotted_env_vars(monkeypatch):
    monkeypatch.setenv("GLM_5.2_MODEL", "z-ai/glm-5.2")
    monkeypatch.setenv("DEEPSEEK_V4_PRO_MODEL", "deepseek-ai/deepseek-v4-pro")
    settings = Settings(_env_file=None)
    assert settings.nvidia_glm_model == "z-ai/glm-5.2"
    assert settings.nvidia_deepseek_v4_pro == "deepseek-ai/deepseek-v4-pro"
    assert settings.research_provider == "requesty"
    assert settings.research_nvidia_model == "deepseek-ai/deepseek-v4-flash"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/integrations/test_llm.py::test_nvidia_model_aliases_read_dotted_env_vars -v`
Expected: FAIL with `AttributeError: 'Settings' object has no attribute 'nvidia_glm_model'`

- [ ] **Step 3: Add the settings fields**

In `src/config.py`, after the `llm_model` / `embedding_model` lines (line 15), insert:

```python
    # NVIDIA (per-stage provider switch; models aliased to dotted .env names)
    nvidia_api_key: SecretStr = SecretStr("")
    nvidia_glm_model: str = Field(
        default="z-ai/glm-5.2", validation_alias=AliasChoices("GLM_5.2_MODEL", "nvidia_glm_model")
    )
    nvidia_deepseek_v4_pro: str = Field(
        default="deepseek-ai/deepseek-v4-pro",
        validation_alias=AliasChoices("DEEPSEEK_V4_PRO_MODEL", "nvidia_deepseek_v4_pro"),
    )
    nvidia_deepseek_v4_flash: str = Field(
        default="deepseek-ai/deepseek-v4-flash",
        validation_alias=AliasChoices("DEEPSEEK_V4_FLASH_MODEL", "nvidia_deepseek_v4_flash"),
    )
    nvidia_minimax_m3: str = Field(
        default="minimax-ai/minimax-m3",
        validation_alias=AliasChoices("MINIMAX_M3_MODEL", "nvidia_minimax_m3"),
    )
    nvidia_kimi_k2_6: str = Field(
        default="moonshotai/kimi-k2.6",
        validation_alias=AliasChoices("KIMI_K2.6_MODEL", "nvidia_kimi_k2_6"),
    )
```

Then in the "Per-stage LLM models" block (after `rubric_max_iterations`, line 57), insert:

```python
    # Per-stage provider routing (requesty | nvidia) + NVIDIA model per stage
    research_provider: Literal["requesty", "nvidia"] = "requesty"
    review_provider: Literal["requesty", "nvidia"] = "requesty"
    rubric_grader_provider: Literal["requesty", "nvidia"] = "requesty"
    analysis_provider: Literal["requesty", "nvidia"] = "requesty"
    research_nvidia_model: str = "deepseek-ai/deepseek-v4-flash"
    review_nvidia_model: str = "deepseek-ai/deepseek-v4-pro"
    rubric_grader_nvidia_model: str = "deepseek-ai/deepseek-v4-flash"
    analysis_nvidia_model: str = "deepseek-ai/deepseek-v4-pro"
```

Update the imports at the top of `src/config.py`:

```python
from pydantic import AliasChoices, Field, SecretStr
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/integrations/test_llm.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config.py tests/integrations/test_llm.py
git commit -m "feat(config): add NVIDIA settings and per-stage provider routing"
```

---

### Task 2: Add NVIDIA dispatch to `src/integrations/llm.py`

**Files:**
- Modify: `src/integrations/llm.py`
- Test: `tests/integrations/test_llm.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/integrations/test_llm.py`:

```python
import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_openai import ChatOpenAI

from src.integrations.llm import call_llm, get_llm, stage_llm_kwargs, stream_llm


def test_get_llm_requesty_returns_chat_openai(monkeypatch):
    monkeypatch.setattr("src.integrations.llm.settings", _fake_settings())
    assert isinstance(get_llm("tensorx/deepseek-v4-flash", provider="requesty"), ChatOpenAI)


def test_get_llm_nvidia_returns_chat_nvidia(monkeypatch):
    monkeypatch.setattr("src.integrations.llm.settings", _fake_settings())
    assert isinstance(
        get_llm("deepseek-ai/deepseek-v4-pro", provider="nvidia"), ChatNVIDIA
    )


@pytest.mark.asyncio
async def test_call_llm_returns_content_only(monkeypatch):
    fake_llm = _FakeLLM(
        AIMessage(
            content="the answer",
            additional_kwargs={"reasoning_content": "step 1 thinking"},
        )
    )
    monkeypatch.setattr("src.integrations.llm.get_llm", lambda *a, **kw: fake_llm)
    result = await call_llm("question", provider="nvidia")
    assert result == "the answer"
    assert fake_llm.received_messages[0].content == "question"
    assert isinstance(fake_llm.received_messages[0], HumanMessage)


@pytest.mark.asyncio
async def test_call_llm_passes_system_prompt(monkeypatch):
    fake_llm = _FakeLLM(AIMessage(content="{}"))
    monkeypatch.setattr("src.integrations.llm.get_llm", lambda *a, **kw: fake_llm)
    await call_llm("q", system_prompt="sys", provider="requesty")
    assert isinstance(fake_llm.received_messages[0], SystemMessage)
    assert fake_llm.received_messages[0].content == "sys"


def test_stage_llm_kwargs_requesty(monkeypatch):
    monkeypatch.setattr("src.integrations.llm.settings", _fake_settings())
    assert stage_llm_kwargs("research") == {
        "model": "tensorx/deepseek-v4-flash",
        "provider": "requesty",
    }


def test_stage_llm_kwargs_nvidia(monkeypatch):
    settings = _fake_settings()
    settings.research_provider = "nvidia"
    monkeypatch.setattr("src.integrations.llm.settings", settings)
    assert stage_llm_kwargs("research") == {
        "model": "deepseek-ai/deepseek-v4-flash",
        "provider": "nvidia",
    }


@pytest.mark.asyncio
async def test_stream_llm_yields_reasoning_and_content(monkeypatch):
    class _StreamFake:
        async def astream(self, messages):
            yield AIMessage(content="", additional_kwargs={"reasoning_content": "think"})
            yield AIMessage(content="out")

    monkeypatch.setattr("src.integrations.llm.get_llm", lambda *a, **kw: _StreamFake())
    chunks = [pair async for pair in stream_llm("q", provider="nvidia")]
    assert ("think", "") in chunks
    assert (None, "out") in chunks


class _FakeLLM:
    def __init__(self, response):
        self._response = response
        self.received_messages = []

    async def ainvoke(self, messages):
        self.received_messages = messages
        return self._response


def _fake_settings():
    from types import SimpleNamespace

    return SimpleNamespace(
        llm_model="tensorx/deepseek-v4-flash",
        requesty_api_key="k",
        requesty_base_url="https://router.requesty.ai/v1",
        nvidia_api_key=type("S", (), {"get_secret_value": lambda self: "nvapi-test"})(),
        research_model="tensorx/deepseek-v4-flash",
        research_provider="requesty",
        research_nvidia_model="deepseek-ai/deepseek-v4-flash",
        review_nvidia_model="deepseek-ai/deepseek-v4-pro",
        rubric_grader_nvidia_model="deepseek-ai/deepseek-v4-flash",
        analysis_nvidia_model="deepseek-ai/deepseek-v4-pro",
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/integrations/test_llm.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_nvidia_llm'` (or `stage_llm_kwargs` missing, `get_llm` missing `provider` kwarg).

- [ ] **Step 3: Rewrite `src/integrations/llm.py`**

Replace the entire file content with:

```python
from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import structlog
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_openai import ChatOpenAI

from src.config import settings

logger = structlog.get_logger()

_llm_cache: dict[str, ChatOpenAI] = {}
_nvidia_cache: dict[str, ChatNVIDIA] = {}


def _get_requesty_llm(
    model: str | None = None, temperature: float = 0.3, max_tokens: int = 4096
) -> ChatOpenAI:
    """Get a ChatOpenAI instance routed through Requesty."""
    model = model or settings.llm_model
    cache_key = f"{model}:{temperature}:{max_tokens}"
    if cache_key not in _llm_cache:
        _llm_cache[cache_key] = ChatOpenAI(  # type: ignore[call-arg]
            openai_api_key=settings.requesty_api_key,
            openai_api_base=settings.requesty_base_url,
            model_name=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    return _llm_cache[cache_key]


def get_nvidia_llm(
    model: str | None = None, temperature: float = 0.3, max_tokens: int = 4096
) -> ChatNVIDIA:
    """Get a cached ChatNVIDIA instance. Enables reasoning via chat_template_kwargs."""
    model = model or settings.llm_model
    cache_key = f"nvidia:{model}:{temperature}:{max_tokens}"
    if cache_key not in _nvidia_cache:
        _nvidia_cache[cache_key] = ChatNVIDIA(  # type: ignore[call-arg]
            nvidia_api_key=settings.nvidia_api_key.get_secret_value() or None,
            model=model,
            temperature=temperature,
            max_completion_tokens=max_tokens,
            extra_body={
                "chat_template_kwargs": {"thinking": True, "reasoning_effort": "max"}
            },
        )
    return _nvidia_cache[cache_key]


def get_llm(
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    provider: str = "requesty",
) -> BaseChatModel:
    """Get a chat model instance for the given provider (requesty | nvidia)."""
    if provider == "nvidia":
        return get_nvidia_llm(model, temperature=temperature, max_tokens=max_tokens)
    return _get_requesty_llm(model, temperature=temperature, max_tokens=max_tokens)


def _extract_reasoning(message: BaseMessage) -> Any:
    if not isinstance(message, AIMessage):
        return None
    return message.additional_kwargs.get("reasoning") or message.additional_kwargs.get(
        "reasoning_content"
    )


async def call_llm(
    prompt: str,
    system_prompt: str = "",
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
    provider: str = "requesty",
) -> str:
    """Call an LLM via the given provider (requesty | nvidia) with the given model."""
    llm = get_llm(model, temperature=temperature, max_tokens=max_tokens, provider=provider)

    messages: list[BaseMessage] = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    logger.info("llm_call", model=model or settings.llm_model, provider=provider, prompt_length=len(prompt))

    response = await llm.ainvoke(messages)

    reasoning = _extract_reasoning(response)
    if reasoning:
        logger.info("llm_reasoning", reasoning_length=len(str(reasoning)))

    text = response.content if isinstance(response.content, str) else str(response.content)
    logger.info("llm_response", response_length=len(text))
    return text


async def stream_llm(
    prompt: str,
    system_prompt: str = "",
    model: str | None = None,
    provider: str = "requesty",
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> AsyncIterator[tuple[str | None, str]]:
    """Stream (reasoning, content) chunks from the given provider's model."""
    llm = get_llm(model, temperature=temperature, max_tokens=max_tokens, provider=provider)

    messages: list[BaseMessage] = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))

    async for chunk in llm.astream(messages):
        reasoning = None
        if isinstance(chunk, AIMessageChunk):
            reasoning = chunk.additional_kwargs.get("reasoning") or chunk.additional_kwargs.get(
                "reasoning_content"
            )
        content = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
        yield reasoning, content


def stage_llm_kwargs(stage: str) -> dict[str, str]:
    """Resolve the model + provider for a graph stage."""
    providers = {
        "research": (settings.research_provider, settings.research_model, settings.research_nvidia_model),
        "review": (settings.review_provider, settings.review_model, settings.review_nvidia_model),
        "rubric_grader": (
            settings.rubric_grader_provider,
            settings.rubric_grader_model,
            settings.rubric_grader_nvidia_model,
        ),
        "analysis": (settings.analysis_provider, settings.analysis_model, settings.analysis_nvidia_model),
    }
    if stage not in providers:
        raise ValueError(f"unknown stage: {stage}")
    provider, requesty_model, nvidia_model = providers[stage]
    if provider == "nvidia":
        return {"model": nvidia_model, "provider": "nvidia"}
    return {"model": requesty_model, "provider": "requesty"}


async def call_bedrock(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Backward-compatible wrapper — calls default model via Requesty."""
    return await call_llm(
        prompt,
        system_prompt=system_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/integrations/test_llm.py -v`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Update mypy overrides in `pyproject.toml`**

In `pyproject.toml:69`, extend the override module list to include `langchain_nvidia_ai_endpoints.*`:

```toml
[[tool.mypy.overrides]]
module = ["slack_bolt.*", "slack_sdk.*", "discord.*", "mcp.*", "asyncpg.*", "fitz.*", "langchain_cockroachdb.*", "langchain_nvidia_ai_endpoints.*", "websockets.*"]
ignore_missing_imports = true
```

- [ ] **Step 6: Commit**

```bash
git add src/integrations/llm.py tests/integrations/test_llm.py pyproject.toml
git commit -m "feat(llm): add NVIDIA provider dispatch, reasoning logging, and stage resolver"
```

---

### Task 3: Route graph stages through the provider switch

**Files:**
- Modify: `src/agents/nodes/research.py:107`
- Modify: `src/agents/nodes/review.py:80`
- Modify: `src/agents/middleware/rubric.py:54`
- Modify: `src/analytics/analyzer.py:118`
- Modify: `src/analytics/improver.py:77`

- [ ] **Step 1: Update research node**

In `src/agents/nodes/research.py`, change the import on line 16:

```python
    from src.integrations.llm import call_llm, stage_llm_kwargs
```

Replace the `call_llm(...)` call at lines 100-108 (the `model=settings.research_model,` line) so the last argument is:

```python
        **stage_llm_kwargs("research"),
    )
```

- [ ] **Step 2: Update review node**

In `src/agents/nodes/review.py`, change the import on line 10:

```python
from src.integrations.llm import call_llm, stage_llm_kwargs
```

Replace `model=settings.review_model,` (line 80) with:

```python
        **stage_llm_kwargs("review"),
```

- [ ] **Step 3: Update rubric grader**

In `src/agents/middleware/rubric.py`, change the import on line 10:

```python
from src.integrations.llm import call_llm, stage_llm_kwargs
```

Replace `model=settings.rubric_grader_model,` (line 54) with:

```python
            **stage_llm_kwargs("rubric_grader"),
```

- [ ] **Step 4: Update analyzer**

In `src/analytics/analyzer.py`, change the import on line 11:

```python
from src.integrations.llm import call_llm, stage_llm_kwargs
```

Replace `model=settings.analysis_model,` (line 118) with:

```python
            **stage_llm_kwargs("analysis"),
```

- [ ] **Step 5: Update improver**

In `src/analytics/improver.py`, change the import on line 14:

```python
from src.integrations.llm import call_llm, stage_llm_kwargs
```

Replace `model=settings.analysis_model,` (line 77) with:

```python
            **stage_llm_kwargs("analysis"),
```

- [ ] **Step 6: Run the full test suite**

Run: `uv run pytest`
Expected: PASS. Existing tests patch the module-level `call_llm` name (e.g. `src.analytics.analyzer.call_llm`), so they are unaffected by the new keyword args.

- [ ] **Step 7: Run lint and type check**

Run: `uv run ruff check src/`
Expected: no errors

Run: `uv run mypy src/`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/agents/nodes/research.py src/agents/nodes/review.py src/agents/middleware/rubric.py src/analytics/analyzer.py src/analytics/improver.py
git commit -m "feat(agents): route research/review/rubric/analysis stages through provider switch"
```

---

### Task 4: Document the NVIDIA config in `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the NVIDIA section**

In `.env.example`, after the Requesty block (line 6), insert:

```bash
# NVIDIA (per-stage provider switch: set <STAGE>_PROVIDER=nvidia to use these)
NVIDIA_API_KEY=your-nvidia-api-key
GLM_5.2_MODEL=z-ai/glm-5.2
DEEPSEEK_V4_PRO_MODEL=deepseek-ai/deepseek-v4-pro
DEEPSEEK_V4_FLASH_MODEL=deepseek-ai/deepseek-v4-flash
MINIMAX_M3_MODEL=minimax-ai/minimax-m3
KIMI_K2.6_MODEL=moonshotai/kimi-k2.6
```

Then, in the "Per-stage LLM models" section (replace the comment at line 46), add:

```bash
# Per-stage LLM models + provider routing (requesty | nvidia)
RESEARCH_PROVIDER=requesty
REVIEW_PROVIDER=requesty
RUBRIC_GRADER_PROVIDER=requesty
ANALYSIS_PROVIDER=requesty
RESEARCH_NVIDIA_MODEL=deepseek-ai/deepseek-v4-flash
REVIEW_NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
RUBRIC_GRADER_NVIDIA_MODEL=deepseek-ai/deepseek-v4-flash
ANALYSIS_NVIDIA_MODEL=deepseek-ai/deepseek-v4-pro
```

The working `.env` already defines `NVIDIA_API_KEY` and the five dotted model vars, so no change is needed there unless a stage should default to NVIDIA.

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document NVIDIA models and per-stage provider routing"
```

---

## Self-Review

**1. Spec coverage:**
- Per-stage provider switch → Tasks 1-3 (config providers + `stage_llm_kwargs` + call sites). ✓
- NVIDIA models in `.env` read → Task 1 (`validation_alias` for dotted names). ✓
- Reasoning extraction + streaming example → Task 2 (`_extract_reasoning`, `stream_llm`). ✓
- Documentation → Task 4. ✓
- Tests → Tasks 1-2. ✓

**2. Placeholder scan:** Every step contains full code, exact paths, exact commands. ✓

**3. Type consistency:**
- `stage_llm_kwargs(stage: str) -> dict[str, str]` is defined in Task 2 and used identically in Task 3 (research/review/rubric_grader/analysis). ✓
- `get_llm(..., provider="requesty")` signature consistent between Task 2 tests and implementation. ✓
- `call_llm(..., provider="requesty")` keeps `str` return; `_FakeLLM` in tests matches `ainvoke(messages)` usage. ✓
- Settings field names (`research_nvidia_model`, etc.) consistent between config (Task 1), fake settings in tests (Task 2), and resolver (Task 2). ✓
