# ReviewDetail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ReviewDetail page to be production-ready with loading/error states, markdown content, before/after confidence comparison, and an expandable review form.

**Architecture:** Keep `ReviewDetail.tsx` as the container. Extract 4 sub-components: `ReviewHeader`, `ConfidenceComparison`, `ReviewContent`, `ReviewForm`. Each has a single responsibility. Use `react-markdown` with `remark-gfm` for content rendering.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, react-router v8, react-markdown, remark-gfm

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/ReviewHeader.tsx` | Create | Back nav, status badge, title, requester, time |
| `src/components/ConfidenceComparison.tsx` | Create | Before → After with delta indicator |
| `src/components/ReviewContent.tsx` | Create | Markdown rendered content card |
| `src/components/ReviewForm.tsx` | Create | Expandable review panel with actions |
| `src/pages/ReviewDetail.tsx` | Modify | Use new components, add loading/error states |

---

### Task 1: Create ReviewHeader Component

**Files:**
- Create: `frontend/src/components/ReviewHeader.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { useNavigate } from "react-router";
import { Badge } from "./Badge";
import { relativeTime } from "../utils/format";
import type { Review } from "../api/types";

interface ReviewHeaderProps {
  review: Review;
}

export function ReviewHeader({ review }: ReviewHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <button
        onClick={() => navigate("/reviews")}
        className="mb-4 text-sm font-medium text-terracotta hover:text-terracotta/80"
      >
        ← Back to Reviews
      </button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-warm-900">{review.title}</h1>
        <Badge status={review.status} />
      </div>

      <p className="mt-2 text-sm text-warm-500">
        {review.doc_type} · Requested {relativeTime(review.created_at)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReviewHeader.tsx
git commit -m "feat: add ReviewHeader component"
```

---

### Task 2: Create ConfidenceComparison Component

**Files:**
- Create: `frontend/src/components/ConfidenceComparison.tsx`

- [ ] **Step 1: Create the component file**

```tsx
interface ConfidenceComparisonProps {
  before: number | null;
  after: number | null;
}

export function ConfidenceComparison({ before, after }: ConfidenceComparisonProps) {
  if (before === null || after === null) {
    return null;
  }

  const beforePct = Math.round(before * 100);
  const afterPct = Math.round(after * 100);
  const delta = afterPct - beforePct;
  const isPositive = delta > 0;

  return (
    <div className="mb-6 rounded-lg bg-warm-100 p-4">
      <p className="mb-3 text-xs font-medium text-warm-500">Confidence Score</p>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-[10px] uppercase text-warm-500">Before</p>
          <p className="text-3xl font-bold text-warm-900">{beforePct}%</p>
        </div>
        <span className="text-xl text-warm-400">→</span>
        <div className="text-center">
          <p className="text-[10px] uppercase text-warm-500">After</p>
          <p className="text-3xl font-bold text-sage-600">{afterPct}%</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            isPositive
              ? "bg-sage-100 text-sage-600"
              : "bg-red-100 text-red-600"
          }`}
        >
          {isPositive ? "+" : ""}
          {delta}%
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConfidenceComparison.tsx
git commit -m "feat: add ConfidenceComparison component"
```

---

### Task 3: Create ReviewContent Component

**Files:**
- Create: `frontend/src/components/ReviewContent.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReviewContentProps {
  content: string;
}

export function ReviewContent({ content }: ReviewContentProps) {
  return (
    <div className="mb-6 rounded-lg border border-warm-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-warm-900">Documentation</h2>
      <div className="prose prose-warm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReviewContent.tsx
git commit -m "feat: add ReviewContent component with markdown rendering"
```

---

### Task 4: Create ReviewForm Component

**Files:**
- Create: `frontend/src/components/ReviewForm.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { useState } from "react";

interface ReviewFormProps {
  onSubmit: (decision: "approve" | "reject" | "revise", feedback: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ReviewForm({ onSubmit, isSubmitting }: ReviewFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(decision: "approve" | "reject" | "revise") {
    await onSubmit(decision, feedback);
    setFeedback("");
    setIsExpanded(false);
  }

  if (!isExpanded) {
    return (
      <div className="rounded-lg border border-dashed border-warm-300 p-6 text-center">
        <p className="mb-3 text-sm text-warm-500">Ready to review?</p>
        <button
          onClick={() => setIsExpanded(true)}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
        >
          Open Review Panel
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warm-200 bg-white p-4">
      <textarea
        className="mb-3 w-full rounded-lg border border-warm-200 p-3 text-sm focus:border-terracotta focus:ring-1 focus:ring-terracotta"
        rows={4}
        placeholder="Add your review notes (optional)..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleSubmit("approve")}
          disabled={isSubmitting}
          className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white hover:bg-sage-700 disabled:opacity-50"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => handleSubmit("revise")}
          disabled={isSubmitting}
          className="rounded-lg bg-sand-400 px-4 py-2 text-sm font-medium text-warm-900 hover:bg-sand-500 disabled:opacity-50"
        >
          ✎ Request Changes
        </button>
        <button
          onClick={() => handleSubmit("reject")}
          disabled={isSubmitting}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ReviewForm.tsx
git commit -m "feat: add ReviewForm component with expandable panel"
```

---

### Task 5: Rewrite ReviewDetail Page

**Files:**
- Modify: `frontend/src/pages/ReviewDetail.tsx`

- [ ] **Step 1: Replace entire file content**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { getReview, decideReview } from "../api/reviews";
import type { Review } from "../api/types";
import { ReviewHeader } from "../components/ReviewHeader";
import { ConfidenceComparison } from "../components/ConfidenceComparison";
import { ReviewContent } from "../components/ReviewContent";
import { ReviewForm } from "../components/ReviewForm";

export function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleRetry() {
    if (!id) return;
    setLoading(true);
    setError(null);
    getReview(id)
      .then(setReview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleDecision(decision: "approve" | "reject" | "revise", feedback: string) {
    if (!id) return;
    setSubmitting(true);
    try {
      await decideReview(id, { decision, feedback });
      navigate("/reviews");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mb-4 h-4 w-32 rounded bg-warm-200" />
        <div className="mb-2 h-7 w-2/3 rounded bg-warm-200" />
        <div className="mb-6 h-4 w-48 rounded bg-warm-200" />
        <div className="mb-6 h-32 rounded-lg bg-warm-200" />
        <div className="h-64 rounded-lg bg-warm-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-2 text-sm font-medium text-red-600">Failed to load review</p>
        <p className="mb-4 text-sm text-warm-500">
          Please check your connection and try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleRetry}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90"
          >
            Retry
          </button>
          <button
            onClick={() => navigate("/reviews")}
            className="rounded-lg bg-warm-100 px-4 py-2 text-sm font-medium text-warm-900 hover:bg-warm-200"
          >
            ← Back to Reviews
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-warm-200 bg-white p-6 text-center">
        <p className="text-sm text-warm-500">Review not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ReviewHeader review={review} />
      <ConfidenceComparison
        before={review.confidence_before}
        after={review.confidence_after}
      />
      <ReviewContent content={review.content} />
      <ReviewForm onSubmit={handleDecision} isSubmitting={submitting} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReviewDetail.tsx
git commit -m "feat: rewrite ReviewDetail with new components and states"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd frontend && npm run lint`
Expected: No new errors

- [ ] **Step 4: Visual verification**

1. Start dev server: `cd frontend && npm run dev`
2. Navigate to a review detail page
3. Verify loading skeleton appears
4. Verify content renders as markdown
5. Verify confidence comparison shows (if data has before/after)
6. Verify expandable review form works
7. Verify back navigation works

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address review feedback"
```

---

## Self-Review Checklist

- [ ] All spec acceptance criteria covered
- [ ] No placeholders or TODOs in plan
- [ ] All types consistent across tasks
- [ ] All file paths correct
- [ ] All code blocks complete and correct
