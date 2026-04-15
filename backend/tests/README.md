# Tests

Two layers:
- **Unit tests** (pytest) — pure functions, no infra.
- **Integration tests** (bash + curl) — production Railway endpoints.

## Unit tests

```bash
cd backend
python -m pytest tests/ -v
```

Setup happens automatically in `tests/conftest.py`:
- `GEMINI_API_KEY`, `JWT_SECRET`, `INTERNAL_API_KEY` set to dummy values
- `DATABASE_URL=sqlite:///:memory:` for an ephemeral test DB
- `outfit_service/` and `community_service/` added to `sys.path`

### Test files

| File | What it covers |
|---|---|
| `test_pre_filter.py` | Task 2 Layer 1: regex profanity (TR + EN), leet-speak, separator-collapse, length cap, case-insensitive |
| `test_moderation_error.py` | Task 1: `ContentModerationError(user_message, internal_reason)` two-arg API, internal-reason-must-not-leak |
| `test_strike_system.py` | Task 2: `STRIKE_PUNISHMENTS`, `get_punishment()` ladder, `is_user_banned()` permanent/active/expired, `USER_FACING_MESSAGES` Turkish + no-leak |
| `test_engagement_scores.py` | Task 4: `EMOJI_WEIGHTS`, `calculate_post_scores()` formula (star_score, emoji_bonus, sort_score, caps), legacy emoji exclusion, tie-breaking, `get_user_reactions()` |

### Required Python packages

```bash
python -m pip install pytest fastapi sqlalchemy pyjwt bcrypt httpx pydantic python-multipart
```

(google-generativeai is stubbed in tests; you don't need the real SDK.)

## Integration tests

Targets **production Railway URLs**. There is no local instance.

```bash
# Anonymous-only checks (health, auth gates):
bash backend/tests/integration_test.sh

# With auth:
export TEST_JWT="<paste a valid JWT from a logged-in browser session>"
export TEST_SHARED_OUTFIT_ID="<a shared_outfit_id you can react to>"
bash backend/tests/integration_test.sh
```

What it tests:
1. Service health (gateway, image, aggregate)
2. Auth gates (401 on protected endpoints without JWT)
3. `/auth/me` returns `avatar_url`
4. `/community/feed` returns `engagement` block (sort_score, emoji_counts, my_reactions)
5. Profanity comment → `COMMENT_REJECTED` + strike count
6. `/react` returns full engagement payload
7. Legacy emoji (`like`) → `INVALID_EMOJI`
8. Avatar PUT → returned in `/auth/me` → DELETE
9. Image service still up

### Getting a TEST_JWT

In a logged-in browser session, open DevTools → Application → Local Storage →
copy the `token` value. Paste into `TEST_JWT`.

### Getting a TEST_SHARED_OUTFIT_ID

```bash
curl -s -H "Authorization: Bearer $TEST_JWT" \
  "https://apigateway-production-b91d.up.railway.app/api/community/feed?limit=1" \
  | python -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])"
```
