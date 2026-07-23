# Implementation Plan: Slack Rich Text Reply for Published Documentation

**Date:** 2026-07-24
**Status:** Ready to execute

## Overview

Replace plain markdown replies in Slack with Block Kit rich text blocks. 3 implementation units.

---

## Unit 1: Markdown-to-Slack Rich Text Parser

**Goal:** Convert LLM-generated markdown into Slack `rich_text` block elements.

**Files:**
- Create `src/integrations/markdown_to_slack.py`

**Implementation:**

1. Create `src/integrations/markdown_to_slack.py` with a single public function:

   ```python
   def markdown_to_rich_text_blocks(markdown: str) -> list[dict]:
       """Convert markdown string to Slack rich_text block elements."""
   ```

2. **Block-level parsing** (process line by line):

   - Fenced code blocks (`` ```lang `` ... `` ``` ``):
     - Track `in_code_block` state
     - Collect lines between fences
     - Emit `rich_text_preformatted` with `language` if lang specified
     - Each line is a separate `{ "type": "text", "text": line }` element

   - Headings (`# H1` through `#### H4`):
     - Strip `#` prefix, emit `rich_text_section` with bold text

   - Unordered list (`- item` / `* item`):
     - Consecutive lines → single `rich_text_list` with `style: "bullet"`
     - Track list items, emit list when non-list line encountered

   - Ordered list (`1. item`):
     - Consecutive lines → single `rich_text_list` with `style: "ordered"`

   - Blockquote (`> text`):
     - Consecutive lines → single `rich_text_quote`

   - Horizontal rule (`---` / `***` / `___`):
     - Emit `rich_text_section` with `\n` separator

   - Empty line:
     - Flush current paragraph, start new section

   - Other text:
     - Accumulate into current `rich_text_section`

3. **Inline parsing** (within each text fragment):

   - `**text**` or `__text__` → `{ "type": "text", "text": "...", "style": { "bold": true } }`
   - `*text*` or `_text_` → `{ "type": "text", "text": "...", "style": { "italic": true } }`
   - `` `text` `` → `{ "type": "text", "text": "...", "style": { "code": true } }`
   - `~~text~~` → `{ "type": "text", "text": "...", "style": { "strike": true } }`
   - `[text](url)` → `{ "type": "link", "text": "text", "url": "url" }`
   - Plain text → `{ "type": "text", "text": "..." }`

   Use a state machine or sequential regex matching to handle overlapping patterns correctly.

4. Return a list of rich_text sub-elements (sections, lists, preformatted, quotes) to be placed inside a `rich_text` block.

**Tests:**
- Create `tests/integrations/test_markdown_to_slack.py`
- Test headings → bold text sections
- Test fenced code blocks → `rich_text_preformatted`
- Test bullet lists → `rich_text_list` bullet
- Test ordered lists → `rich_text_list` ordered
- Test blockquotes → `rich_text_quote`
- Test inline bold, italic, code, strikethrough, links
- Test mixed content (headings + paragraphs + code + lists)
- Test empty input → empty list
- Test horizontal rules
- Test nested inline styles in list items

**Verify:** `uv run pytest tests/integrations/test_markdown_to_slack.py -v`

---

## Unit 2: Update Published Doc Card Builder

**Goal:** Use the markdown parser to render full content as a `rich_text` block in the published doc card.

**Files:**
- Edit `src/integrations/slack_blocks.py`

**Implementation:**

1. Import `markdown_to_rich_text_blocks` from `src.integrations.markdown_to_slack`

2. Update `build_published_doc_card()`:
   - Convert `content` markdown to rich text elements using the parser
   - Build a `rich_text` block from the elements:
     ```python
     {
         "type": "rich_text",
         "elements": rich_text_elements,
     }
     ```
   - Add this block to the blocks array after the metadata section (before divider + context footer)

3. Keep `text` parameter as plain text fallback for notifications/accessibility — use a simple summary (title + type + confidence), not the full content

**Tests:**
- Update `tests/integrations/test_slack_blocks.py`
- Test that `build_published_doc_card()` includes a `rich_text` block
- Test that `text` field is a summary, not full content
- Test with markdown content containing headings, code blocks, lists

**Verify:** `uv run pytest tests/integrations/test_slack_blocks.py -v`

---

## Unit 3: Update Publish Node

**Goal:** Wire up the updated card builder in the publish flow.

**Files:**
- Edit `src/agents/nodes/publish.py`

**Implementation:**

1. Update `_reply_to_slack()` to pass content through the updated card builder (already partially done — just verify `build_published_doc_card` is called with correct args)

2. No structural changes needed beyond what's already in place — the card builder now returns rich text blocks

**Tests:**
- Existing tests should continue to pass
- Verify `_reply_to_slack()` sends blocks with `rich_text` type

**Verify:** `uv run pytest tests/ -v`

---

## Execution Order

```
Unit 1 (markdown_to_slack.py)    ← no dependencies
Unit 2 (slack_blocks.py)         ← depends on Unit 1
Unit 3 (publish.py)              ← depends on Unit 2
```

## Verification Checklist

After all units are complete:

```bash
# Lint
uv run ruff check src/

# Type check
uv run mypy src/

# Tests
uv run pytest tests/ -v
```
