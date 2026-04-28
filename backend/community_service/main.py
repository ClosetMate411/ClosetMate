"""
Community Service - Social features for outfit sharing, ratings, reactions, comments
Port: 3004

Endpoints:
  POST   /community/share                        - Share an outfit
  DELETE /community/{shared_outfit_id}            - Unshare an outfit
  GET    /community/feed                          - Community feed
  GET    /community/top-rated                     - Top rated outfits
  GET    /community/notifications                 - User notifications
  PUT    /community/notifications/read            - Mark notifications as read
  POST   /community/{shared_outfit_id}/rate       - Rate a shared outfit
  POST   /community/{shared_outfit_id}/react      - React with emoji
  GET    /community/{shared_outfit_id}/comments   - Get comments
  POST   /community/{shared_outfit_id}/comments   - Add a comment
  DELETE /community/comments/{comment_id}         - Delete a comment
  GET    /health                                  - Health check
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator

from sqlalchemy import (
    create_engine, Column, String, Integer, Text, DateTime,
    Boolean, Float, UniqueConstraint, text as sa_text, func,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

import jwt
import httpx

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


# ============== CONFIGURATION ==============

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY environment variable is required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============== DATABASE ==============

# Same hardening as wardrobe_service — fail-fast on stuck Postgres so a dead
# replica's leftover lock can never wedge a fresh deploy in healthcheck retry.
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000 -c lock_timeout=15000 -c idle_in_transaction_session_timeout=60000",
    },
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Read-only reference models (outfit_service owns these tables) ─────────────

class OutfitRef(Base):
    """Read-only reference to outfit_service's outfits table"""
    __tablename__ = "outfits"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    name = Column(String(100))
    style = Column(String(30))
    occasion = Column(String(30))
    season = Column(String(20))
    cohesion_score = Column(Integer)
    reasoning = Column(Text)
    is_favorite = Column(Boolean)
    is_shareable = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class OutfitItemRef(Base):
    """Read-only reference to outfit_service's outfit_items table"""
    __tablename__ = "outfit_items"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    outfit_id = Column(String, nullable=False)
    item_id = Column(String, nullable=False)
    position = Column(Integer)


class UserRef(Base):
    """Read-only reference to wardrobe_service's users table"""
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    full_name = Column(String(100))
    email = Column(String(254))


class ClothingItemRef(Base):
    """Read-only reference to wardrobe_service's clothing_items table"""
    __tablename__ = "clothing_items"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    item_name = Column(String(255))
    image_url = Column(String)


# ── Community models (this service owns these tables) ─────────────────────────

