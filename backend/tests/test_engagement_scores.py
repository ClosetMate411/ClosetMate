"""
Task 4: emoji weights + calculate_post_scores() formula.

  star_score   = avg_rating × min(rating_count, 10)        max 50.0
  emoji_bonus  = min(Σ count×weight, 5.0) × 0.5            max 2.5
  sort_score   = star_score + emoji_bonus                  max 52.5
"""
import uuid

import pytest

from main import (  # noqa: E402
    EMOJI_WEIGHTS,
    VALID_EMOJI_TYPES,
    Rating,
    Reaction,
    SessionLocal,
    calculate_post_scores,
    get_user_reactions,
)


# ─────────────────── EMOJI_WEIGHTS sanity ───────────────────

def test_emoji_weights_match_spec():
    assert EMOJI_WEIGHTS == {
        "heart": 0.3,
        "fire": 0.3,
        "clap": 0.2,
        "love_eyes": 0.2,
        "idea": 0.1,
    }


def test_valid_emoji_types_matches_weights():
    assert VALID_EMOJI_TYPES == set(EMOJI_WEIGHTS.keys())


def test_emoji_bonus_max_when_all_max():
    """sum(weights) = 1.1 × 5 emojis × big counts capped at 5.0 → bonus 2.5."""
    raw = sum(EMOJI_WEIGHTS.values())
    assert round(raw, 2) == 1.1


# ─────────────────── DB fixtures ───────────────────

@pytest.fixture
def db_session():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.close()


@pytest.fixture
def post_id(db_session):
    """A fresh shared_outfit_id with no ratings/reactions yet."""
    pid = "post-" + str(uuid.uuid4())
    yield pid
    # Cleanup: wipe any rows we left behind.
    db_session.query(Rating).filter(Rating.shared_outfit_id == pid).delete()
    db_session.query(Reaction).filter(Reaction.shared_outfit_id == pid).delete()
    db_session.commit()


def _add_rating(db, post_id, user_id, score):
    db.add(Rating(
        id=str(uuid.uuid4()),
        shared_outfit_id=post_id,
        user_id=user_id,
        score=score,
    ))


def _add_reaction(db, post_id, user_id, emoji_type):
    db.add(Reaction(
        id=str(uuid.uuid4()),
        shared_outfit_id=post_id,
        user_id=user_id,
        emoji_type=emoji_type,
    ))


# ─────────────────── No engagement ───────────────────

def test_empty_post_has_zero_scores(db_session, post_id):
    s = calculate_post_scores(db_session, post_id)
    assert s["avg_rating"] == 0
    assert s["rating_count"] == 0
    assert s["star_score"] == 0
    assert s["emoji_bonus"] == 0
    assert s["sort_score"] == 0
    assert s["total_reactions"] == 0
    assert s["emoji_counts"] == {}


# ─────────────────── Star score formula ───────────────────

def test_star_score_avg_times_count(db_session, post_id):
    """avg=4.5, count=8 → star = 4.5 × 8 = 36.0"""
    for i in range(8):
        # 4×5 + 4×4 = 36, avg=4.5
        _add_rating(db_session, post_id, f"u{i}", 5 if i < 4 else 4)
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["rating_count"] == 8
    assert s["avg_rating"] == 4.5
    assert s["star_score"] == 36.0


def test_star_score_count_capped_at_ten(db_session, post_id):
    """avg=5, count=20 → star = 5 × min(20, 10) = 50.0 (cap engaged)"""
    for i in range(20):
        _add_rating(db_session, post_id, f"u{i}", 5)
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["rating_count"] == 20
    assert s["star_score"] == 50.0  # capped, NOT 100


# ─────────────────── Emoji bonus formula ───────────────────

def test_emoji_bonus_small_post(db_session, post_id):
    """Post A from spec: heart=5, fire=3, clap=2 → bonus = (1.5+0.9+0.4)×0.5 = 1.4"""
    for i in range(5): _add_reaction(db_session, post_id, f"h{i}", "heart")
    for i in range(3): _add_reaction(db_session, post_id, f"f{i}", "fire")
    for i in range(2): _add_reaction(db_session, post_id, f"c{i}", "clap")
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["emoji_counts"] == {"heart": 5, "fire": 3, "clap": 2}
    assert s["total_reactions"] == 10
    assert s["emoji_bonus"] == 1.4


