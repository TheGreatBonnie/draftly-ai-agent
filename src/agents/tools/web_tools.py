from __future__ import annotations

from langchain_core.tools import tool


@tool
async def search_web(query: str, max_results: int = 5) -> str:
    """Search the web for relevant documentation, tutorials, and articles."""
    try:
        from duckduckgo_search import DDGS

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
