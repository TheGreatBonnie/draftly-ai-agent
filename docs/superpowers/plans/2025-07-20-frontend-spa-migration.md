# Frontend SPA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Jinja2 server-rendered dashboard with a React + Vite + Tailwind SPA, keeping FastAPI as the API backend.

**Architecture:** A `frontend/` directory at the repo root contains a Vite React app. In development, Vite proxies `/api/*` to FastAPI on `:8000`. In production, FastAPI serves the built `frontend/dist/` as static files. The Jinja2 templates are removed after migration.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, react-router 7, fetch-based API client

---

## File Structure

```
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  index.html
  src/
    main.tsx                    # React root mount
    App.tsx                     # Router + layout shell
    api/
      client.ts                 # fetch wrapper (base URL, JSON helpers, error handling)
      types.ts                  # TypeScript interfaces matching API responses
      reviews.ts                # GET /api/reviews/pending, GET /api/reviews/:id, POST /api/reviews/:id/decide
      reviewers.ts              # CRUD for /api/reviewers
      docs.ts                   # GET /api/docs, GET /api/docs/:id
      memory.ts                 # GET /api/memory/stats, GET /api/memory/search
    components/
      Layout.tsx                # Sidebar + main content area
      Sidebar.tsx               # Navigation links
      ReviewCard.tsx            # Card for a single review in the dashboard list
      Badge.tsx                 # Status badge (pending/approved/rejected)
      ConfidenceBar.tsx         # Visual confidence score indicator
    pages/
      Dashboard.tsx             # Pending reviews list (replaces dashboard.html)
      ReviewDetail.tsx          # Single review + approve/reject/revise (replaces review.html)
      Reviewers.tsx             # Reviewer management CRUD
      Docs.tsx                  # Documentation listing
      Memory.tsx                # Stats + semantic search
src/api/
  app.py                        # MODIFY: add StaticFiles mount, remove Jinja2 HTML routes
  templates/                    # DELETE after migration
    base.html
    dashboard.html
    review.html
Dockerfile                      # MODIFY: add multi-stage build (Node + Python)
```

---

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Modify: `.gitignore` — add `frontend/node_modules/`, `frontend/dist/`

- [ ] **Step 1: Initialize the project with npm**

```bash
cd /Applications/Projects/hackathon/draftly
npm create vite@latest frontend -- --template react-ts
```

Expected: Creates `frontend/` with `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`.

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
npm install react-router react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Update `.gitignore`**

Append to `/Applications/Projects/hackathon/draftly/.gitignore`:

```
# Frontend
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Applications/Projects/hackathon/draftly/frontend
npm run dev
```

Expected: Vite starts on `:5173`. Open in browser — shows the default Vite React template. Kill the process after verifying.

- [ ] **Step 5: Commit**

```bash
git add frontend/ .gitignore
git commit -m "feat(frontend): scaffold Vite + React + TypeScript project"
```

---

### Task 2: Configure Tailwind CSS

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css` (or create if missing)
- Modify: `frontend/src/main.tsx` (import CSS)

- [ ] **Step 1: Configure Vite plugin for Tailwind**

Replace contents of `frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: Set up Tailwind CSS import**

Replace contents of `frontend/src/index.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Import CSS in main.tsx**

Ensure `frontend/src/main.tsx` contains:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: Verify Tailwind works**

```bash
cd /Applications/Projects/hackathon/draftly/frontend
npm run dev
```

Replace the default `<h1>Vite + React</h1>` in `App.tsx` with `<h1 className="text-3xl font-bold text-blue-600">Draftly</h1>`. If the text renders in blue, Tailwind is working. Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): configure Tailwind CSS and Vite API proxy"
```

---

### Task 3: API Client Layer — Types and Client

**Files:**
- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create TypeScript types**

Create `frontend/src/api/types.ts`:

