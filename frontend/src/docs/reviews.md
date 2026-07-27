# Reviewing Documentation

Draftly's review workflow ensures quality before publication. Every document goes through an AI evaluation pipeline, then awaits human approval. This guide covers the full review process.

## The Review Pipeline

When a support conversation is flagged for documentation:

1. **Research** — Draftly searches your knowledge base and existing docs for context
2. **Drafting** — An AI agent generates the initial document
3. **Evaluation** — A rubric-based grading system scores the document
4. **Iteration** — If the score is below threshold, the document is refined (up to 3 passes)
5. **Review Queue** — The document enters the review queue with a confidence score

## Accessing the Dashboard

The **Dashboard** is your review home. It shows:

- All pending documents awaiting review
- Document title, type, and creation date
- Status badge (pending, in_review, approved, rejected)
- Confidence score bar (green ≥80%, yellow 50-79%, red <50%)

Click **Review** on any card to open the full document.

## The Review Detail Page

The review page shows:

- **Document content** — The full generated markdown
- **Status badge** — Current review status
- **Confidence bar** — AI-evaluated quality score
- **Feedback textarea** — Optional notes for the author
- **Action buttons** — Approve, Request Changes, or Reject

### Approve

Click **Approve** to publish the document:

- Status changes to `approved`
- The document becomes available in the Documentation browser
- If configured, notifications are sent (Slack, email)
- The document is added to the knowledge base for future context

### Request Changes

Click **Request Changes** to send the document back:

- Enter feedback in the textarea explaining what needs improvement
- Status changes to `needs_changes`
- The pipeline re-runs with your feedback as additional context
- A new version is generated for review

### Reject

Click **Reject** to discard the document:

- Status changes to `rejected`
- The document is removed from the review queue
- Use this when the source conversation doesn't warrant documentation

## Confidence Scores

Every document gets a confidence score from 0-100%:

| Score | Meaning | Action |
|-------|---------|--------|
| ≥ 80% | High confidence | Usually ready to approve with minor review |
| 50-79% | Medium confidence | Review carefully, may need changes |
| < 50% | Low confidence | Likely needs revision or rejection |

Confidence is calculated by the rubric grading system, which evaluates:

- **Accuracy** — Does the document correctly describe the topic?
- **Completeness** — Does it cover all relevant aspects?
- **Clarity** — Is it easy to understand?
- **Actionability** — Can someone follow the steps?

## Reviewing from Slack

If you have Slack notifications enabled:

1. Draftly sends an interactive review card when a document is ready
2. Click **Approve**, **Request Changes**, or **Reject** directly in Slack
3. Use the **View** button to see the full document in the dashboard
4. Feedback typed in Slack is passed back to the pipeline

## Reviewing from Email

For email notifications:

1. You receive an email with the document summary and review link
2. Click the link to open the review page (valid for 24 hours via HMAC token)
3. Review and take action on the document
4. No login required for email review links

## Version History

Every document is versioned:

- Each revision creates a new version
- View previous versions in the Documentation browser
- See what changed between versions
- Roll back to a previous version if needed

## Tips for Effective Reviews

1. **Read the full document** — Don't just check the confidence score
2. **Verify against source** — Compare the doc to the original support conversation
3. **Check links** — Ensure any referenced documentation links are valid
4. **Test steps** — If the doc has instructions, try them yourself
5. **Leave feedback** — When requesting changes, be specific about what needs fixing
