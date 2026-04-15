"""
Task 2 strike/ban ladder.

Tests get_punishment(), is_user_banned(), and USER_FACING_MESSAGES.
Imports community_service.main against an in-memory SQLite (env vars
configured in conftest.py).
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

# This import triggers community_service to create tables on the in-memory DB.
from main import (  # noqa: E402  (import-after-env-setup)
    STRIKE_PUNISHMENTS,
    USER_FACING_MESSAGES,
    get_punishment,
    is_user_banned,
)


# ─────────────────── STRIKE_PUNISHMENTS table ───────────────────

def test_strike_punishments_shape():
    assert STRIKE_PUNISHMENTS[1]["punishment"] == "warning"
    assert STRIKE_PUNISHMENTS[1]["ban_duration"] is None
    assert STRIKE_PUNISHMENTS[2]["punishment"] == "ban_1h"
    assert STRIKE_PUNISHMENTS[2]["ban_duration"] == timedelta(hours=1)
    assert STRIKE_PUNISHMENTS[3]["punishment"] == "ban_24h"
    assert STRIKE_PUNISHMENTS[3]["ban_duration"] == timedelta(hours=24)


# ─────────────────── get_punishment() ladder ───────────────────

def test_strike_1_warning():
    p = get_punishment(1)
    assert p["punishment"] == "warning"
    assert p["ban_duration"] is None
    assert p["permanent"] is False


def test_strike_2_one_hour_ban():
    p = get_punishment(2)
    assert p["punishment"] == "ban_1h"
    assert p["ban_duration"] == timedelta(hours=1)
    assert p["permanent"] is False


def test_strike_3_twenty_four_hour_ban():
    p = get_punishment(3)
    assert p["punishment"] == "ban_24h"
    assert p["ban_duration"] == timedelta(hours=24)
    assert p["permanent"] is False


def test_strike_4_permanent_ban():
    p = get_punishment(4)
    assert p["punishment"] == "ban_permanent"
    assert p["ban_duration"] is None
    assert p["permanent"] is True


def test_strike_high_count_remains_permanent():
    """Strike counts beyond 4 (e.g. 5, 99) all map to permanent."""
    for n in (5, 10, 100):
        assert get_punishment(n)["permanent"] is True
        assert get_punishment(n)["punishment"] == "ban_permanent"


# ─────────────────── is_user_banned() ───────────────────

def _user(*, permanent=False, banned_until=None):
    return SimpleNamespace(
        comment_ban_permanent=permanent,
        comment_banned_until=banned_until,
    )


def test_no_ban():
    banned, msg = is_user_banned(_user())
    assert banned is False
    assert msg is None


def test_permanent_ban_message_in_turkish():
    banned, msg = is_user_banned(_user(permanent=True))
    assert banned is True
    assert "kalıcı" in msg.lower()


def test_active_ban_returns_remaining_time_in_hours():
    future = datetime.utcnow() + timedelta(hours=2, minutes=15)
    banned, msg = is_user_banned(_user(banned_until=future))
    assert banned is True
    assert "saat" in msg
    assert "Kalan süre" in msg


def test_active_ban_under_one_hour_returns_minutes():
    future = datetime.utcnow() + timedelta(minutes=30)
    banned, msg = is_user_banned(_user(banned_until=future))
    assert banned is True
    assert "dakika" in msg


def test_expired_ban_does_not_block():
    """If banned_until is in the past, user is not banned anymore."""
    past = datetime.utcnow() - timedelta(hours=1)
    banned, msg = is_user_banned(_user(banned_until=past))
    assert banned is False
    assert msg is None


def test_permanent_takes_precedence_over_temp():
    """Even if temp ban has expired, permanent flag still bans."""
    past = datetime.utcnow() - timedelta(days=10)
    banned, _ = is_user_banned(_user(permanent=True, banned_until=past))
    assert banned is True


# ─────────────────── USER_FACING_MESSAGES ───────────────────

def test_all_punishments_have_user_message():
    """Every ladder slot must have a Turkish user-facing message."""
    expected_keys = {"warning", "ban_1h", "ban_24h", "ban_permanent"}
    assert expected_keys.issubset(USER_FACING_MESSAGES.keys())
    for k in expected_keys:
        msg = USER_FACING_MESSAGES[k]
        assert isinstance(msg, str) and len(msg) > 0


def test_user_messages_do_not_leak_internal_reasons():
    """The user-facing messages must NOT mention specific words like
    'profanity', 'hate', etc. that could help filter evasion."""
    forbidden = ("profanity", "küfür", "hakaret", "hate speech", "spam")
    for msg in USER_FACING_MESSAGES.values():
        lower = msg.lower()
        for word in forbidden:
            assert word not in lower, f"Internal reason leaked in {msg!r}"
