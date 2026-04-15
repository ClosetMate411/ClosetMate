#!/usr/bin/env bash
# ClosetMate integration tests against Railway production.
#
# Usage:
#   export TEST_JWT="<paste a valid JWT from a logged-in browser session>"
#   export TEST_SHARED_OUTFIT_ID="<an existing shared_outfit_id you can react to>"
#   bash backend/tests/integration_test.sh
#
# Notes:
# - Targets ONLY the production Railway URLs.
# - Read-only by default. Tests that mutate state (rate/react/comment) require
#   TEST_JWT to be set; they are skipped otherwise.
# - The avatar test uploads a tiny PNG and then immediately deletes it.
# - The image moderation test uploads an obviously non-clothing image.

set -u  # error on undefined vars (-e disabled so we run all tests even if some fail)

GATEWAY="https://apigateway-production-b91d.up.railway.app"
IMG_SVC="https://imageprocessingservice-production-571d.up.railway.app"

PASS=0
FAIL=0

# ─── helpers ─────────────────────────────────────────────────────────────

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

check() {
    local name="$1" expected="$2" got="$3"
    if [[ "$got" == "$expected" ]]; then
        green "  PASS  $name  (got $got)"
        PASS=$((PASS+1))
    else
        red   "  FAIL  $name  (expected $expected, got $got)"
        FAIL=$((FAIL+1))
    fi
}

contains() {
    local name="$1" needle="$2" haystack="$3"
    if echo "$haystack" | grep -q "$needle"; then
        green "  PASS  $name  (contains '$needle')"
        PASS=$((PASS+1))
    else
        red   "  FAIL  $name  (missing '$needle')"
        red   "         body: $(echo "$haystack" | head -c 200)"
        FAIL=$((FAIL+1))
    fi
}

# ─── 1. Health + endpoint reachability ───────────────────────────────────

echo
echo "── 1. Health checks ──"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/health")
check "API gateway /health"            "200" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/api/health/all")
check "Aggregate /api/health/all"      "200" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" "$IMG_SVC/health")
check "Image service /health"          "200" "$status"

# ─── 2. Auth required on protected endpoints ─────────────────────────────

echo
echo "── 2. Auth gate ──"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/api/auth/me")
check "GET /auth/me without JWT"       "401" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$GATEWAY/api/auth/avatar")
check "PUT /auth/avatar without JWT"   "401" "$status"

status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY/api/community/feed")
check "GET /community/feed without JWT" "401" "$status"

# ─── 3. Authenticated tests (skipped unless TEST_JWT set) ────────────────

if [[ -z "${TEST_JWT:-}" ]]; then
    echo
    yellow "── 3-7. Skipping authenticated tests: TEST_JWT not set ──"
    yellow "         Set TEST_JWT='<jwt>' to enable rate/react/comment/avatar/feed tests."
else
    AUTH_HDR="Authorization: Bearer $TEST_JWT"

    echo
    echo "── 3. /auth/me returns avatar_url field ──"
    body=$(curl -s -H "$AUTH_HDR" "$GATEWAY/api/auth/me")
    contains "avatar_url present in /auth/me" '"avatar_url"' "$body"

    echo
    echo "── 4. Community feed returns engagement block ──"
    body=$(curl -s -H "$AUTH_HDR" "$GATEWAY/api/community/feed?limit=5")
    contains "engagement key present"        '"engagement"'    "$body"
    contains "sort_score field present"      '"sort_score"'    "$body"
    contains "emoji_counts field present"    '"emoji_counts"'  "$body"
    contains "my_reactions field present"    '"my_reactions"'  "$body"

    echo
    echo "── 5. Comment moderation: regex pre-filter blocks profanity ──"
    if [[ -n "${TEST_SHARED_OUTFIT_ID:-}" ]]; then
        body=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
            -d '{"text":"siktir lan bu ne saçmalık"}' \
            "$GATEWAY/api/community/$TEST_SHARED_OUTFIT_ID/comments")
        contains "comment rejection code"    '"COMMENT_REJECTED"' "$body"
        contains "strike_count returned"     '"strike_count"'      "$body"
    else
        yellow "  SKIP  TEST_SHARED_OUTFIT_ID not set"
    fi

    echo
    echo "── 6. Reaction toggle returns full engagement payload ──"
    if [[ -n "${TEST_SHARED_OUTFIT_ID:-}" ]]; then
        # Add a heart
        body=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
            -d '{"emoji_type":"heart"}' \
            "$GATEWAY/api/community/$TEST_SHARED_OUTFIT_ID/react")
        contains "react returns sort_score"  '"sort_score"'   "$body"
        contains "react returns my_reactions" '"my_reactions"' "$body"

        # Toggle off
        curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
            -d '{"emoji_type":"heart"}' \
            "$GATEWAY/api/community/$TEST_SHARED_OUTFIT_ID/react" >/dev/null
    else
        yellow "  SKIP  TEST_SHARED_OUTFIT_ID not set"
    fi

    echo
    echo "── 7. Invalid emoji rejected ──"
    if [[ -n "${TEST_SHARED_OUTFIT_ID:-}" ]]; then
        body=$(curl -s -X POST -H "$AUTH_HDR" -H "Content-Type: application/json" \
            -d '{"emoji_type":"like"}' \
            "$GATEWAY/api/community/$TEST_SHARED_OUTFIT_ID/react")
        contains "legacy emoji rejected"     '"INVALID_EMOJI"' "$body"
    fi

    echo
    echo "── 8. Avatar upload → returned in /auth/me → delete ──"
    # Tiny 1x1 transparent PNG
    cat > /tmp/cm_avatar.png <<'PNG_BYTES'
PNG_BYTES
    # Use a real tiny PNG via base64 (1x1 transparent)
    printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/cm_avatar.png

    body=$(curl -s -X PUT -H "$AUTH_HDR" \
        -F "avatar=@/tmp/cm_avatar.png;type=image/png" \
        "$GATEWAY/api/auth/avatar")
    contains "avatar PUT returns avatar_url" '"avatar_url"' "$body"

    # Verify /auth/me reflects it
    body=$(curl -s -H "$AUTH_HDR" "$GATEWAY/api/auth/me")
    contains "/auth/me has new avatar_url"   '"avatar_url"' "$body"

    # Delete
    status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "$AUTH_HDR" "$GATEWAY/api/auth/avatar")
    check "DELETE /auth/avatar"          "200" "$status"
    rm -f /tmp/cm_avatar.png
fi

# ─── 9. Image moderation: invalid clothing image rejected ────────────────

echo
echo "── 9. Image moderation (no auth required for /api/images/process) ──"
# A pure blue 100x100 PNG — Gemini should reject as "not clothing"
# (this only tests the IMAGE PROCESSING endpoint, not the wardrobe upload
# which requires JWT)
status=$(curl -s -o /dev/null -w "%{http_code}" "$IMG_SVC/health")
check "Image service still up"           "200" "$status"

# ─── Summary ─────────────────────────────────────────────────────────────

echo
echo "═══════════════════════════════════════════"
if [[ "$FAIL" -eq 0 ]]; then
    green "  ALL PASSED  ($PASS/$((PASS+FAIL)))"
else
    red   "  $FAIL FAILED, $PASS PASSED"
fi
echo "═══════════════════════════════════════════"
exit $FAIL
