# Design: Import Company Docs from URL

**Date:** 2026-07-22
**Status:** Approved
**Approach:** Dedicated Fetch Endpoint + Preview → Ingest

## Overview

Add the ability to import company documentation from external URLs (web pages, PDFs, Google Docs, Notion pages) into the Knowledge Base. Users paste a URL, the system fetches and extracts the content, shows a preview, and then ingests it into the existing knowledge pipeline with vector embeddings for semantic search.

## Requirements

- Support web pages, PDFs, Google Docs sharing links, and Notion public pages
- Single URL import with preview before saving
- Manual doc type selection after preview (howto, faq, tutorial, troubleshooting, reference)
- One-time fetch — no auto-refresh or scheduled re-fetching
- Ingested docs use the same vector embedding pipeline as manually uploaded docs
- Source URL stored as metadata for traceability

## Architecture

```
User pastes URL → Frontend calls POST /api/knowledge/fetch-url
                         ↓
              Backend fetches & extracts content
                         ↓
              Returns { title, content, source_url }
                         ↓
              Frontend shows preview panel
                         ↓
              User edits title, selects doc_type
                         ↓
              Frontend calls POST /api/knowledge (existing ingest)
                         ↓
              Stored in documentation table + vector embedding
```

## Backend Changes

### New endpoint: `POST /api/knowledge/fetch-url`

**File:** `src/api/routes/knowledge.py` (add to existing router)

**Request model:**
```python
class FetchUrlRequest(BaseModel):
    url: HttpUrl
```

**Response model:**
```python
class FetchUrlResponse(BaseModel):
    url: str
    title: str
    content: str
    source_type: str  # "webpage" | "pdf" | "google_doc" | "notion"
```

**Content extraction by source type:**

| Source | Detection | Extraction |
|--------|-----------|------------|
| **Web pages** | Default | `httpx` fetch → `trafilatura.extract()` for main content |
| **PDFs** | URL ends in `.pdf` or Content-Type is `application/pdf` | `httpx` fetch → `PyMuPDF (fitz)` text extraction |
| **Google Docs** | URL matches `docs.google.com/document/d/...` | Rewrite to export URL (`/export?format=txt`) → plain text fetch |
| **Notion** | URL matches `notion.so` or `notion.site` | Fetch page → `trafilatura.extract()` (Notion public pages render as HTML) |

**Error handling:**
- URL unreachable → 422 `"Could not fetch URL"`
- No extractable content → 422 `"No readable content found at URL"`
- Invalid URL format → 422 validation error
- Per-org rate limit: 10 fetches/minute (in-memory dict with TTL)

**Source URL metadata:** Stored in the embedding metadata as `{"source_url": "<url>"}` alongside existing `source: "knowledge_upload"`.

### New dependencies

Add to `pyproject.toml`:
- `trafilatura>=1.12` — web page content extraction
- `PyMuPDF>=1.24` — PDF text extraction (imported as `fitz`)

### Extraction helper module

**New file:** `src/knowledge/url_fetcher.py`

```python
async def fetch_url_content(url: str) -> FetchUrlResponse:
    """Fetch a URL and extract its text content."""
    # 1. Detect source type from URL pattern
    # 2. Fetch content via httpx (timeout=30s, follow_redirects=True)
    # 3. Extract text based on source type
    # 4. Return extracted title + content
```

### Updated existing ingest endpoint

**File:** `src/api/routes/knowledge.py`

No changes to `POST /api/knowledge`. The frontend calls fetch-url first, then calls the existing ingest with the extracted content. The source URL is passed as metadata in the request body.

Extend `IngestKnowledgeRequest` to accept optional metadata:
```python
class IngestKnowledgeRequest(BaseModel):
    title: str
    content: str
    doc_type: str = "reference"
    source_url: str | None = None  # NEW: optional source URL
```

If `source_url` is provided, store it in embedding metadata:
```python
metadata = {"source": "knowledge_upload", "doc_type": request.doc_type}
if request.source_url:
    metadata["source_url"] = request.source_url
```

## Frontend Changes

### New component: `URLImportForm`

**File:** `frontend/src/components/URLImportForm.tsx`

A self-contained component that handles the URL fetch + preview flow:

**States:**
1. **Idle** — URL input + "Fetch" button
2. **Fetching** — Loading spinner, URL input disabled
3. **Preview** — Editable title, editable content textarea, doc_type dropdown, source URL label, "Add to Knowledge Base" button
4. **Error** — Inline error message below URL input
5. **Submitting** — "Add to Knowledge Base" button disabled with loading text

