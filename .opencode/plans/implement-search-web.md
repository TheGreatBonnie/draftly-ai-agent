# Plan: Implement search_web Tool with DuckDuckGo

## Context

The research subagent instructions mention "Search web for relevant documentation and tutorials" but no `search_web` tool exists. The user wants a free solution using DuckDuckGo (no API key required).

## Implementation

### Step 1: Add duckduckgo-search dependency

**File:** `pyproject.toml`

```toml
dependencies = [
    # ... existing ...
    "duckduckgo-search>=7.0.0",
]
```

### Step 2: Create web search tool

**File:** `src/agents/tools/web_tools.py` (new file)

```python
from __future__ import annotations

from langchain_core.tools import tool
from duckduckgo_search import DDGS


@tool
async def search_web(query: str, max_results: int = 5) -> str:
    """Search the web for relevant documentation, tutorials, and articles."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        
        if not results:
            return "No web results found."
        
        formatted = []
        for r in results:
            title = r.get("title", "No title")
            url = r.get("href", "")
            body = r.get("body", "")[:300]
            formatted.append(f"[{title}]({url})\n{body}")
        
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Web search failed: {e}"


WEB_TOOLS = [search_web]
```

### Step 3: Add tool to research subagent

**File:** `src/agents/subagents/__init__.py`

Update imports and subagent definition:

```python
from src.agents.tools.github_tools import get_github_issue, search_github_issues
from src.agents.tools.slack_tools import search_slack_messages
from src.agents.tools.web_tools import search_web

# ...

research_analyst_subagent = {
    "name": "research-analyst",
    "description": "Research a specific documentation topic and return findings with citations",
    "system_prompt": RESEARCH_ANALYST_INSTRUCTIONS,
    "tools": [search_github_issues, get_github_issue, search_slack_messages, search_web],
}
```

### Step 4: Update tools __init__.py

**File:** `src/agents/tools/__init__.py`

```python
"""Agent tools for memory, GitHub, Slack, and web search."""
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `pyproject.toml` | Add `duckduckgo-search>=7.0.0` |
| `src/agents/tools/web_tools.py` | Create new file with `search_web` tool |
| `src/agents/subagents/__init__.py` | Import and add `search_web` to subagent |
| `src/agents/tools/__init__.py` | Update docstring |

## Verification

1. Run `ruff check src/agents/tools/web_tools.py`
2. Verify import: `python -c "from src.agents.tools.web_tools import search_web"`
3. Install dependency: `pip install duckduckgo-search>=7.0.0`
