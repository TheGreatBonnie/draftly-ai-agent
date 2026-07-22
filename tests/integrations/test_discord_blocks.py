from src.integrations.discord_blocks import (
    _truncate_draft,
    build_discord_result_embed,
    build_discord_review_card,
)


def test_truncate_draft_short():
    assert _truncate_draft("hello", 500) == "hello"


def test_truncate_draft_long():
    long = "word " * 200
    result = _truncate_draft(long, 500)
    assert len(result) <= 510
    assert result.endswith("...")


def test_build_review_card_structure():
    card = build_discord_review_card(
        title="Test Doc",
        source="github",
        confidence=0.85,
        dashboard_url="https://example.com/review/123",
        review_token="tok_abc",
        draft_content="Some draft content",
    )

    assert "embeds" in card
    assert "components" in card
    assert "content" in card
    assert len(card["embeds"]) == 1


def test_build_review_card_embed_fields():
    card = build_discord_review_card(
        title="Test Doc",
        source="slack",
        confidence=0.9,
        dashboard_url="https://example.com/review/123",
        review_token="tok_abc",
        draft_content="Draft text",
    )

    embed = card["embeds"][0]
    assert embed["title"] == "Documentation Review Required"
    assert embed["color"] == 49407
    assert "Test Doc" in embed["description"]
    assert "slack" in embed["description"]
    assert "90%" in embed["description"]
    assert embed["footer"]["text"] == "Review expires in 24 hours"


def test_build_review_card_components():
    card = build_discord_review_card(
        title="Test Doc",
        source="cli",
        confidence=0.7,
        dashboard_url="https://example.com/review/123",
        review_token="tok_xyz",
        draft_content="Content",
    )

    components = card["components"]
    assert len(components) == 2

    buttons = components[0]["components"]
    assert len(buttons) == 3
    assert buttons[0]["label"] == "Approve"
    assert buttons[0]["style"] == 3
    assert buttons[0]["custom_id"] == "discord_approve:tok_xyz"
    assert buttons[1]["label"] == "Reject"
    assert buttons[1]["style"] == 4
    assert buttons[1]["custom_id"] == "discord_reject:tok_xyz"
    assert buttons[2]["label"] == "Revise"
    assert buttons[2]["style"] == 2
    assert buttons[2]["custom_id"] == "discord_revise:tok_xyz"

    select = components[1]["components"]
    assert len(select) == 1
    assert select[0]["type"] == 3
    assert select[0]["custom_id"] == "discord_feedback:tok_xyz"
    assert len(select[0]["options"]) == 5


def test_build_review_card_token_in_custom_id():
    token = "my_special_token_123"
    card = build_discord_review_card(
        title="Doc",
        source="github",
        confidence=0.5,
        dashboard_url="https://example.com",
        review_token=token,
        draft_content="content",
    )

    buttons = card["components"][0]["components"]
    for btn in buttons:
        assert token in btn["custom_id"]

    select = card["components"][1]["components"][0]
    assert token in select["custom_id"]


def test_build_review_card_empty_content():
    card = build_discord_review_card(
        title="Empty Doc",
        source="cli",
        confidence=0.0,
        dashboard_url="https://example.com",
        review_token="tok",
        draft_content="",
    )

    assert len(card["embeds"]) == 1
    assert card["embeds"][0]["fields"][0]["value"] == "No content"


def test_build_result_embed_approved():
    result = build_discord_result_embed("approved", "Test Doc")
    embed = result["embeds"][0]
    assert "Approved" in embed["title"]
    assert embed["color"] == 3066993
    assert result["components"] == []


def test_build_result_embed_rejected():
    result = build_discord_result_embed("rejected", "Test Doc")
    embed = result["embeds"][0]
    assert "Rejected" in embed["title"]
    assert embed["color"] == 15158332


def test_build_result_embed_needs_changes():
    result = build_discord_result_embed("needs_changes", "Test Doc")
    embed = result["embeds"][0]
    assert "Changes Requested" in embed["title"]
    assert embed["color"] == 16776960


def test_build_result_embed_unknown_status():
    result = build_discord_result_embed("unknown", "Test Doc")
    embed = result["embeds"][0]
    assert embed["color"] == 10070709