def test_emoji_bonus_capped_at_2_5(db_session, post_id):
    """Post B from spec: heart=20, fire=15, love_eyes=10
    raw = 6+4.5+2 = 12.5 → cap at 5.0 × 0.5 = 2.5"""
    for i in range(20): _add_reaction(db_session, post_id, f"h{i}", "heart")
    for i in range(15): _add_reaction(db_session, post_id, f"f{i}", "fire")
    for i in range(10): _add_reaction(db_session, post_id, f"l{i}", "love_eyes")
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["emoji_bonus"] == 2.5  # capped


def test_legacy_emoji_excluded_from_score(db_session, post_id):
    """Post-migration legacy emojis (like, love, cool, wow) MUST NOT count."""
    for i in range(50):
        _add_reaction(db_session, post_id, f"u{i}", "like")  # legacy → ignored
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["emoji_bonus"] == 0
    assert s["emoji_counts"] == {}
    assert s["total_reactions"] == 0


# ─────────────────── Combined sort_score ───────────────────

def test_sort_score_combines_star_and_emoji(db_session, post_id):
    """Spec example A: avg=4.5, count=8, heart=5, fire=3, clap=2 → 37.4"""
    for i in range(8):
        _add_rating(db_session, post_id, f"u{i}", 5 if i < 4 else 4)
    for i in range(5): _add_reaction(db_session, post_id, f"h{i}", "heart")
    for i in range(3): _add_reaction(db_session, post_id, f"f{i}", "fire")
    for i in range(2): _add_reaction(db_session, post_id, f"c{i}", "clap")
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["star_score"] == 36.0
    assert s["emoji_bonus"] == 1.4
    assert s["sort_score"] == 37.4


def test_sort_score_emoji_only_post(db_session, post_id):
    """Spec example C: no ratings, lots of reactions → bonus capped at 2.5"""
    for i in range(100): _add_reaction(db_session, post_id, f"h{i}", "heart")
    for i in range(50):  _add_reaction(db_session, post_id, f"f{i}", "fire")
    db_session.commit()

    s = calculate_post_scores(db_session, post_id)
    assert s["star_score"] == 0
    assert s["emoji_bonus"] == 2.5
    assert s["sort_score"] == 2.5


def test_emoji_breaks_ties_between_equal_star_scores(db_session):
    """Two posts with identical star_score → higher emoji wins."""
    pa = "post-tie-a-" + str(uuid.uuid4())
    pb = "post-tie-b-" + str(uuid.uuid4())

    # Both: avg=4, count=5 → star=20
    for i in range(5):
        _add_rating(db_session, pa, f"a{i}", 4)
        _add_rating(db_session, pb, f"b{i}", 4)
    # A: 1 heart bonus = 0.15; B: 5 hearts → bonus = 0.75
    _add_reaction(db_session, pa, "x", "heart")
    for i in range(5): _add_reaction(db_session, pb, f"y{i}", "heart")
    db_session.commit()

    try:
        sa = calculate_post_scores(db_session, pa)
        sb = calculate_post_scores(db_session, pb)
        assert sa["star_score"] == sb["star_score"]
        assert sb["sort_score"] > sa["sort_score"]
    finally:
        db_session.query(Rating).filter(Rating.shared_outfit_id.in_([pa, pb])).delete(synchronize_session=False)
        db_session.query(Reaction).filter(Reaction.shared_outfit_id.in_([pa, pb])).delete(synchronize_session=False)
        db_session.commit()


# ─────────────────── get_user_reactions() ───────────────────

def test_get_user_reactions_only_includes_spec_emojis(db_session, post_id):
    user = "u-mixed"
    _add_reaction(db_session, post_id, user, "heart")
    _add_reaction(db_session, post_id, user, "fire")
    _add_reaction(db_session, post_id, user, "like")  # legacy: should be filtered
    db_session.commit()

    reactions = get_user_reactions(db_session, post_id, user)
    assert set(reactions) == {"heart", "fire"}


def test_get_user_reactions_other_users_excluded(db_session, post_id):
    _add_reaction(db_session, post_id, "user-A", "heart")
    _add_reaction(db_session, post_id, "user-B", "fire")
    db_session.commit()

    assert get_user_reactions(db_session, post_id, "user-A") == ["heart"]
    assert get_user_reactions(db_session, post_id, "user-B") == ["fire"]
    assert get_user_reactions(db_session, post_id, "user-NONE") == []
