# URL Doc Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ability to import company docs from URLs (web pages, PDFs, Google Docs, Notion) into the Knowledge Base with a fetch → preview → ingest workflow.

**Architecture:** New `POST /api/knowledge/fetch-url` backend endpoint extracts content from URLs using `trafilatura` (web) and `PyMuPDF` (PDF). Frontend adds a `URLImportForm` component that fetches, previews, then calls the existing ingest endpoint. Ingested docs go through the same vector embedding pipeline.

**Tech Stack:** Python (FastAPI, httpx, trafilatura, PyMuPDF), TypeScript (React, Tailwind CSS)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `pyproject.toml` | Modify | Add `trafilatura`, `PyMuPDF` dependencies |
| `src/knowledge/__init__.py` | Create | Package init for knowledge module |
| `src/knowledge/url_fetcher.py` | Create | URL content extraction (web, PDF, Google Docs, Notion) |
| `src/api/routes/knowledge.py` | Modify | Add `POST /fetch-url` endpoint, extend `IngestKnowledgeRequest` |
| `tests/test_url_fetcher.py` | Create | Unit tests for URL content extraction |
| `frontend/src/api/types.ts` | Modify | Add `FetchUrlResponse`, extend `IngestKnowledgePayload` |
| `frontend/src/api/knowledge.ts` | Modify | Add `fetchUrlContent()` |
| `frontend/src/components/URLImportForm.tsx` | Create | URL import form with preview |
| `frontend/src/pages/Knowledge.tsx` | Modify | Integrate `URLImportForm` |

---

### Task 1: Add Python dependencies

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add trafilatura and PyMuPDF to dependencies**

In `pyproject.toml`, add after the `httpx` line in the `[project] dependencies` section:

```python
dependencies = [
    # ... existing deps ...
    # HTTP clients
    "httpx>=0.27.0",
    "trafilatura>=1.12",
    "PyMuPDF>=1.24",
    # ... rest of deps ...
]
```

- [ ] **Step 2: Install dependencies**

Run: `uv sync`
Expected: Dependencies install successfully

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "deps: add trafilatura and PyMuPDF for URL content extraction"
```

---

### Task 2: URL content extraction module

**Files:**
- Create: `src/knowledge/__init__.py`
- Create: `src/knowledge/url_fetcher.py`
- Create: `tests/test_url_fetcher.py`

- [ ] **Step 1: Write failing tests for URL fetcher**

Create `tests/test_url_fetcher.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.knowledge.url_fetcher import fetch_url_content, FetchUrlResult


@pytest.mark.asyncio
async def test_detect_webpage():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (
            b"<html><head><title>Test Page</title></head><body><h1>Hello</h1><p>World</p></body></html>",
            "text/html",
        )
        with patch("src.knowledge.url_fetcher._extract_webpage", return_value=("Test Page", "Hello\nWorld")):
            result = await fetch_url_content("https://example.com/page")
            assert result.title == "Test Page"
            assert result.content == "Hello World"
            assert result.source_type == "webpage"
            assert result.url == "https://example.com/page"


@pytest.mark.asyncio
async def test_detect_pdf():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (b"%PDF-1.4 fake pdf bytes", "application/pdf")
        with patch("src.knowledge.url_fetcher._extract_pdf", return_value=("PDF Title", "PDF content here")):
            result = await fetch_url_content("https://example.com/doc.pdf")
            assert result.title == "PDF Title"
            assert result.source_type == "pdf"


@pytest.mark.asyncio
async def test_detect_google_doc():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (b"Google doc exported text content", "text/plain")
        result = await fetch_url_content(
            "https://docs.google.com/document/d/abc123/edit"
        )
        assert result.source_type == "google_doc"
        assert result.content == "Google doc exported text content"


@pytest.mark.asyncio
async def test_detect_notion():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (
            b"<html><head><title>Notion Page</title></head><body><p>Notion content</p></body></html>",
            "text/html",
        )
        with patch("src.knowledge.url_fetcher._extract_webpage", return_value=("Notion Page", "Notion content")):
            result = await fetch_url_content("https://mycompany.notion.so/Page-Title")
            assert result.source_type == "notion"
            assert result.title == "Notion Page"


