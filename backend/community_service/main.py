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
from datetime import datetime
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


# ============== CONFIGURATION ==============

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/closetmate")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============== DATABASE ==============

engine = create_engine(DATABASE_URL)
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
        UniqueConstraint("shared_outfit_id", "user_id", "emoji_type", name="uq_reaction_user_emoji"),
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


# Only create community tables — never touch outfit tables
SharedOutfit.__table__.create(bind=engine, checkfirst=True)
Rating.__table__.create(bind=engine, checkfirst=True)
Reaction.__table__.create(bind=engine, checkfirst=True)
Comment.__table__.create(bind=engine, checkfirst=True)
Notification.__table__.create(bind=engine, checkfirst=True)
CommunityFavorite.__table__.create(bind=engine, checkfirst=True)


# ============== CONSTANTS ==============

VALID_EMOJI_TYPES = ["like", "love", "fire", "cool", "wow"]


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

    @validator("text")
    def text_not_blank(cls, v):
        if not v.strip():
            raise ValueError("Comment cannot be empty or whitespace only")
        return v.strip()


# ============== APP ==============

app = FastAPI(title="ClosetMate Community Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    """Search users by name for @mention autocomplete"""
    query = db.query(UserRef).filter(UserRef.id != user_id)
    if q.strip():
        query = query.filter(UserRef.full_name.ilike(f"%{q}%"))
    users = query.limit(5).all()

    return {
        "success": True,
        "data": [
            {"user_id": u.id, "name": u.full_name}
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
    db.commit()
    db.refresh(shared)

    # Update is_shareable on outfit via outfit_service internal endpoint
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.put(
                f"{OUTFIT_SERVICE_URL}/outfits/{body.outfit_id}/shareable",
                json={"is_shareable": True},
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
    except Exception as e:
        logger.warning(f"Could not update is_shareable flag: {e}")

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
    db.delete(shared)
    db.commit()

    # Update is_shareable flag
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.put(
                f"{OUTFIT_SERVICE_URL}/outfits/{outfit_id}/shareable",
                json={"is_shareable": False},
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
    except Exception as e:
        logger.warning(f"Could not update is_shareable flag: {e}")

    logger.info(f"Shared outfit {shared_outfit_id} removed by user {user_id}")
    return {"success": True, "message": "Outfit unshared successfully"}


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

    result = db.execute(
        sa_text("SELECT full_name FROM users WHERE id = :uid"),
        {"uid": shared.user_id},
    ).fetchone()
    user_name = result[0] if result else "Unknown"

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
            "is_self": shared.user_id == user_id,
        },
        "description": shared.description,
        "shared_at": shared.shared_at.isoformat() + "Z" if shared.shared_at else None,
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
    }


# ── 3. Community feed ────────────────────────────────────────────────────────

@app.get("/community/feed")
async def get_community_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get the community feed with shared outfits"""
    offset = (page - 1) * limit

    total = db.query(SharedOutfit).count()
    shared_outfits = (
        db.query(SharedOutfit)
        .order_by(SharedOutfit.shared_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    feed = []
    for shared in shared_outfits:
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


# ── 3b. Top Rated ────────────────────────────────────────────────────────────

@app.get("/community/top-rated")
async def get_top_rated(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get top-rated shared outfits (avg rating >= 4.0, at least 1 rating)"""
    offset = (page - 1) * limit

    # Subquery: shared_outfit_ids with avg >= 4.0 and at least 1 rating
    top_ids_q = (
        db.query(
            Rating.shared_outfit_id,
            func.avg(Rating.score).label("avg_score"),
        )
        .group_by(Rating.shared_outfit_id)
        .having(func.avg(Rating.score) >= 4.0)
        .having(func.count(Rating.id) >= 1)
        .subquery()
    )

    total = db.query(func.count()).select_from(top_ids_q).scalar()

    top_rows = (
        db.query(SharedOutfit, top_ids_q.c.avg_score)
        .join(top_ids_q, SharedOutfit.id == top_ids_q.c.shared_outfit_id)
        .order_by(top_ids_q.c.avg_score.desc(), SharedOutfit.shared_at.desc())
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

    total = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
    ).count()

    unread_count = db.query(Notification).filter(
        Notification.recipient_user_id == user_id,
        Notification.is_read == False,
    ).count()

    notifications = (
        db.query(Notification)
        .filter(Notification.recipient_user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for n in notifications:
        # Resolve actor name
        actor_row = db.execute(
            sa_text("SELECT full_name FROM users WHERE id = :uid"),
            {"uid": n.actor_user_id},
        ).fetchone()
        actor_name = actor_row[0] if actor_row else "Someone"

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
            "actor": {"user_id": n.actor_user_id, "name": actor_name},
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

    # Calculate fresh average and count
    avg_rating = db.query(func.avg(Rating.score)).filter(
        Rating.shared_outfit_id == shared_outfit_id,
    ).scalar()
    rating_count = db.query(Rating).filter(
        Rating.shared_outfit_id == shared_outfit_id,
    ).count()

    logger.info(f"User {user_id} rated shared outfit {shared_outfit_id}: {body.score}/5")
    return {
        "success": True,
        "data": {
            "score": body.score,
            "average": round(float(avg_rating), 1) if avg_rating else body.score,
            "count": rating_count,
        }
    }


# ── 5. React with emoji ──────────────────────────────────────────────────────

@app.post("/community/{shared_outfit_id}/react")
async def react_to_outfit(
    shared_outfit_id: str,
    body: ReactRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Toggle an emoji reaction on a shared outfit"""
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

    # Toggle: if exists remove, else add
    existing = db.query(Reaction).filter(
        Reaction.shared_outfit_id == shared_outfit_id,
        Reaction.user_id == user_id,
        Reaction.emoji_type == body.emoji_type,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"success": True, "data": {"action": "removed", "emoji_type": body.emoji_type}}

    reaction = Reaction(
        shared_outfit_id=shared_outfit_id,
        user_id=user_id,
        emoji_type=body.emoji_type,
    )
    db.add(reaction)
    db.commit()

    # Create notification for reaction (skip self)
    if shared.user_id != user_id:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="reaction",
            detail=body.emoji_type,
        ))
        db.commit()

    return {"success": True, "data": {"action": "added", "emoji_type": body.emoji_type}}


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
        # TODO: Replace raw SQL with internal API call to wardrobe_service /users/{id} endpoint
        user_result = db.execute(
            sa_text("SELECT full_name FROM users WHERE id = :uid"),
            {"uid": c.user_id},
        ).fetchone()
        user_name = user_result[0] if user_result else "Unknown"

        result.append({
            "id": c.id,
            "user": {
                "user_id": c.user_id,
                "name": user_name,
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
async def add_comment(
    shared_outfit_id: str,
    body: CommentRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Add a comment to a shared outfit"""
    shared = db.query(SharedOutfit).filter(SharedOutfit.id == shared_outfit_id).first()
    if not shared:
        return create_error_response("NOT_FOUND", "Shared outfit not found", 404)

    comment = Comment(
        shared_outfit_id=shared_outfit_id,
        user_id=user_id,
        text=body.text,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Create notification for comment (skip self)
    if shared.user_id != user_id:
        db.add(Notification(
            recipient_user_id=shared.user_id,
            actor_user_id=user_id,
            shared_outfit_id=shared_outfit_id,
            type="comment",
            detail=body.text[:50],
        ))
        db.commit()

    # Detect @mentions and notify mentioned users
    import re
    mentions = re.findall(r'@([A-Za-zğüşıöçĞÜŞİÖÇ\s]+?)(?:\s|$|[,.])', body.text)
    for mention_name in mentions:
        mention_name = mention_name.strip()
        if not mention_name:
            continue
        mentioned_user = db.execute(
            sa_text("SELECT id FROM users WHERE LOWER(full_name) = LOWER(:name)"),
            {"name": mention_name},
        ).fetchone()
        if mentioned_user and mentioned_user[0] != user_id:
            db.add(Notification(
                recipient_user_id=mentioned_user[0],
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