```typescript
export interface Review {
  id: string;
  doc_id: string;
  reviewer_id: string;
  status: "pending" | "approved" | "rejected" | "needs_changes";
  reviewer_feedback: string | null;
  edits_made: unknown;
  confidence_before: number | null;
  confidence_after: number | null;
  thread_id: string | null;
  created_at: string;
  completed_at: string | null;
  title: string;
  content: string;
  doc_type: string;
  confidence_score: number;
}

export interface ReviewDecision {
  decision: "approve" | "reject" | "revise";
  feedback: string;
}

export interface Reviewer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  slack_user_id: string | null;
  discord_user_id: string | null;
  notify_slack: boolean;
  notify_discord: boolean;
  notify_email: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewerPayload {
  org_id: string;
  name: string;
  email?: string;
  slack_user_id?: string;
  discord_user_id?: string;
  notify_slack?: boolean;
  notify_discord?: boolean;
  notify_email?: boolean;
}

export interface UpdateReviewerPayload {
  name?: string;
  email?: string;
  slack_user_id?: string;
  discord_user_id?: string;
  notify_slack?: boolean;
  notify_discord?: boolean;
  notify_email?: boolean;
  is_active?: boolean;
}

export interface Doc {
  id: string;
  org_id: string;
  title: string;
  content: string;
  doc_type: string;
  version: number;
  status: string;
  source_thread_id: string | null;
  confidence_score: number;
  published_to: unknown;
  created_at: string;
  updated_at: string;
}

export interface MemoryStats {
  support_threads: number;
  documentation: number;
  embeddings: number;
  review_sessions: number;
  agent_memory: number;
  audit_logs: number;
}

export interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
  score: number;
  metadata: unknown;
}
```

- [ ] **Step 2: Create fetch-based API client**

Create `frontend/src/api/client.ts`:

```typescript
const BASE_URL = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? body.error ?? "Request failed");
  }
  return res.json();
}

export { request, ApiError };
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat(frontend): add API types and fetch-based client"
```

---

### Task 4: API Service Modules

**Files:**
- Create: `frontend/src/api/reviews.ts`
- Create: `frontend/src/api/reviewers.ts`
- Create: `frontend/src/api/docs.ts`
- Create: `frontend/src/api/memory.ts`

- [ ] **Step 1: Create reviews API module**

Create `frontend/src/api/reviews.ts`:

```typescript
import { request } from "./client";
import type { Review, ReviewDecision } from "./types";

export async function getPendingReviews(): Promise<Review[]> {
  return request<Review[]>("/reviews/pending");
}

export async function getReview(reviewId: string): Promise<Review> {
  return request<Review>(`/reviews/${reviewId}`);
}

export async function decideReview(
  reviewId: string,
  decision: ReviewDecision,
): Promise<{ status: string; decision: string }> {
  return request(`/reviews/${reviewId}/decide`, {
    method: "POST",
    body: JSON.stringify(decision),
  });
}
```

- [ ] **Step 2: Create reviewers API module**

Create `frontend/src/api/reviewers.ts`:

