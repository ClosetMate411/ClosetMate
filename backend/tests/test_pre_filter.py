"""
Task 2 Layer 1: pre_filter_text() regex profanity check.

These tests verify the Gemini-independent regex layer that runs BEFORE
any AI call. Critical because it's the only line of defense if Gemini
is down or rate-limited.
"""
import sys
import types

# Stub out google.generativeai so importing gemini_analyzer doesn't require
# the real SDK or a valid API key during unit tests.
_genai_stub = types.ModuleType("google.generativeai")
_genai_stub.configure = lambda **kw: None
_genai_stub.GenerativeModel = lambda **kw: None
_genai_stub.GenerationConfig = lambda **kw: None
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules["google.generativeai"] = _genai_stub

import pytest
from gemini_analyzer import pre_filter_text, MAX_COMMENT_LENGTH


# ─────────────────── Clean text passes ───────────────────

@pytest.mark.parametrize("text", [
    "Bu kombin harika olmuş!",
    "Great outfit, I love the colors.",
    "Çok güzel, tebrikler.",
    "Where did you get the jacket?",
    "Bayıldım 😍 nereden aldın?",
    "",
    "   ",
])
def test_clean_text_passes(text):
    result = pre_filter_text(text)
    assert result["blocked"] is False
    assert result["reason"] is None


# ─────────────────── Length cap ───────────────────

def test_exactly_max_length_passes():
    text = "a" * MAX_COMMENT_LENGTH
    assert pre_filter_text(text)["blocked"] is False


def test_one_over_max_length_blocks():
    text = "a" * (MAX_COMMENT_LENGTH + 1)
    result = pre_filter_text(text)
    assert result["blocked"] is True
    assert "character limit" in result["reason"]


# ─────────────────── Turkish profanity ───────────────────

@pytest.mark.parametrize("text", [
    "siktir lan",
    "amına koyim",
    "orospu çocuğu",
    "piç",
    "yarrak",
    "ananı",       # regex requires [ıi] suffix
    "ibne",
    "kahpe",
])
def test_turkish_profanity_blocked(text):
    result = pre_filter_text(text)
    assert result["blocked"] is True, f"Expected to block: {text!r}"
    assert "TR" in result["reason"]


# ─────────────────── English profanity ───────────────────

@pytest.mark.parametrize("text", [
    "fuck this",
    "what a piece of shit",
    "bitch please",
    "you cunt",
    "asshole",
])
def test_english_profanity_blocked(text):
    result = pre_filter_text(text)
    assert result["blocked"] is True, f"Expected to block: {text!r}"
    assert "EN" in result["reason"]


# ─────────────────── Letter-stretch evasion (f+u+c+k+) ───────────────────

@pytest.mark.parametrize("text", [
    "fuuuck",
    "shiiiit",
    "biiitch",
    "fuuuuuuck this",
])
def test_letter_stretch_blocked(text):
    assert pre_filter_text(text)["blocked"] is True, f"Letter-stretch should block: {text!r}"


# ─────────────────── Leet-speak normalization ───────────────────

@pytest.mark.parametrize("text", [
    "sh1t",     # 1 -> i  → "shit"
    "f4ggot",   # 4 -> a  → "faggot"
    "b1tch",    # 1 -> i  → "bitch"
    "@n@nı",    # @ -> a  → "ananı" (TR)
])
def test_leet_speak_blocked(text):
    """Leet substitutions in LEET_MAP must defeat the regex.
    Only payloads where post-leet form ACTUALLY matches a regex pattern."""
    assert pre_filter_text(text)["blocked"] is True, f"Leet should block: {text!r}"


# ─────────────────── Separator-collapse evasion ───────────────────

@pytest.mark.parametrize("text", [
    "f.u.c.k",
    "s h i t",
    "f-u-c-k",
    "f*u*c*k",
    "f_u_c_k",
])
def test_separator_collapse_blocked(text):
    assert pre_filter_text(text)["blocked"] is True, f"Separator-evasion should block: {text!r}"


# ─────────────────── Case insensitivity ───────────────────

@pytest.mark.parametrize("text", [
    "FUCK",
    "Fuck",
    "fUcK",
    "SİKTİR",
    "Orospu",
])
def test_case_insensitive_blocking(text):
    assert pre_filter_text(text)["blocked"] is True, f"Should block regardless of case: {text!r}"


# ─────────────────── Reason format ───────────────────

def test_reason_contains_match_excerpt():
    """The reason field should embed a short excerpt of the offending match."""
    result = pre_filter_text("siktir git buradan")
    assert result["blocked"] is True
    assert ":" in result["reason"]  # "Pre-filter match (TR): <excerpt>"
    # excerpt is capped to 20 chars
    excerpt = result["reason"].split(":", 1)[-1].strip()
    assert len(excerpt) <= 20
