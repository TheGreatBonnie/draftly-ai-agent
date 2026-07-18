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