```typescript
import { request } from "./client";
import type {
  Reviewer,
  CreateReviewerPayload,
  UpdateReviewerPayload,
} from "./types";

export async function listReviewers(orgId: string): Promise<{ reviewers: Reviewer[] }> {
  return request(`/reviewers?org_id=${orgId}`);
}

export async function getReviewer(id: string): Promise<Reviewer> {
  return request(`/reviewers/${id}`);
}

export async function createReviewer(payload: CreateReviewerPayload): Promise<Reviewer> {
  return request("/reviewers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReviewer(
  id: string,
  payload: UpdateReviewerPayload,
): Promise<Reviewer> {
  return request(`/reviewers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteReviewer(id: string): Promise<{ status: string }> {
  return request(`/reviewers/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 3: Create docs API module**

Create `frontend/src/api/docs.ts`:

```typescript
import { request } from "./client";
import type { Doc } from "./types";

export async function listDocs(): Promise<Doc[]> {
  return request<Doc[]>("/docs/");
}

export async function getDoc(docId: string): Promise<Doc> {
  return request<Doc>(`/docs/${docId}`);
}
```

- [ ] **Step 4: Create memory API module**

Create `frontend/src/api/memory.ts`:

```typescript
import { request } from "./client";
import type { MemoryStats, SearchResult } from "./types";

export async function getMemoryStats(): Promise<MemoryStats> {
  return request<MemoryStats>("/memory/stats");
}

export async function searchMemory(
  query: string,
  type: string = "all",
): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/memory/search?q=${encodeURIComponent(query)}&type=${type}`);
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/
git commit -m "feat(frontend): add API service modules for reviews, reviewers, docs, memory"
```

---

### Task 5: Reusable UI Components

**Files:**
- Create: `frontend/src/components/Badge.tsx`
- Create: `frontend/src/components/ConfidenceBar.tsx`
- Create: `frontend/src/components/ReviewCard.tsx`

- [ ] **Step 1: Create Badge component**

Create `frontend/src/components/Badge.tsx`:

```tsx
const variants: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  needs_changes: "bg-orange-100 text-orange-800",
  draft: "bg-gray-100 text-gray-800",
  in_review: "bg-blue-100 text-blue-800",
  published: "bg-purple-100 text-purple-800",
};

export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
```

- [ ] **Step 2: Create ConfidenceBar component**

Create `frontend/src/components/ConfidenceBar.tsx`:

```tsx
export function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
}
```

- [ ] **Step 3: Create ReviewCard component**

Create `frontend/src/components/ReviewCard.tsx`:

```tsx
import { Link } from "react-router";
import type { Review } from "../api/types";
import { Badge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";

export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{review.title}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {review.doc_type} · {new Date(review.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge status={review.status} />
      </div>
      <div className="mt-3">
        <ConfidenceBar score={review.confidence_score} />
      </div>
      <Link
        to={`/review/${review.id}`}
        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        Review →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): add Badge, ConfidenceBar, and ReviewCard components"
```

---

### Task 6: Layout and Navigation

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Sidebar component**

Create `frontend/src/components/Sidebar.tsx`:

```tsx
import { NavLink } from "react-router";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/reviewers", label: "Reviewers" },
  { to: "/docs", label: "Documentation" },
  { to: "/memory", label: "Memory" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
      <h1 className="mb-6 text-lg font-bold text-gray-900">Draftly</h1>
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create Layout component**

Create `frontend/src/components/Layout.tsx`:

```tsx
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Set up App.tsx with router**

Replace contents of `frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ReviewDetail } from "./pages/ReviewDetail";
import { Reviewers } from "./pages/Reviewers";
import { Docs } from "./pages/Docs";
import { Memory } from "./pages/Memory";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="review/:id" element={<ReviewDetail />} />
          <Route path="reviewers" element={<Reviewers />} />
          <Route path="docs" element={<Docs />} />
          <Route path="memory" element={<Memory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Create placeholder pages so the app compiles**

Create minimal placeholder files so `npm run build` passes. Each just exports a component with an `<h1>`.

Create `frontend/src/pages/Dashboard.tsx`:

```tsx
export function Dashboard() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
```

Create `frontend/src/pages/ReviewDetail.tsx`:

```tsx
export function ReviewDetail() {
  return <h1 className="text-2xl font-bold">Review Detail</h1>;
}
```

Create `frontend/src/pages/Reviewers.tsx`:

```tsx
export function Reviewers() {
  return <h1 className="text-2xl font-bold">Reviewers</h1>;
}
```

Create `frontend/src/pages/Docs.tsx`:

```tsx
export function Docs() {
  return <h1 className="text-2xl font-bold">Documentation</h1>;
}
```

Create `frontend/src/pages/Memory.tsx`:

```tsx
export function Memory() {
  return <h1 className="text-2xl font-bold">Memory</h1>;
}
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Applications/Projects/hackathon/draftly/frontend
npm run build
```

Expected: Build succeeds with no errors. Output in `frontend/dist/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add layout shell with sidebar navigation and routing"
```

---

### Task 7: Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Implement Dashboard page**

Replace contents of `frontend/src/pages/Dashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { getPendingReviews } from "../api/reviews";
import type { Review } from "../api/types";
import { ReviewCard } from "../components/ReviewCard";

export function Dashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPendingReviews()
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading reviews...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Pending Reviews ({reviews.length})</h1>
      {reviews.length === 0 ? (
        <p className="text-gray-500">No pending reviews.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify against running FastAPI**

Start FastAPI: `uv run uvicorn src.api.app:app --reload --port 8000`
Start Vite: `cd frontend && npm run dev`
Open `http://localhost:5173` — should show the pending reviews list (or "No pending reviews." if empty). The Vite proxy forwards `/api/*` to FastAPI.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(frontend): implement Dashboard page with pending reviews list"
```

---

### Task 8: Review Detail Page

**Files:**
- Modify: `frontend/src/pages/ReviewDetail.tsx`

- [ ] **Step 1: Implement ReviewDetail page**

Replace contents of `frontend/src/pages/ReviewDetail.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getReview, decideReview } from "../api/reviews";
import type { Review } from "../api/types";
import { Badge } from "../components/Badge";
import { ConfidenceBar } from "../components/ConfidenceBar";

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDecision(decision: "approve" | "reject" | "revise") {
    if (!id) return;
    setSubmitting(true);
    try {
      await decideReview(id, { decision, feedback });
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading review...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  if (!review) {
    return <p className="text-gray-500">Review not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{review.title}</h1>
        <Badge status={review.status} />
      </div>
      <p className="mb-1 text-sm text-gray-500">
        {review.doc_type} · Confidence:{" "}
        <ConfidenceBar score={review.confidence_score} />
      </p>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Generated Documentation</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-700">{review.content}</pre>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold text-gray-900">Your Review</h2>
        <textarea
          className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={4}
          placeholder="Add feedback (optional)..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleDecision("approve")}
            disabled={submitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => handleDecision("revise")}
            disabled={submitting}
            className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            Request Changes
          </button>
          <button
            onClick={() => handleDecision("reject")}
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/review/{id}` from the dashboard. Verify the review content loads, the feedback textarea works, and clicking Approve/Request Changes/Reject calls the API and redirects to `/`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReviewDetail.tsx
git commit -m "feat(frontend): implement ReviewDetail page with approve/reject/revise actions"
```

---

### Task 9: Reviewers Management Page

**Files:**
- Modify: `frontend/src/pages/Reviewers.tsx`

- [ ] **Step 1: Implement Reviewers page**

Replace contents of `frontend/src/pages/Reviewers.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  listReviewers,
  createReviewer,
  deleteReviewer,
} from "../api/reviewers";
import type { Reviewer, CreateReviewerPayload } from "../api/types";

export function Reviewers() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateReviewerPayload>({
    org_id: "default",
    name: "",
    email: "",
  });

  function load() {
    setLoading(true);
    listReviewers("default")
      .then((res) => setReviewers(res.reviewers))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      await createReviewer(form);
      setForm({ org_id: "default", name: "", email: "" });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReviewer(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading && reviewers.length === 0) {
    return <p className="text-gray-500">Loading reviewers...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Reviewers</h1>

      {error && <p className="mb-3 text-red-600">{error}</p>}

      <div className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Email (optional)"
          value={form.email ?? ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <button
          onClick={handleCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      {reviewers.length === 0 ? (
        <p className="text-gray-500">No reviewers yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reviewers.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                {r.email && (
                  <span className="ml-2 text-sm text-gray-500">{r.email}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {r.notify_slack && <span>Slack</span>}
                {r.notify_discord && <span>Discord</span>}
                {r.notify_email && <span>Email</span>}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/reviewers`. Verify the form creates a reviewer and the list updates. Verify delete works.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Reviewers.tsx
git commit -m "feat(frontend): implement Reviewers management page with create/delete"
```

---

### Task 10: Documentation Listing Page

**Files:**
- Modify: `frontend/src/pages/Docs.tsx`

- [ ] **Step 1: Implement Docs page**

Replace contents of `frontend/src/pages/Docs.tsx`:

```tsx
import { useEffect, useState } from "react";
import { listDocs } from "../api/docs";
import type { Doc } from "../api/types";
import { Badge } from "../components/Badge";
import { ConfidenceBar } from "../components/ConfidenceBar";

export function Docs() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    listDocs()
      .then(setDocs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-gray-500">Loading documentation...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Documentation ({docs.length})</h1>
      {docs.length === 0 ? (
        <p className="text-gray-500">No documentation yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {doc.doc_type} · v{doc.version} ·{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge status={doc.status} />
              </div>
              <div className="mt-2">
                <ConfidenceBar score={doc.confidence_score} />
              </div>
              <button
                onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {expanded === doc.id ? "Collapse" : "Expand"}
              </button>
              {expanded === doc.id && (
                <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-700">
                  {doc.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/docs`. Verify the list loads and expand/collapse toggles the content.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Docs.tsx
git commit -m "feat(frontend): implement Documentation listing page with expand/collapse"
```

---

### Task 11: Memory Search & Stats Page

**Files:**
- Modify: `frontend/src/pages/Memory.tsx`

- [ ] **Step 1: Implement Memory page**

Replace contents of `frontend/src/pages/Memory.tsx`:

```tsx
import { useEffect, useState } from "react";
import { getMemoryStats, searchMemory } from "../api/memory";
import type { MemoryStats, SearchResult } from "../api/types";

const statLabels: Record<keyof MemoryStats, string> = {
  support_threads: "Support Threads",
  documentation: "Documentation",
  embeddings: "Embeddings",
  review_sessions: "Review Sessions",
  agent_memory: "Agent Memory",
  audit_logs: "Audit Logs",
};

export function Memory() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getMemoryStats().then(setStats);
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await searchMemory(query);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Memory</h1>

      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {Object.entries(statLabels).map(([key, label]) => (
            <div
              key={key}
              className="rounded-lg border border-gray-200 p-3 text-center"
            >
              <div className="text-2xl font-bold text-gray-900">
                {stats[key as keyof MemoryStats]}
              </div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Semantic Search</h2>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="Search documentation, threads, reviews..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <div
              key={`${r.content_id}-${i}`}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium">{r.content_type}</span>
                <span>·</span>
                <span>Score: {Math.round(r.score * 100)}%</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{r.content_text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Navigate to `/memory`. Verify stats grid loads and search returns results.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Memory.tsx
git commit -m "feat(frontend): implement Memory page with stats grid and semantic search"
```

---

### Task 12: Production Static File Serving in FastAPI

**Files:**
- Modify: `src/api/app.py`

- [ ] **Step 1: Add StaticFiles mount and SPA fallback**

Replace contents of `src/api/app.py`:

```python
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.routes import docs, github, memory, review, reviewers, reviews, slack
from src.database import close_pool, get_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(title="Draftly Review Dashboard", lifespan=lifespan)

app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(reviewers.router, prefix="/api/reviewers", tags=["reviewers"])
app.include_router(review.router, prefix="/api/review", tags=["review"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
app.include_router(github.router, prefix="/api/github", tags=["github"])
app.include_router(slack.router, prefix="/api/slack", tags=["slack"])

DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
```

Key changes:
- Removed `jinja2` import and `Jinja2Templates` initialization
- Removed the two HTML route functions (`dashboard` and `review_page`)
- Added `StaticFiles` mount for `/assets` (Vite's hashed JS/CSS bundles)
- Added a catch-all route that serves `index.html` for client-side routing (SPA fallback)
- The `DIST_DIR` path resolves to `<repo>/frontend/dist/` from `src/api/app.py`

- [ ] **Step 2: Verify SPA serves in production mode**

Build the frontend: `cd frontend && npm run build`
Start FastAPI without `--reload`: `uv run uvicorn src.api.app:app --port 8000`
Open `http://localhost:8000` — should serve the React SPA.
Navigate to `/reviewers` — should serve `index.html` and React Router handles the route.

- [ ] **Step 3: Commit**

```bash
git add src/api/app.py
git commit -m "feat(api): serve SPA static files from frontend/dist with catch-all fallback"
```

---

### Task 13: Multi-Stage Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update Dockerfile with Node build stage**

Replace contents of `Dockerfile`:

```dockerfile
# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --dev

COPY src/ src/
COPY infrastructure/ infrastructure/
COPY scripts/ scripts/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Verify Docker build**

```bash
docker build -t draftly-frontend-test .
```

Expected: Both stages complete successfully. The final image contains the Python app + built frontend in `frontend/dist/`.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat(docker): add multi-stage build for frontend + backend"
```

---

### Task 14: Remove Old Jinja2 Templates and Cleanup

**Files:**
- Delete: `src/api/templates/base.html`
- Delete: `src/api/templates/dashboard.html`
- Delete: `src/api/templates/review.html`
- Delete: `src/api/templates/emails/` (empty directory)
- Delete: `src/api/templates/` (empty directory)
- Modify: `pyproject.toml` — remove `jinja2` from dependencies

- [ ] **Step 1: Delete template files**

```bash
rm -rf src/api/templates/
```

- [ ] **Step 2: Remove jinja2 from dependencies**

In `pyproject.toml`, remove this line from `dependencies`:

```
    "jinja2>=3.1.0",
```

- [ ] **Step 3: Verify no remaining references to Jinja2**

```bash
grep -r "jinja2\|Jinja2\|templates\.TemplateResponse\|templates/" src/
```

Expected: No matches (the `app.py` import was already removed in Task 12).

- [ ] **Step 4: Run Python linter and type checker**

```bash
uv run ruff check src/
uv run mypy src/
```

Expected: No errors related to the template removal.

- [ ] **Step 5: Commit**

```bash
git add -A src/api/templates/ pyproject.toml
git commit -m "refactor(api): remove Jinja2 templates and jinja2 dependency"
```

---

### Task 15: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Start both servers**

Terminal 1 — FastAPI:
```bash
uv run uvicorn src.api.app:app --reload --port 8000
```

Terminal 2 — Vite dev server:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify all pages**

Open `http://localhost:5173`:
- **Dashboard** (`/`): Shows pending reviews list or "No pending reviews."
- **Review** (`/review/{id}`): Click a review card → shows detail with approve/reject/revise
- **Reviewers** (`/reviewers`): Shows reviewer list, add/delete works
- **Documentation** (`/docs`): Shows docs list with expand/collapse
- **Memory** (`/memory`): Shows stats grid and search works

- [ ] **Step 3: Verify production build**

```bash
cd frontend && npm run build
uv run uvicorn src.api.app:app --port 8000
```

Open `http://localhost:8000` — should serve the SPA. All client-side navigation should work (refresh on any route should still load the page via SPA fallback).

- [ ] **Step 4: Verify lint/typecheck pass**

```bash
uv run ruff check src/
uv run mypy src/
cd frontend && npx tsc --noEmit
```

All should pass with no errors.
