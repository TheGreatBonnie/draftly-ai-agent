from src.integrations.slack_blocks import build_review_notification_card


def test_build_review_notification_card_returns_valid_structure():
    card = build_review_notification_card(
        title="Fix authentication flow",
        source="GitHub Issue #142",
        confidence=0.85,
        dashboard_url="https://app.example.com/review/abc123",
        review_token="test_token_123",
        draft_content="# Fix Auth\n\nThis covers the auth flow changes for mobile.",
    )

    assert "blocks" in card
    assert "text" in card
    assert len(card["blocks"]) > 0
    assert card["text"].startswith("Documentation Review Required:")


def test_build_review_notification_card_includes_header():
    card = build_review_notification_card(
        title="Test Title",
        source="Slack",
        confidence=0.9,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="Some draft content here.",
    )

    header = card["blocks"][0]
    assert header["type"] == "header"
    assert "Documentation Review Required" in header["text"]["text"]


def test_build_review_notification_card_includes_metadata():
    card = build_review_notification_card(
        title="My Document",
        source="Jira",
        confidence=0.75,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="Some draft content.",
    )

    section = card["blocks"][1]
    assert section["type"] == "section"
    assert len(section["fields"]) == 3
    assert "My Document" in section["fields"][0]["text"]
    assert "Jira" in section["fields"][1]["text"]
    assert "75%" in section["fields"][2]["text"]


def test_build_review_notification_card_includes_draft_preview():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="# Hello\n\nThis is the full draft content that should be truncated.",
    )

    draft_section = card["blocks"][2]
    assert draft_section["type"] == "section"
    assert "Draft Preview:" in draft_section["text"]["text"]
    assert "```markdown" in draft_section["text"]["text"]
    assert "Hello" in draft_section["text"]["text"]


def test_build_review_notification_card_truncates_long_draft():
    long_draft = "word " * 200  # 1000 chars
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content=long_draft,
    )

    draft_section = card["blocks"][2]
    text = draft_section["text"]["text"]
    # Should be truncated (under 600 chars in the code block)
    assert len(text) < 700
    assert text.endswith("```")


def test_build_review_notification_card_empty_draft():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="",
    )

    draft_section = card["blocks"][2]
    assert draft_section["type"] == "section"
    assert "Draft Preview:" in draft_section["text"]["text"]


def test_build_review_notification_card_includes_action_buttons():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="abc123",
        draft_content="content",
    )

    actions = [b for b in card["blocks"] if b["type"] == "actions"]
    assert len(actions) >= 2

    approve_btn = actions[1]["elements"][0]
    assert approve_btn["action_id"] == "approve_review"
    assert approve_btn["value"] == "abc123"
    assert approve_btn["style"] == "primary"

    reject_btn = actions[1]["elements"][1]
    assert reject_btn["action_id"] == "reject_review"
    assert reject_btn["style"] == "danger"


def test_build_review_notification_card_includes_feedback_dropdown():
    card = build_review_notification_card(
        title="Test",
        source="Test",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token="token",
        draft_content="content",
    )

    section = card["blocks"][-1]
    assert section["type"] == "section"
    assert section["accessory"]["type"] == "static_select"
    assert section["accessory"]["action_id"] == "feedback_select"
    assert len(section["accessory"]["options"]) == 5
