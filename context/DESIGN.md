# Design System

## Overview

Draftly uses a minimal, functional design focused on readability and efficiency. The review dashboard is built with FastAPI + Jinja2 templates.

## Pages

### 1. Dashboard (`/`)
- Table view of pending reviews
- Sortable by date, confidence score, status
- Quick actions: Approve, Reject, View

### 2. Review Page (`/review/{review_id}`)
- Full document preview
- Confidence score badge
- Source thread context
- Action buttons: Approve, Reject, Revise
- Edit history

### 3. API Endpoints (`/api/*`)
- `/api/reviews` - List pending reviews
- `/api/reviews/{id}` - Get review details
- `/api/docs` - List documentation
- `/api/memory` - Query agent memory

## Components

### ReviewCard
```html
<div class="review-card">
  <div class="header">
    <h3>{{ review.title }}</h3>
    <span class="confidence-badge" data-score="{{ review.confidence_score }}">
      {{ review.confidence_score }}%
    </span>
  </div>
  <div class="content">
    {{ review.content | truncate(200) }}
  </div>
  <div class="actions">
    <button class="approve">Approve</button>
    <button class="reject">Reject</button>
    <button class="revise">Revise</button>
  </div>
</div>
```

### ConfidenceBadge
- Green (>= 0.8): High confidence
- Yellow (0.5-0.8): Medium confidence
- Red (< 0.5): Low confidence

### ActionButtons
- **Approve**: Mark as approved, trigger publish
- **Reject**: Mark as rejected, archive
- **Revise**: Open editor, return to write_docs node

## Styling

### Colors
```css
:root {
  --primary: #2563eb;
  --success: #16a34a;
  --warning: #d97706;
  --error: #dc2626;
  --background: #f8fafc;
  --text: #1e293b;
}
```

### Typography
- Headings: System font stack
- Body: System font stack, 16px base
- Code: Monospace font

### Layout
- Max width: 1200px
- Responsive grid
- Mobile-first approach

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast ratios >= 4.5:1
- Screen reader compatible

## Templates

| Template | Purpose |
|----------|---------|
| `base.html` | Base layout with nav |
| `dashboard.html` | Review list |
| `review.html` | Single review view |