**Props:**
```typescript
interface URLImportFormProps {
  onIngested: () => void;  // callback to refresh doc list
}
```

### Updated Knowledge page

**File:** `frontend/src/pages/Knowledge.tsx`

Refactor the existing page to use two sub-components:

```
Knowledge.tsx
├── URLImportForm (new) — "Import from URL" section
└── <section> — "Add Manually" section (existing form, extracted into inline component or kept inline)
```

The manual form stays exactly as-is, just visually separated under a heading.

### API client addition

**File:** `frontend/src/api/knowledge.ts`

```typescript
interface FetchUrlResponse {
  url: string;
  title: string;
  content: string;
  source_type: string;
}

export async function fetchUrlContent(url: string): Promise<FetchUrlResponse> {
  return request("/knowledge/fetch-url", {
    method: "POST",
    body: { url },
  });
}
```

Extend `IngestKnowledgePayload` to include optional `source_url`:
```typescript
interface IngestKnowledgePayload {
  title: string;
  content: string;
  doc_type: string;
  source_url?: string;
}
```

### UI layout

The Knowledge page layout becomes:

```
┌─────────────────────────────────────────────┐
│ Knowledge Base                              │
│ Add company documentation so the AI uses    │
│ it as context when generating solutions.    │
│                                             │
│ ┌─ Import from URL ──────────────────────┐  │
│ │ [URL input________________] [Fetch]    │  │
│ │                                        │  │
│ │ ┌─ Preview ─────────────────────────┐  │  │
│ │ │ Source: https://docs.example.com  │  │  │
│ │ │ Title: [API Auth Guide___]        │  │  │
│ │ │ Type:  [reference ▼]              │  │  │
│ │ │ Content:                          │  │  │
│ │ │ ┌──────────────────────────────┐  │  │  │
│ │ │ │ ## Overview                  │  │  │  │
│ │ │ │ This guide covers...         │  │  │  │
│ │ │ │                              │  │  │  │
│ │ │ └──────────────────────────────┘  │  │  │
│ │ │ [Add to Knowledge Base]           │  │  │
│ │ └───────────────────────────────────┘  │  │
│ └────────────────────────────────────────┘  │
│                                             │
│ ── Add Manually ──────────────────────────  │
│ ┌─────────────────────────────────────────┐ │
│ │ Title: [________________]               │ │
│ │ Type:  [reference ▼]                    │ │
│ │ Content:                                │ │
│ │ ┌──────────────────────────────────┐    │ │
│ │ │                                  │    │ │
│ │ └──────────────────────────────────┘    │ │
│ │ [Add to Knowledge Base]                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Company Documents (5)                       │
│ ...                                         │
└─────────────────────────────────────────────┘
```

## Error Handling

| Scenario | Backend | Frontend |
|----------|---------|----------|
| Invalid URL | 422 + validation error | Show inline error below URL input |
| URL unreachable | 422 "Could not fetch URL" | Show inline error |
| No content extracted | 422 "No readable content" | Show inline error |
| Rate limited | 429 "Rate limit exceeded" | Show inline error with retry hint |
| Ingest failure | 500 (existing) | Show error in preview panel |
| Auth failure | 401 (existing) | Redirect to sign-in (existing behavior) |

## Files Changed

### Backend (Python)
- `pyproject.toml` — add `trafilatura`, `PyMuPDF` dependencies
- `src/knowledge/url_fetcher.py` — **new** content extraction module
- `src/api/routes/knowledge.py` — add `POST /fetch-url` endpoint, extend `IngestKnowledgeRequest`

### Frontend (TypeScript)
- `frontend/src/api/knowledge.ts` — add `fetchUrlContent()`, extend `IngestKnowledgePayload`
- `frontend/src/components/URLImportForm.tsx` — **new** URL import component
- `frontend/src/pages/Knowledge.tsx` — integrate `URLImportForm`, separate manual form visually

## Testing

### Backend
- Unit tests for `url_fetcher.py`: mock httpx responses for each source type
- Integration test for `POST /api/knowledge/fetch-url` with mocked fetches
- Test rate limiting behavior
- Test error cases (unreachable URL, no content, invalid format)

### Frontend
- Component test for `URLImportForm`: render, input URL, mock fetch response, verify preview populates
- Test error state rendering
- Test that "Add to Knowledge Base" calls the correct API with extracted content

## Out of Scope

- Batch URL import (multiple URLs at once)
- Auto-refresh / scheduled re-fetching of imported docs
- Authentication-gated content (requires user-provided tokens/cookies)
- JavaScript-heavy SPA content (e.g., pages requiring client-side rendering)
- Notion/Google Docs private documents (only public/sharing links)