@pytest.mark.asyncio
async def test_fetch_failure():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.side_effect = Exception("Connection refused")
        with pytest.raises(ValueError, match="Could not fetch URL"):
            await fetch_url_content("https://unreachable.example.com")


@pytest.mark.asyncio
async def test_no_content_extracted():
    with patch("src.knowledge.url_fetcher._fetch_bytes", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = (b"", "text/html")
        with patch("src.knowledge.url_fetcher._extract_webpage", return_value=("", "")):
            with pytest.raises(ValueError, match="No readable content"):
                await fetch_url_content("https://example.com/empty")


def test_invalid_url():
    with pytest.raises(ValueError, match="Invalid URL"):
        # This will be a sync check before async work
        import asyncio
        asyncio.run(fetch_url_content("not-a-url"))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_url_fetcher.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'src.knowledge'`

- [ ] **Step 3: Create package init**

Create `src/knowledge/__init__.py`:

```python
```

- [ ] **Step 4: Implement the URL fetcher**

Create `src/knowledge/url_fetcher.py`:

```python
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
import trafilatura


@dataclass
class FetchUrlResult:
    url: str
    title: str
    content: str
    source_type: str  # "webpage" | "pdf" | "google_doc" | "notion"


def _detect_source_type(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""

    if "docs.google.com" in host and "/document/" in parsed.path:
        return "google_doc"
    if re.search(r"(^|\.)notion\.(so|site)$", host):
        return "notion"
    if parsed.path.lower().endswith(".pdf"):
        return "pdf"
    return "webpage"


def _to_google_doc_export_url(url: str) -> str:
    match = re.search(r"/document/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        raise ValueError("Invalid Google Docs URL")
    doc_id = match.group(1)
    return f"https://docs.google.com/document/d/{doc_id}/export?format=txt"


async def _fetch_bytes(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        return resp.content, content_type


def _extract_webpage(html: bytes) -> tuple[str, str]:
    text = trafilatura.extract(html, include_comments=False, include_tables=True) or ""
    metadata = trafilatura.extract(html, include_comments=False, output_format="json") or "{}"
    import json
    try:
        meta = json.loads(metadata)
        title = meta.get("title", "")
    except (json.JSONDecodeError, AttributeError):
        title = ""
    if not title:
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", html.decode(errors="replace"), re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else ""
    return title, text.strip()


def _extract_pdf(pdf_bytes: bytes) -> tuple[str, str]:
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    title = doc.metadata.get("title", "") if doc.metadata else ""
    pages = [page.get_text() for page in doc]
    doc.close()
    content = "\n".join(pages).strip()
    if not title:
        title = content[:80].split("\n")[0] if content else ""
    return title, content


async def fetch_url_content(url: str) -> FetchUrlResult:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url}")

    source_type = _detect_source_type(url)

    try:
        if source_type == "google_doc":
            export_url = _to_google_doc_export_url(url)
            content_bytes, _ = await _fetch_bytes(export_url)
            content = content_bytes.decode(errors="replace").strip()
            title = content.split("\n")[0][:200] if content else ""
            if not content:
                raise ValueError("No readable content found at URL")
            return FetchUrlResult(url=url, title=title, content=content, source_type=source_type)

        content_bytes, content_type = await _fetch_bytes(url)

        if source_type == "pdf" or "pdf" in content_type:
            title, content = _extract_pdf(content_bytes)
            source_type = "pdf"
        else:
            title, content = _extract_webpage(content_bytes)

        if not content:
            raise ValueError("No readable content found at URL")

        return FetchUrlResult(url=url, title=title, content=content, source_type=source_type)

    except ValueError:
        raise
    except httpx.HTTPStatusError:
        raise ValueError(f"Could not fetch URL: HTTP error")
    except Exception as e:
        raise ValueError(f"Could not fetch URL: {e}")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_url_fetcher.py -v`
Expected: All 7 tests PASS

- [ ] **Step 6: Run linter**

Run: `uv run ruff check src/knowledge/url_fetcher.py tests/test_url_fetcher.py`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/knowledge/__init__.py src/knowledge/url_fetcher.py tests/test_url_fetcher.py
git commit -m "feat: add URL content extraction module with web, PDF, Google Docs, Notion support"
```

---

### Task 3: Backend fetch-url endpoint

**Files:**
- Modify: `src/api/routes/knowledge.py`

- [ ] **Step 1: Add FetchUrlRequest/Response models and endpoint**

In `src/api/routes/knowledge.py`, add the new models and endpoint. Add after the existing imports and before the `router = APIRouter()` line:

```python
from pydantic import HttpUrl

from src.knowledge.url_fetcher import fetch_url_content
```

Add after the existing `IngestKnowledgeRequest` class:

```python
class FetchUrlRequest(BaseModel):
    url: HttpUrl


class FetchUrlResponse(BaseModel):
    url: str
    title: str
    content: str
    source_type: str
```

Add the new endpoint before the existing `@router.post("")` endpoint:

```python
# Simple per-org rate limiter for URL fetches
_fetch_timestamps: dict[str, list[float]] = {}
_FETCH_RATE_LIMIT = 10  # per minute
_FETCH_RATE_WINDOW = 60.0


@router.post("/fetch-url", response_model=FetchUrlResponse)
async def fetch_url(
    request: FetchUrlRequest,
    token: dict = Depends(get_verified_token),
):
    """Fetch and extract content from a URL for knowledge base import."""
    import time

    org_id = token.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    # Rate limiting
    now = time.time()
    org_timestamps = _fetch_timestamps.setdefault(org_id, [])
    org_timestamps[:] = [t for t in org_timestamps if now - t < _FETCH_RATE_WINDOW]
    if len(org_timestamps) >= _FETCH_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    org_timestamps.append(now)

    try:
        result = await fetch_url_content(str(request.url))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return FetchUrlResponse(
        url=result.url,
        title=result.title,
        content=result.content,
        source_type=result.source_type,
    )
```

Extend the existing `IngestKnowledgeRequest` to add optional `source_url`:

```python
class IngestKnowledgeRequest(BaseModel):
    title: str
    content: str
    doc_type: str = "reference"
    source_url: str | None = None
```

Update the `ingest_knowledge` endpoint to pass `source_url` in embedding metadata. Find the `store_embedding` call and update the metadata dict:

```python
    metadata = {"source": "knowledge_upload", "doc_type": request.doc_type}
    if request.source_url:
        metadata["source_url"] = request.source_url

    await store_embedding(
        org_id=org_id,
        content_type="documentation",
        content_id=doc_id,
        content_text=f"{request.title}\n\n{request.content}",
        metadata=metadata,
    )
```

- [ ] **Step 2: Run linter**

Run: `uv run ruff check src/api/routes/knowledge.py`
Expected: No errors

- [ ] **Step 3: Run type checker**

Run: `uv run mypy src/api/routes/knowledge.py`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/knowledge.py
git commit -m "feat: add POST /api/knowledge/fetch-url endpoint with rate limiting"
```

---

### Task 4: Frontend types and API client

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/knowledge.ts`

- [ ] **Step 1: Add FetchUrlResponse type and extend IngestKnowledgePayload**

In `frontend/src/api/types.ts`, add after the `IngestKnowledgePayload` interface:

```typescript
export interface FetchUrlResponse {
  url: string;
  title: string;
  content: string;
  source_type: string;
}
```

Update `IngestKnowledgePayload` to include optional `source_url`:

```typescript
export interface IngestKnowledgePayload {
  title: string;
  content: string;
  doc_type: string;
  source_url?: string;
}
```

- [ ] **Step 2: Add fetchUrlContent API function**

In `frontend/src/api/knowledge.ts`, add the import for `FetchUrlResponse` and the new function:

```typescript
import { request } from "./client";
import type { KnowledgeDoc, IngestKnowledgePayload, FetchUrlResponse } from "./types";
```

Add the new function after the existing `deleteKnowledge` function:

```typescript
export async function fetchUrlContent(url: string): Promise<FetchUrlResponse> {
  return request("/knowledge/fetch-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
```

- [ ] **Step 3: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/knowledge.ts
git commit -m "feat: add fetchUrlContent API client and FetchUrlResponse type"
```

---

### Task 5: URLImportForm component

**Files:**
- Create: `frontend/src/components/URLImportForm.tsx`

- [ ] **Step 1: Create the URLImportForm component**

Create `frontend/src/components/URLImportForm.tsx`:

```tsx
import { useState } from "react";
import { fetchUrlContent, ingestKnowledge } from "../api/knowledge";
import type { IngestKnowledgePayload } from "../api/types";

const DOC_TYPES = ["howto", "faq", "tutorial", "troubleshooting", "reference"] as const;

interface URLImportFormProps {
  onIngested: () => void;
}

type FormState = "idle" | "fetching" | "preview" | "submitting" | "error";

export function URLImportForm({ onIngested }: URLImportFormProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<string>("reference");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [error, setError] = useState("");

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setState("fetching");
    setError("");
    try {
      const result = await fetchUrlContent(url.trim());
      setTitle(result.title);
      setContent(result.content);
      setSourceUrl(result.url);
      setSourceType(result.source_type);
      setState("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch URL";
      setError(message);
      setState("error");
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setState("submitting");
    setError("");
    try {
      const payload: IngestKnowledgePayload = {
        title,
        content,
        doc_type: docType,
        source_url: sourceUrl,
      };
      await ingestKnowledge(payload);
      resetForm();
      onIngested();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add document";
      setError(message);
      setState("preview");
    }
  }

  function resetForm() {
    setUrl("");
    setTitle("");
    setContent("");
    setDocType("reference");
    setSourceUrl("");
    setSourceType("");
    setError("");
    setState("idle");
  }

  function handleCancel() {
    resetForm();
  }

  return (
    <div className="mb-8 rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-lg font-semibold">Import from URL</h2>

      <form onSubmit={handleFetch}>
        <div className="mb-3 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/api-guide"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={state === "fetching" || state === "submitting"}
            required
          />
          <button
            type="submit"
            disabled={state === "fetching" || state === "submitting" || !url.trim()}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {state === "fetching" ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </form>

      {(state === "error") && error && (
        <p className="mb-3 text-sm text-red-600">{error}</p>
      )}

      {state === "preview" && (
        <form onSubmit={handleIngest}>
          <div className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Source: {sourceUrl} ({source_type})
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={state === "submitting" || !title.trim() || !content.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {state === "submitting" ? "Adding..." : "Add to Knowledge Base"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={state === "submitting"}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `cd frontend && npx eslint src/components/URLImportForm.tsx`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/URLImportForm.tsx
git commit -m "feat: add URLImportForm component with fetch-preview-ingest flow"
```

---

### Task 6: Integrate URLImportForm into Knowledge page

**Files:**
- Modify: `frontend/src/pages/Knowledge.tsx`

- [ ] **Step 1: Update Knowledge page to include URLImportForm**

In `frontend/src/pages/Knowledge.tsx`, add the import for `URLImportForm`:

```tsx
import { URLImportForm } from "../components/URLImportForm";
```

After the page description paragraph (line 71) and before the existing `<form>` element, add the URL import form:

```tsx
      <URLImportForm onIngested={loadDocs} />
```

Rename the existing `<h2>Add Document</h2>` to `<h2>Add Manually</h2>` to visually distinguish the two sections.

- [ ] **Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `cd frontend && npx eslint src/pages/Knowledge.tsx`
Expected: No errors

- [ ] **Step 4: Build frontend to verify no errors**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Knowledge.tsx
git commit -m "feat: integrate URLImportForm into Knowledge page"
```

---

### Task 7: Run all checks and verify

**Files:** None (verification only)

- [ ] **Step 1: Run backend tests**

Run: `uv run pytest tests/ -v`
Expected: All tests pass (existing + new url_fetcher tests)

- [ ] **Step 2: Run backend linter**

Run: `uv run ruff check src/`
Expected: No errors

- [ ] **Step 3: Run backend type checker**

Run: `uv run mypy src/knowledge/url_fetcher.py src/api/routes/knowledge.py`
Expected: No errors

- [ ] **Step 4: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Run frontend linter**

Run: `cd frontend && npm run lint`
Expected: No errors

- [ ] **Step 6: Build frontend**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 7: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/type issues from URL import feature"
```