class SharedOutfit(Base):
    __tablename__ = "shared_outfits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    outfit_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    shared_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "outfit_id": self.outfit_id,
            "user_id": self.user_id,
            "description": self.description,
            "shared_at": self.shared_at.isoformat() + "Z" if self.shared_at else None,
        }


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("shared_outfit_id", "user_id", name="uq_rating_user"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    shared_outfit_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 1-5
    created_at = Column(DateTime, default=datetime.utcnow)


class Reaction(Base):
    __tablename__ = "reactions"
    __table_args__ = (
        UniqueConstraint("shared_outfit_id", "user_id", name="uq_reaction_user"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    shared_outfit_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    emoji_type = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    shared_outfit_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_user_id = Column(String, nullable=False, index=True)
    actor_user_id = Column(String, nullable=False)
    shared_outfit_id = Column(String, nullable=False)
    type = Column(String(20), nullable=False)  # "rating", "reaction", "comment", "favorite"
    detail = Column(String(50), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunityFavorite(Base):
    __tablename__ = "community_favorites"
    __table_args__ = (
        UniqueConstraint("shared_outfit_id", "user_id", name="uq_favorite_user"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    shared_outfit_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── User reference (owned by wardrobe_service, accessed read/write here) ─────
# Only the columns this service touches are mapped.
class UserRef(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True)
    full_name = Column(String(100))
    avatar_url = Column(String(500), nullable=True)
    comment_strike_count = Column(Integer, default=0)
    comment_banned_until = Column(DateTime, nullable=True)
    comment_ban_permanent = Column(Boolean, default=False)


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    action_type = Column(String(20), nullable=False)            # "comment", "image", "post"
    content_preview = Column(String(200), nullable=True)        # first 200 chars of offending content
    internal_reason = Column(String(500), nullable=True)        # Gemini's detailed reason (NOT shown to user)
    severity = Column(String(10), nullable=True)                # "low" | "medium" | "high"
    detection_layer = Column(String(20), nullable=True)         # "pre_filter" | "gemini" | "output_validation" | "gemini_fallback"
    strike_number = Column(Integer, nullable=False)
    punishment = Column(String(50), nullable=False)             # "warning" | "ban_1h" | "ban_24h" | "ban_permanent"
    created_at = Column(DateTime, default=datetime.utcnow)


# Only create community tables — never touch outfit/wardrobe tables
SharedOutfit.__table__.create(bind=engine, checkfirst=True)
Rating.__table__.create(bind=engine, checkfirst=True)
Reaction.__table__.create(bind=engine, checkfirst=True)
Comment.__table__.create(bind=engine, checkfirst=True)
Notification.__table__.create(bind=engine, checkfirst=True)
CommunityFavorite.__table__.create(bind=engine, checkfirst=True)
ModerationLog.__table__.create(bind=engine, checkfirst=True)

# Idempotent migrations for strike columns on users (owned by wardrobe_service,
# but applied here too for safety in case wardrobe_service hasn't run yet).
# Also adds detection_layer to moderation_logs in case the table existed before
# the column was introduced.
with engine.connect() as _conn:
    for _stmt in (
        "ALTER TABLE users ADD COLUMN comment_strike_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN comment_banned_until TIMESTAMP DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN comment_ban_permanent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE moderation_logs ADD COLUMN detection_layer VARCHAR(20) DEFAULT NULL",
    ):
        try:
            _conn.execute(sa_text(_stmt))
            _conn.commit()
        except Exception:
            _conn.rollback()

    # One-shot orphan cleanup: delete community rows whose parent outfit or
    # parent SharedOutfit is gone. Runs on every boot; idempotent (deletes
    # nothing once the DB is clean). Handles historical inconsistencies
    # that pre-date the cascading-delete fixes in unshare_outfit and the
    # new /community/internal/outfits/{id}/purge endpoint.
    _orphan_cleanups = (
        # Children of SharedOutfits whose parent Outfit row no longer exists.
        "DELETE FROM notifications WHERE shared_outfit_id IN ("
        "  SELECT so.id FROM shared_outfits so "
        "  LEFT JOIN outfits o ON o.id = so.outfit_id WHERE o.id IS NULL)",
        "DELETE FROM ratings WHERE shared_outfit_id IN ("
        "  SELECT so.id FROM shared_outfits so "
        "  LEFT JOIN outfits o ON o.id = so.outfit_id WHERE o.id IS NULL)",
        "DELETE FROM reactions WHERE shared_outfit_id IN ("
        "  SELECT so.id FROM shared_outfits so "
        "  LEFT JOIN outfits o ON o.id = so.outfit_id WHERE o.id IS NULL)",
        "DELETE FROM comments WHERE shared_outfit_id IN ("
        "  SELECT so.id FROM shared_outfits so "
        "  LEFT JOIN outfits o ON o.id = so.outfit_id WHERE o.id IS NULL)",
        "DELETE FROM community_favorites WHERE shared_outfit_id IN ("
        "  SELECT so.id FROM shared_outfits so "
        "  LEFT JOIN outfits o ON o.id = so.outfit_id WHERE o.id IS NULL)",
        "DELETE FROM shared_outfits WHERE outfit_id NOT IN (SELECT id FROM outfits)",
        # Rows whose SharedOutfit itself is gone (unshare didn't cascade pre-fix).
        "DELETE FROM notifications WHERE shared_outfit_id NOT IN (SELECT id FROM shared_outfits)",
        "DELETE FROM community_favorites WHERE shared_outfit_id NOT IN (SELECT id FROM shared_outfits)",
        "DELETE FROM ratings WHERE shared_outfit_id NOT IN (SELECT id FROM shared_outfits)",
        "DELETE FROM reactions WHERE shared_outfit_id NOT IN (SELECT id FROM shared_outfits)",
        "DELETE FROM comments WHERE shared_outfit_id NOT IN (SELECT id FROM shared_outfits)",
    )
    for _stmt in _orphan_cleanups:
        try:
            _conn.execute(sa_text(_stmt))
            _conn.commit()
        except Exception as _e:
            _conn.rollback()
            logger.warning(f"Orphan cleanup skipped: {_e}")

    # Reconcile outfits.is_shareable with the shared_outfits table. This
    # corrects flag drift left over from the period when share/unshare
    # updated is_shareable via a fire-and-forget HTTP call that could fail
    # silently. After this sweep, the flag matches reality:
    #   - is_shareable = TRUE  ⇔ a SharedOutfit row exists for the outfit
    #   - is_shareable = FALSE ⇔ no SharedOutfit row exists
    _shareable_reconciliation = (
        # Outfits that ARE currently shared but flagged false → fix to true.
        "UPDATE outfits SET is_shareable = TRUE "
        "WHERE id IN (SELECT outfit_id FROM shared_outfits) "
        "  AND (is_shareable IS NULL OR is_shareable = FALSE)",
        # Outfits NOT currently shared but flagged true → fix to false.
        # This is the case that bit users when their unshare's is_shareable=false
        # callback failed silently and the flag stayed true forever.
        "UPDATE outfits SET is_shareable = FALSE "
        "WHERE is_shareable = TRUE "
        "  AND id NOT IN (SELECT outfit_id FROM shared_outfits)",
    )
    for _stmt in _shareable_reconciliation:
        try:
            _conn.execute(sa_text(_stmt))
            _conn.commit()
        except Exception as _e:
            _conn.rollback()
            logger.warning(f"Shareable-flag reconciliation skipped: {_e}")

    # v4 emoji migration: legacy emoji_type → new spec set.
    # Idempotent — once a row is migrated, the WHERE clause matches nothing.
    # The NOT EXISTS guard prevents UNIQUE(shared_outfit_id, user_id, emoji_type)
    # violations when the same user already has both legacy and new variants.
    for _old, _new in (("like", "heart"), ("love", "love_eyes"), ("cool", "clap"), ("wow", "idea")):
        try:
            _conn.execute(sa_text(
                "UPDATE reactions SET emoji_type = :new "
                "WHERE emoji_type = :old "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM reactions r2 "
                "  WHERE r2.shared_outfit_id = reactions.shared_outfit_id "
                "    AND r2.user_id = reactions.user_id "
                "    AND r2.emoji_type = :new"
                ")"
            ), {"old": _old, "new": _new})
            _conn.commit()
        except Exception as _e:
            _conn.rollback()
            logger.warning(f"Emoji migration {_old}->{_new} skipped: {_e}")


# ============== CONSTANTS ==============

# v4: 5-emoji engagement system. Existing reactions in DB with the legacy
# emoji set (like/love/cool/wow) are preserved but no longer surfaced.
EMOJI_WEIGHTS = {
    "heart":     0.3,  # ❤️
    "fire":      0.3,  # 🔥
    "clap":      0.2,  # 👏
    "love_eyes": 0.2,  # 😍
    "idea":      0.1,  # 💡
}
VALID_EMOJI_TYPES = set(EMOJI_WEIGHTS.keys())


# ============== COMMENT MODERATION POLICY ==============
#
# Every comment is checked by the Gemini moderation pipeline on every submit.
# Failing comments are rejected with a 400 response and a generic Turkish
# "topluluk kurallarına aykırı" message. No strike counting, no banning — the
# per-user rate limit on POST /comments handles spam/abuse, and Gemini
# handles content filtering. The legacy User.comment_* fields are kept on
# the schema for backwards compatibility but no longer written to.


# ============== ENGAGEMENT SCORING ==============

def calculate_post_scores(db: Session, shared_outfit_id: str) -> dict:
    """
    Compute star_score + emoji_bonus + sort_score for a single shared outfit (post).

      star_score   = avg_rating × min(rating_count, 10)        # max 50.0
      emoji_bonus  = min(Σ count×weight, 5.0) × 0.5            # max 2.5
      sort_score   = star_score + emoji_bonus
    """
    # Star score
    star_stats = db.query(
        func.avg(Rating.score).label("avg_rating"),
        func.count(Rating.id).label("rating_count"),
    ).filter(Rating.shared_outfit_id == shared_outfit_id).first()

    avg_rating = round(float(star_stats.avg_rating or 0), 2)
    rating_count = int(star_stats.rating_count or 0)
    star_score = round(avg_rating * min(rating_count, 10), 2)

    # Emoji bonus (only counts current-spec emojis; legacy ones are ignored)
    emoji_rows = db.query(
        Reaction.emoji_type,
        func.count(Reaction.id).label("cnt"),
    ).filter(
        Reaction.shared_outfit_id == shared_outfit_id,
        Reaction.emoji_type.in_(list(VALID_EMOJI_TYPES)),
    ).group_by(Reaction.emoji_type).all()

    emoji_breakdown: dict = {}
    raw_emoji_bonus = 0.0
    for emoji_type, cnt in emoji_rows:
        weight = EMOJI_WEIGHTS.get(emoji_type, 0.1)
        raw_emoji_bonus += cnt * weight
        emoji_breakdown[emoji_type] = int(cnt)

    emoji_bonus = round(min(raw_emoji_bonus, 5.0) * 0.5, 2)
    total_reactions = sum(emoji_breakdown.values())
    sort_score = round(star_score + emoji_bonus, 2)

    return {
        "avg_rating": avg_rating,
        "rating_count": rating_count,
        "star_score": star_score,
        "emoji_bonus": emoji_bonus,
        "sort_score": sort_score,
        "total_reactions": total_reactions,
        "emoji_counts": emoji_breakdown,
    }


def get_user_reactions(db: Session, shared_outfit_id: str, user_id: str) -> list:
    """Which spec-emojis the given user has currently active on this post."""
    rows = db.query(Reaction.emoji_type).filter(
        Reaction.shared_outfit_id == shared_outfit_id,
        Reaction.user_id == user_id,
        Reaction.emoji_type.in_(list(VALID_EMOJI_TYPES)),
    ).all()
    return [r[0] for r in rows]


# ============== DEPENDENCIES ==============

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def decode_token(token: str) -> dict:
    """Decode JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract user_id from JWT"""
    payload = decode_token(credentials.credentials)
    return payload["user_id"]


def require_internal_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Require X-API-Key matching INTERNAL_API_KEY. Used for privileged
    operations (reset-strikes, moderation-logs) — no human role, only
    whoever holds the internal key can execute."""
    if not INTERNAL_API_KEY or not x_api_key or x_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")
    return "internal"


def create_error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


# ============== REQUEST MODELS ==============

class ShareOutfitRequest(BaseModel):
    outfit_id: str
    description: Optional[str] = None


class RateRequest(BaseModel):
    score: int = Field(..., ge=1, le=5)


class ReactRequest(BaseModel):
    emoji_type: str


class CommentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    reply_to_comment_id: Optional[str] = None

    @validator("text")
    def text_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Comment cannot be empty or whitespace only")
        return v.strip()


# ============== APP ==============

app = FastAPI(
    title="ClosetMate Community Service",
    version="1.0.0",
    # Internal service — no public docs
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Rate limiting — per-user throttle keyed off the JWT user_id.
#
# Per-IP limiting is trivially bypassed by VPNs and residential proxies, so
# we key on the authenticated user instead. To change identity an attacker
# needs a full register + OTP verification flow, which is itself rate-limited
# on the wardrobe service.  For unauthenticated callers (there shouldn't be
# any on limited endpoints, but better safe than sorry) we fall back to IP.
def _rate_limit_key(request: Request) -> str:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            uid = payload.get("user_id")
            if uid:
                return f"user:{uid}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://closetmate.org.tr",
        "https://www.closetmate.org.tr",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_name = type(exc).__name__
    if "OperationalError" in error_name or "DisconnectionError" in error_name:
        logger.error(f"Database connection error: {exc}")
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": {"code": "DATABASE_UNAVAILABLE", "message": "Database connection failed. Please try again later."}}
        )
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred. Please try again later."}}
    )


# ============== USER SEARCH ==============

@app.get("/community/users/search")
async def search_users(
    q: str = Query("", max_length=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Search users by name for @mention autocomplete.

    Empty q returns the first page of all named users alphabetically (so
    typing "@" with no filter shows the directory, not just whoever happens
    to be at the top of the insertion order). A typed query narrows it.
    """
    query = db.query(UserRef).filter(
        UserRef.id != user_id,
        UserRef.full_name.isnot(None),
        UserRef.full_name != "",
    )
    if q.strip():
        query = query.filter(UserRef.full_name.ilike(f"%{q.strip()}%"))
    users = (
        query.order_by(UserRef.full_name.asc())
             .limit(20)
             .all()
    )

    return {
        "success": True,
        "data": [
            {"user_id": u.id, "name": u.full_name, "avatar_url": u.avatar_url}
            for u in users
        ],
    }


@app.get("/community/users/{profile_user_id}")
async def get_user_profile(
    profile_user_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a user's community profile"""
    profile_user = db.query(UserRef).filter(UserRef.id == profile_user_id).first()
    if not profile_user:
        return create_error_response("NOT_FOUND", "User not found", 404)

    # Shared outfits by this user
    shared_outfits = db.query(SharedOutfit).filter(
        SharedOutfit.user_id == profile_user_id
    ).order_by(SharedOutfit.shared_at.desc()).all()

    outfits = []
    for shared in shared_outfits:
        item = _assemble_feed_item(shared, user_id, db)
        if item:
            outfits.append(item)

    # Stats
    total_shared = len(outfits)
    total_ratings = 0
    total_score = 0
    total_favorites = 0
    for o in outfits:
        count = o["ratings"]["count"] or 0
        avg = o["ratings"]["average"] or 0
        total_ratings += count
        total_score += avg * count
        total_favorites += o["favorites"]["count"]

    avg_rating = round(total_score / total_ratings, 1) if total_ratings > 0 else None

    return {
        "success": True,
        "data": {
            "user": {
                "user_id": profile_user.id,
                "name": profile_user.full_name,
                "avatar_url": profile_user.avatar_url,
                "is_self": profile_user.id == user_id,
            },
            "stats": {
                "total_shared": total_shared,
                "total_ratings_received": total_ratings,
                "average_rating": avg_rating,
                "total_favorites_received": total_favorites,
            },
            "outfits": outfits,
        },
    }


# ============== HEALTH ==============

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(sa_text("SELECT 1"))
        return {"status": "healthy", "service": "community", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "service": "community", "database": "disconnected", "error": str(e)}
        )


# ============== COMMUNITY ENDPOINTS ==============

# ── 1. Share outfit ───────────────────────────────────────────────────────────

@app.post("/community/share")
async def share_outfit(
    body: ShareOutfitRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Share an outfit to the community feed"""
    # Verify outfit exists and belongs to user
    outfit = db.query(OutfitRef).filter(
        OutfitRef.id == body.outfit_id,
        OutfitRef.user_id == user_id,
    ).first()

    if not outfit:
        return create_error_response("OUTFIT_NOT_FOUND", "Outfit not found or not yours", 404)

    # Check if already shared
    existing = db.query(SharedOutfit).filter(
        SharedOutfit.outfit_id == body.outfit_id,
    ).first()
    if existing:
        return create_error_response("ALREADY_SHARED", "This outfit is already shared")

    # Create shared outfit
    shared = SharedOutfit(
        outfit_id=body.outfit_id,
        user_id=user_id,
        description=body.description,
    )
    db.add(shared)

    # Flip is_shareable=true directly on the outfits row in the same
    # transaction. Both services share the database engine, so this is
    # atomic with the SharedOutfit insert and cannot drift if a separate
    # HTTP call to outfit_service silently fails.
    db.execute(
        sa_text("UPDATE outfits SET is_shareable = TRUE WHERE id = :oid"),
        {"oid": body.outfit_id},
    )
    db.commit()
    db.refresh(shared)

    logger.info(f"Outfit {body.outfit_id} shared by user {user_id}")
    return {"success": True, "data": shared.to_dict()}


# ── 2. Unshare outfit ────────────────────────────────────────────────────────

@app.delete("/community/{shared_outfit_id}")
async def unshare_outfit(
    shared_outfit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove a shared outfit from the community feed"""
    shared = db.query(SharedOutfit).filter(
        SharedOutfit.id == shared_outfit_id,
        SharedOutfit.user_id == user_id,
    ).first()

    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found or not yours", 404)

    outfit_id = shared.outfit_id

    # Delete related data
    db.query(Rating).filter(Rating.shared_outfit_id == shared_outfit_id).delete()
    db.query(Reaction).filter(Reaction.shared_outfit_id == shared_outfit_id).delete()
    db.query(Comment).filter(Comment.shared_outfit_id == shared_outfit_id).delete()
    db.query(Notification).filter(Notification.shared_outfit_id == shared_outfit_id).delete()
    db.query(CommunityFavorite).filter(CommunityFavorite.shared_outfit_id == shared_outfit_id).delete()
    db.delete(shared)

    # Flip is_shareable=false on the outfits row in the same transaction so
    # the flag cannot drift even if a separate HTTP call to outfit_service
    # would have failed silently.
    db.execute(
        sa_text("UPDATE outfits SET is_shareable = FALSE WHERE id = :oid"),
        {"oid": outfit_id},
    )
    db.commit()

    logger.info(f"Shared outfit {shared_outfit_id} removed by user {user_id}")
    return {"success": True, "message": "Outfit unshared successfully"}


# ── Internal: purge all community data tied to an outfit ─────────────────────
# Called by outfit_service when an outfit is hard-deleted, so downstream
# community rows (shared_outfits + ratings/reactions/comments/notifications/
# favorites) don't outlive their source outfit.

@app.delete("/community/internal/outfits/{outfit_id}/purge")
async def purge_outfit_community_data(
    outfit_id: str,
    _: str = Depends(require_internal_key),
    db: Session = Depends(get_db),
):
    shared_rows = db.query(SharedOutfit).filter(SharedOutfit.outfit_id == outfit_id).all()
    shared_ids = [s.id for s in shared_rows]

    if shared_ids:
        db.query(Rating).filter(Rating.shared_outfit_id.in_(shared_ids)).delete(synchronize_session=False)
        db.query(Reaction).filter(Reaction.shared_outfit_id.in_(shared_ids)).delete(synchronize_session=False)
        db.query(Comment).filter(Comment.shared_outfit_id.in_(shared_ids)).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.shared_outfit_id.in_(shared_ids)).delete(synchronize_session=False)
        db.query(CommunityFavorite).filter(CommunityFavorite.shared_outfit_id.in_(shared_ids)).delete(synchronize_session=False)
        db.query(SharedOutfit).filter(SharedOutfit.id.in_(shared_ids)).delete(synchronize_session=False)

    db.commit()
    return {"success": True, "purged_shares": len(shared_ids)}


# ── Helper: assemble a feed item from a SharedOutfit row ─────────────────────

def _assemble_feed_item(shared: SharedOutfit, user_id: str, db: Session) -> dict | None:
    """Build a single feed-item dict. Returns None if the outfit no longer exists."""
    outfit = db.query(OutfitRef).filter(OutfitRef.id == shared.outfit_id).first()
    if not outfit:
        return None

    outfit_items = (
        db.query(OutfitItemRef)
        .filter(OutfitItemRef.outfit_id == shared.outfit_id)
        .order_by(OutfitItemRef.position)
        .all()
    )

    user_ref = db.query(UserRef).filter(UserRef.id == shared.user_id).first()
    user_name = user_ref.full_name if user_ref else "Unknown"
    user_avatar_url = user_ref.avatar_url if user_ref else None

    avg_rating = db.query(func.avg(Rating.score)).filter(
        Rating.shared_outfit_id == shared.id,
    ).scalar()
    rating_count = db.query(Rating).filter(
        Rating.shared_outfit_id == shared.id,
    ).count()

    user_rating = db.query(Rating).filter(
        Rating.shared_outfit_id == shared.id,
        Rating.user_id == user_id,
    ).first()

    reactions = (
        db.query(Reaction.emoji_type, func.count(Reaction.id))
        .filter(Reaction.shared_outfit_id == shared.id)
        .group_by(Reaction.emoji_type)
        .all()
    )
    reaction_counts = {emoji: count for emoji, count in reactions}

    user_reactions = (
        db.query(Reaction.emoji_type)
        .filter(Reaction.shared_outfit_id == shared.id, Reaction.user_id == user_id)
        .all()
    )
    user_reaction_types = [r[0] for r in user_reactions]

    comment_count = db.query(Comment).filter(
        Comment.shared_outfit_id == shared.id,
    ).count()

    favorite_count = db.query(CommunityFavorite).filter(
        CommunityFavorite.shared_outfit_id == shared.id,
    ).count()
    user_has_favorited = db.query(CommunityFavorite).filter(
        CommunityFavorite.shared_outfit_id == shared.id,
        CommunityFavorite.user_id == user_id,
    ).first() is not None

    item_ids = [oi.item_id for oi in outfit_items]
    clothing_items = db.query(ClothingItemRef).filter(
        ClothingItemRef.id.in_(item_ids)
    ).all() if item_ids else []
    items_map = {ci.id: ci for ci in clothing_items}
    resolved_items = [
        {
            "id": iid,
            "name": items_map[iid].item_name if iid in items_map else "Unknown",
            "image_url": items_map[iid].image_url if iid in items_map else None,
        }
        for iid in item_ids
    ]

    # v4 engagement scores (star_score + emoji_bonus → sort_score)
    scores = calculate_post_scores(db, shared.id)
    my_reactions_v4 = get_user_reactions(db, shared.id, user_id)

    return {
        "id": shared.id,
        "outfit": {
            "id": outfit.id,
            "name": outfit.name,
            "style": outfit.style,
            "occasion": outfit.occasion,
            "season": outfit.season,
            "cohesion_score": outfit.cohesion_score,
            "reasoning": outfit.reasoning,
            "item_ids": item_ids,
            "items": resolved_items,
        },
        "shared_by": {
            "user_id": shared.user_id,
            "name": user_name,
            "avatar_url": user_avatar_url,
            "is_self": shared.user_id == user_id,
        },
        "description": shared.description,
        "shared_at": shared.shared_at.isoformat() + "Z" if shared.shared_at else None,
        # Legacy blocks (kept for backward compatibility with existing frontend)
        "ratings": {
            "average": round(float(avg_rating), 1) if avg_rating else None,
            "count": rating_count,
            "user_rating": user_rating.score if user_rating else None,
        },
        "reactions": {
            "counts": reaction_counts,
            "user_reactions": user_reaction_types,
        },
        "comment_count": comment_count,
        "favorites": {
            "count": favorite_count,
            "user_has_favorited": user_has_favorited,
        },
        # v4 engagement system: full scoring + spec-emoji-only counts
        "engagement": {
            "avg_rating":      scores["avg_rating"],
            "rating_count":    scores["rating_count"],
            "star_score":      scores["star_score"],
            "emoji_bonus":     scores["emoji_bonus"],
            "sort_score":      scores["sort_score"],
            "total_reactions": scores["total_reactions"],
            "emoji_counts":    scores["emoji_counts"],
            "my_reactions":    my_reactions_v4,
            "my_rating":       user_rating.score if user_rating else None,
        },
    }


# ── 3. Community feed ────────────────────────────────────────────────────────

@app.get("/community/feed")
async def get_community_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get the community feed ranked by v4 engagement: sort_score = star_score + emoji_bonus,
    tie-broken by recency. Two-stage ranking: SQL pre-sort by star_score over a wider
    candidate window, then exact re-rank in Python by sort_score before slicing the page.
    """
    offset = (page - 1) * limit

    total = db.query(SharedOutfit).count()

    # Pre-sort coarse window by star_score (cheap SQL).
    star_score_sql = (
        func.coalesce(func.avg(Rating.score), 0.0)
        * func.least(func.count(Rating.id), 10)
    )
    candidate_window = max(limit * 3, offset + limit + 20)
    candidates = (
        db.query(SharedOutfit)
        .outerjoin(Rating, Rating.shared_outfit_id == SharedOutfit.id)
        .group_by(SharedOutfit.id)
        .order_by(star_score_sql.desc(), SharedOutfit.shared_at.desc())
        .limit(candidate_window)
        .all()
    )

    # Assemble + exact re-rank by sort_score (star_score + emoji_bonus).
    feed: list = []
    for shared in candidates:
        item = _assemble_feed_item(shared, user_id, db)
        if item:
            feed.append(item)

    feed.sort(
        key=lambda it: (
            it["engagement"]["sort_score"],
            it["shared_at"] or "",
        ),
        reverse=True,
    )

    feed = feed[offset:offset + limit]

    return {
        "success": True,
        "data": feed,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


# ── 3b. Top Rated ────────────────────────────────────────────────────────────

@app.get("/community/top-rated")
async def get_top_rated(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get top-rated shared outfits.

    Score formula: SUM(rating.score) * 10 + COUNT(reactions) * 10
    (each star across all voters × 10 + each emoji reaction × 10).
    Example: 5 voters giving (4,5,5,4,5) + 1 emoji = 23×10 + 1×10 = 240 points.
    """
    offset = (page - 1) * limit

    # Per-outfit rating points: SUM(score) * 10
    rating_points_q = (
        db.query(
            Rating.shared_outfit_id.label("sid"),
            (func.coalesce(func.sum(Rating.score), 0) * 10).label("rating_points"),
        )
        .group_by(Rating.shared_outfit_id)
        .subquery()
    )

    # Per-outfit reaction points: COUNT(*) * 10
    reaction_points_q = (
        db.query(
            Reaction.shared_outfit_id.label("sid"),
            (func.count(Reaction.id) * 10).label("reaction_points"),
        )
        .group_by(Reaction.shared_outfit_id)
        .subquery()
    )

    # Combine: total_score per shared_outfit
    total_score = (
        func.coalesce(rating_points_q.c.rating_points, 0)
        + func.coalesce(reaction_points_q.c.reaction_points, 0)
    ).label("total_score")

    # Base query across SharedOutfit with LEFT JOINs so outfits with only ratings
    # or only reactions are both included. Filter out outfits with zero engagement.
    scored_q = (
        db.query(SharedOutfit, total_score)
        .outerjoin(rating_points_q, SharedOutfit.id == rating_points_q.c.sid)
        .outerjoin(reaction_points_q, SharedOutfit.id == reaction_points_q.c.sid)
        .filter(total_score > 0)
    )

    total = scored_q.count()

    top_rows = (
        scored_q
        .order_by(total_score.desc(), SharedOutfit.shared_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    feed = []
    for shared, _ in top_rows:
        item = _assemble_feed_item(shared, user_id, db)
        if item:
            feed.append(item)

    return {
        "success": True,
        "data": feed,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total or 0,
            "pages": ((total or 0) + limit - 1) // limit if total else 0,
        },
    }


# ── 3c. Notifications ────────────────────────────────────────────────────────

@app.get("/community/notifications")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get notifications for the current user"""
    offset = (page - 1) * limit

    # Only surface notifications whose SharedOutfit AND underlying Outfit still
    # exist. Orphans (outfit deleted, share removed, etc.) are hidden from the
    # UI; a startup sweep reclaims their storage.
    base_query = (
        db.query(Notification)
        .join(SharedOutfit, SharedOutfit.id == Notification.shared_outfit_id)
        .join(OutfitRef, OutfitRef.id == SharedOutfit.outfit_id)
        .filter(Notification.recipient_user_id == user_id)
    )

    total = base_query.count()

    unread_count = base_query.filter(Notification.is_read == False).count()

    notifications = (
        base_query
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for n in notifications:
        # Resolve actor name + avatar
        actor_ref = db.query(UserRef).filter(UserRef.id == n.actor_user_id).first()
        actor_name = actor_ref.full_name if actor_ref else "Someone"
        actor_avatar_url = actor_ref.avatar_url if actor_ref else None

        # Resolve outfit name
        shared = db.query(SharedOutfit).filter(SharedOutfit.id == n.shared_outfit_id).first()
        outfit_name = None
        if shared:
            outfit_ref = db.query(OutfitRef).filter(OutfitRef.id == shared.outfit_id).first()
            outfit_name = outfit_ref.name if outfit_ref else None

        items.append({
            "id": n.id,
            "type": n.type,
            "detail": n.detail,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
            "actor": {"user_id": n.actor_user_id, "name": actor_name, "avatar_url": actor_avatar_url},
            "shared_outfit_id": n.shared_outfit_id,
            "outfit_name": outfit_name,
        })

    return {
        "success": True,
        "data": items,
        "unread_count": unread_count,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


@app.put("/community/notifications/read")
async def mark_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}


# ── 3d. Community Favorites ──────────────────────────────────────────────────

@app.post("/community/{shared_outfit_id}/favorite")
async def toggle_favorite(
    shared_outfit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Toggle favorite on a shared outfit"""
    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    existing = db.query(CommunityFavorite).filter(
        CommunityFavorite.shared_outfit_id == shared_outfit_id,
        CommunityFavorite.user_id == user_id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        count = db.query(CommunityFavorite).filter(
            CommunityFavorite.shared_outfit_id == shared_outfit_id
        ).count()
        return {"success": True, "data": {"action": "removed", "favorite_count": count}}

    fav = CommunityFavorite(
        shared_outfit_id=shared_outfit_id,
        user_id=user_id,
    )
    db.add(fav)
    db.commit()

    count = db.query(CommunityFavorite).filter(
        CommunityFavorite.shared_outfit_id == shared_outfit_id
    ).count()

    # Notify outfit owner (skip self)
    if shared.user_id != user_id:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="favorite",
        ))
        db.commit()

    return {"success": True, "data": {"action": "added", "favorite_count": count}}


@app.get("/community/favorites")
async def get_favorites(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get user's favorited community outfits"""
    offset = (page - 1) * limit

    total = db.query(CommunityFavorite).filter(
        CommunityFavorite.user_id == user_id
    ).count()

    fav_rows = (
        db.query(CommunityFavorite)
        .filter(CommunityFavorite.user_id == user_id)
        .order_by(CommunityFavorite.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    feed = []
    for fav in fav_rows:
        shared = db.query(SharedOutfit).filter(SharedOutfit.id == fav.shared_outfit_id).first()
        if not shared:
            continue
        item = _assemble_feed_item(shared, user_id, db)
        if item:
            feed.append(item)

    return {
        "success": True,
        "data": feed,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


# ── 4. Rate a shared outfit ──────────────────────────────────────────────────

@app.post("/community/{shared_outfit_id}/rate")
async def rate_outfit(
    shared_outfit_id: str,
    body: RateRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Rate a shared outfit (1-5). Updates if already rated."""
    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    if shared.user_id == user_id:
        return create_error_response("SELF_RATE", "You cannot rate your own outfit", 403)

    # Upsert rating
    existing = db.query(Rating).filter(
        Rating.shared_outfit_id == shared_outfit_id,
        Rating.user_id == user_id,
    ).first()

    if existing:
        existing.score = body.score
    else:
        rating = Rating(
            shared_outfit_id=shared_outfit_id,
            user_id=user_id,
            score=body.score,
        )
        db.add(rating)

    db.commit()

    # Create notification (skip self-notifications)
    if shared.user_id != user_id:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="rating",
            detail=str(body.score),
        ))
        db.commit()

    # Full engagement scores for optimistic UI re-sort
    scores = calculate_post_scores(db, shared_outfit_id)
    my_reactions = get_user_reactions(db, shared_outfit_id, user_id)

    logger.info(f"User {user_id} rated shared outfit {shared_outfit_id}: {body.score}/5")
    return {
        "success": True,
        "data": {
            "post_id": shared_outfit_id,
            "user_score": body.score,
            "my_reactions": my_reactions,
            **scores,
        },
    }


# ── 5. React with emoji ──────────────────────────────────────────────────────

@app.post("/community/{shared_outfit_id}/react")
async def react_to_outfit(
    shared_outfit_id: str,
    body: ReactRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Toggle/switch an emoji reaction on a shared outfit (1 emoji per user per outfit)"""
    if body.emoji_type not in VALID_EMOJI_TYPES:
        return create_error_response(
            "INVALID_EMOJI",
            f"Invalid emoji type. Valid types: {', '.join(VALID_EMOJI_TYPES)}",
        )

    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    if shared.user_id == user_id:
        return create_error_response("SELF_REACT", "You cannot react to your own outfit", 403)

    # Find any existing reaction by this user on this outfit (regardless of emoji_type)
    existing = db.query(Reaction).filter(
        Reaction.shared_outfit_id == shared_outfit_id,
        Reaction.user_id == user_id,
    ).first()

    previous_emoji: Optional[str] = None

    # Whether we should send a notification on this request — only set when
    # the user expresses positive intent (added a new emoji or switched to a
    # different one). Toggle-off does not notify.
    should_notify = False

    # Case 1: same emoji already exists → remove (toggle off, no notification)
    if existing and existing.emoji_type == body.emoji_type:
        db.delete(existing)
        db.commit()
        action = "removed"

    # Case 2: different emoji exists → switch (update in place, notify)
    elif existing and existing.emoji_type != body.emoji_type:
        previous_emoji = existing.emoji_type
        existing.emoji_type = body.emoji_type
        existing.created_at = datetime.utcnow()
        db.commit()
        action = "switched"
        should_notify = True

    # Case 3: no reaction yet → add (notify)
    else:
        reaction = Reaction(
            shared_outfit_id=shared_outfit_id,
            user_id=user_id,
            emoji_type=body.emoji_type,
        )
        db.add(reaction)
        db.commit()
        action = "added"
        should_notify = True

    # Notify owner on every positive reaction event (skip self).
    # Without this, switching from heart→fire was silent because the
    # notification used to live inside the "added" branch only.
    if should_notify and shared.user_id != user_id:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="reaction",
            detail=body.emoji_type,
        ))
        db.commit()

    # Full updated scores + which emojis the user has active for optimistic UI
    scores = calculate_post_scores(db, shared_outfit_id)
    my_reactions = get_user_reactions(db, shared_outfit_id, user_id)

    return {
        "success": True,
        "data": {
            "post_id": shared_outfit_id,
            "action": action,
            "emoji_type": body.emoji_type,
            "previous_emoji_type": previous_emoji,
            "my_reactions": my_reactions,
            **scores,
        },
    }


# ── 6. Get comments ──────────────────────────────────────────────────────────

@app.get("/community/{shared_outfit_id}/comments")
async def get_comments(
    shared_outfit_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get comments for a shared outfit"""
    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    offset = (page - 1) * limit
    total = db.query(Comment).filter(Comment.shared_outfit_id == shared_outfit_id).count()

    comments = (
        db.query(Comment)
        .filter(Comment.shared_outfit_id == shared_outfit_id)
        .order_by(Comment.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for c in comments:
        commenter_ref = db.query(UserRef).filter(UserRef.id == c.user_id).first()
        user_name = commenter_ref.full_name if commenter_ref else "Unknown"
        user_avatar_url = commenter_ref.avatar_url if commenter_ref else None

        result.append({
            "id": c.id,
            "user": {
                "user_id": c.user_id,
                "name": user_name,
                "avatar_url": user_avatar_url,
                "is_self": c.user_id == user_id,
            },
            "text": c.text,
            "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
        })

    return {
        "success": True,
        "data": result,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total > 0 else 0,
        },
    }


# ── 7. Add comment ───────────────────────────────────────────────────────────

@app.post("/community/{shared_outfit_id}/comments")
@limiter.limit("10/minute")
async def add_comment(
    request: Request,
    shared_outfit_id: str,
    body: CommentRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add a comment to a shared outfit (Gemini-moderated, rate-limited)."""
    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    reply_to_comment = None
    if body.reply_to_comment_id:
        reply_to_comment = db.query(Comment).filter(
            Comment.id == body.reply_to_comment_id,
            Comment.shared_outfit_id == shared_outfit_id,
        ).first()
        if not reply_to_comment:
            return create_error_response("NOT_FOUND", "Reply target comment not found", 404)

    # ── Step 1: Load user ──
    user = db.query(UserRef).filter(UserRef.id == user_id).first()
    if not user:
        return create_error_response("USER_NOT_FOUND", "Kullanıcı bulunamadı.", 404)

    # ── Step 2: Moderation pipeline (regex → Gemini → output validation) ──
    moderation_failed = False
    internal_reason: "str | None" = None
    severity: "str | None" = None
    detection_layer: "str | None" = None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{OUTFIT_SERVICE_URL}/moderate/text",
                json={"text": body.text},
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
            if resp.status_code == 200:
                data = resp.json()
                if not data.get("passed", True):
                    moderation_failed = True
                    internal_reason = data.get("internal_reason") or "Unknown"
                    severity = data.get("severity") or "medium"
                    detection_layer = data.get("layer") or "unknown"
    except Exception as e:
        logger.warning(f"Moderation service unavailable, allowing comment: {e}")

    # ── Step 3: If failed, log the incident and reject the comment ──
    # No strike count, no ban: Gemini has already filtered the harmful text
    # and the rate limiter handles spam abuse. The moderation log is kept as
    # a lightweight audit trail in case the DB needs to be inspected later.
    if moderation_failed:
        log = ModerationLog(
            user_id=user.id,
            action_type="comment",
            content_preview=body.text[:200],
            internal_reason=internal_reason,
            severity=severity,
            detection_layer=detection_layer,
            strike_number=0,
            punishment="warning",
        )
        db.add(log)
        db.commit()

        logger.warning(
            f"Comment moderation: user={user.id}, reason={internal_reason}"
        )

        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "COMMENT_REJECTED",
                    "message": "Yorumunuz topluluk kurallarına aykırı bulundu.",
                },
            },
        )

    # ── Step 4: Save comment ──
    comment = Comment(
        shared_outfit_id=shared_outfit_id,
        user_id=user_id,
        text=body.text,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    notified_recipient_ids: set[str] = set()

    # Create notification for explicit comment replies (skip self).
    if reply_to_comment and reply_to_comment.user_id != user_id:
        db.add(Notification(
            recipient_user_id=reply_to_comment.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="reply",
            detail=body.text[:50],
        ))
        notified_recipient_ids.add(reply_to_comment.user_id)

    # Create notification for comment (skip self)
    if shared.user_id != user_id and shared.user_id not in notified_recipient_ids:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="comment",
            detail=body.text[:50],
        ))
        notified_recipient_ids.add(shared.user_id)

    # Detect @mentions and notify mentioned users.
    #
    # The previous regex captured up to the first whitespace, so multi-word
    # names (e.g. "Onurcan Genç", "Mirac Uzan") never matched the DB row and
    # the mentioned user got no notification. Match against actual user names
    # instead: pull the candidate set, then for each user check if
    # "@{full_name}" appears in the comment (case-insensitive). This handles
    # spaces, accented characters, and avoids regex false-negatives entirely.
    candidate_users = (
        db.query(UserRef)
        .filter(
            UserRef.id != user_id,
            UserRef.full_name.isnot(None),
            UserRef.full_name != "",
        )
        .all()
    )
    # Longest-name first so "@Onurcan Genç" is matched and consumed before the
    # "@Onurcan" prefix would otherwise hit and trigger a duplicate notify.
    candidate_users.sort(key=lambda u: -len(u.full_name or ""))
    working_text = body.text.lower()
    mentioned_ids: set[str] = set(notified_recipient_ids)
    for candidate in candidate_users:
        token = f"@{candidate.full_name}".lower()
        if token and token in working_text and candidate.id not in mentioned_ids:
            mentioned_ids.add(candidate.id)
            working_text = working_text.replace(token, " ")  # consume
            db.add(Notification(
                recipient_user_id=candidate.id,
                actor_user_id=user_id,
                shared_outfit_id=shared_outfit_id,
                type="reply",
                detail=body.text[:50],
            ))
    db.commit()

    logger.info(f"User {user_id} commented on shared outfit {shared_outfit_id}")
    return {
        "success": True,
        "data": {
            "id": comment.id,
            "text": comment.text,
            "created_at": comment.created_at.isoformat() + "Z" if comment.created_at else None,
        },
    }


# ── 8. Delete comment ────────────────────────────────────────────────────────

@app.delete("/community/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete a comment (only by its author)"""
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.user_id == user_id,
    ).first()

    if not comment:
        return create_error_response("NOT_FOUND", "Comment not found or not yours", 404)

    db.delete(comment)
    db.commit()

    logger.info(f"Comment {comment_id} deleted by user {user_id}")
    return {"success": True, "message": "Comment deleted successfully"}


# ============== PRIVILEGED ENDPOINTS ==============
# Gated by X-API-Key matching INTERNAL_API_KEY. No human "admin" role —
# whoever holds the key can execute. Intended for manual operator use
# (curl / Railway CLI) and not exposed via normal frontend flows.

@app.post("/admin/users/{target_user_id}/reset-strikes")
async def reset_user_strikes(
    target_user_id: str,
    _: str = Depends(require_internal_key),
    db: Session = Depends(get_db),
):
    """Reset strike count and lift any active or permanent ban."""
    user = db.query(UserRef).filter(UserRef.id == target_user_id).first()
    if not user:
        return create_error_response("USER_NOT_FOUND", "Kullanıcı bulunamadı.", 404)

    user.comment_strike_count = 0
    user.comment_banned_until = None
    user.comment_ban_permanent = False
    db.commit()

    logger.info(f"Internal call: reset strikes for user {target_user_id}")
    return {"success": True, "message": f"Strike'lar sıfırlandı: {target_user_id}"}


@app.get("/admin/moderation-logs")
async def get_moderation_logs(
    _: str = Depends(require_internal_key),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """View moderation logs (most recent first)."""
    logs = (
        db.query(ModerationLog)
        .order_by(ModerationLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action_type": log.action_type,
                "content_preview": log.content_preview,
                "internal_reason": log.internal_reason,
                "severity": log.severity,
                "detection_layer": log.detection_layer,
                "strike_number": log.strike_number,
                "punishment": log.punishment,
                "created_at": log.created_at.isoformat() + "Z" if log.created_at else None,
            }
            for log in logs
        ],
    }
