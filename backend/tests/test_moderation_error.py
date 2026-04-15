"""
Task 1 + Task 2 Layer 3: ContentModerationError contract.

The exception MUST carry both a user-safe message AND an internal reason.
This split is what lets us return a generic message to the user while
logging detailed cause server-side (prevents filter evasion).
"""
import sys
import types

_genai_stub = types.ModuleType("google.generativeai")
_genai_stub.configure = lambda **kw: None
_genai_stub.GenerativeModel = lambda **kw: None
_genai_stub.GenerationConfig = lambda **kw: None
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules["google.generativeai"] = _genai_stub

import pytest
from gemini_analyzer import ContentModerationError


def test_two_arg_constructor():
    err = ContentModerationError(
        user_message="Image rejected.",
        internal_reason="Detected weapon (knife)",
    )
    assert err.user_message == "Image rejected."
    assert err.internal_reason == "Detected weapon (knife)"


def test_user_message_is_str_repr():
    """str(err) returns the user-safe message, NOT the internal reason."""
    err = ContentModerationError(
        user_message="Generic rejection.",
        internal_reason="weapon: assault rifle barrel visible",
    )
    assert str(err) == "Generic rejection."
    assert "weapon" not in str(err)  # internal reason MUST NOT leak


def test_is_an_exception():
    err = ContentModerationError("u", "i")
    assert isinstance(err, Exception)


def test_can_be_raised_and_caught():
    with pytest.raises(ContentModerationError) as exc_info:
        raise ContentModerationError("user", "internal")
    assert exc_info.value.user_message == "user"
    assert exc_info.value.internal_reason == "internal"


def test_keyword_args_required():
    """Constructor accepts both positional and keyword args."""
    err = ContentModerationError("u", "i")  # positional
    assert err.user_message == "u"
    assert err.internal_reason == "i"
