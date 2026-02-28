"""
Community Service - Social features for outfit sharing, ratings, reactions, comments
Port: 3004

Endpoints:
  POST   /community/share                        - Share an outfit
  DELETE /community/{shared_outfit_id}            - Unshare an outfit
  GET    /community/feed                          - Community feed
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

from fastapi import FastAPI, Depends, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from sqlalchemy import (
    create_engine, Column, String, Integer, Text, DateTime,
    Boolean, Float, UniqueConstraint, text as sa_text,
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


# Only create community tables — never touch outfit tables
SharedOutfit.__table__.create(bind=engine, checkfirst=True)
Rating.__table__.create(bind=engine, checkfirst=True)
Reaction.__table__.create(bind=engine, checkfirst=True)
Comment.__table__.create(bind=engine, checkfirst=True)


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
    text: str = Field(..., min_length=1, max_length=1000)


# ============== APP ==============

app = FastAPI(title="ClosetMate Community Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== HEALTH ==============

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "community", "port": 3004}


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
        # Get outfit details
        outfit = db.query(OutfitRef).filter(OutfitRef.id == shared.outfit_id).first()
        if not outfit:
            continue

        # Get outfit item IDs
        outfit_items = (
            db.query(OutfitItemRef)
            .filter(OutfitItemRef.outfit_id == shared.outfit_id)
            .order_by(OutfitItemRef.position)
            .all()
        )

        # Get user's display name
        # TODO: Replace raw SQL with internal API call to wardrobe_service /users/{id} endpoint
        result = db.execute(
            sa_text("SELECT full_name FROM users WHERE id = :uid"),
            {"uid": shared.user_id},
        ).fetchone()
        user_name = result[0] if result else "Unknown"

        # Aggregate ratings
        from sqlalchemy import func
        avg_rating = db.query(func.avg(Rating.score)).filter(
            Rating.shared_outfit_id == shared.id,
        ).scalar()
        rating_count = db.query(Rating).filter(
            Rating.shared_outfit_id == shared.id,
        ).count()

        # Get user's own rating
        user_rating = db.query(Rating).filter(
            Rating.shared_outfit_id == shared.id,
            Rating.user_id == user_id,
        ).first()

        # Aggregate reactions
        reactions = (
            db.query(Reaction.emoji_type, func.count(Reaction.id))
            .filter(Reaction.shared_outfit_id == shared.id)
            .group_by(Reaction.emoji_type)
            .all()
        )
        reaction_counts = {emoji: count for emoji, count in reactions}

        # User's own reactions
        user_reactions = (
            db.query(Reaction.emoji_type)
            .filter(
                Reaction.shared_outfit_id == shared.id,
                Reaction.user_id == user_id,
            )
            .all()
        )
        user_reaction_types = [r[0] for r in user_reactions]

        # Comment count
        comment_count = db.query(Comment).filter(
            Comment.shared_outfit_id == shared.id,
        ).count()

        feed.append({
            "id": shared.id,
            "outfit": {
                "id": outfit.id,
                "name": outfit.name,
                "style": outfit.style,
                "occasion": outfit.occasion,
                "season": outfit.season,
                "cohesion_score": outfit.cohesion_score,
                "reasoning": outfit.reasoning,
                "item_ids": [oi.item_id for oi in outfit_items],
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
        })

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

    logger.info(f"User {user_id} rated shared outfit {shared_outfit_id}: {body.score}/5")
    return {"success": True, "data": {"score": body.score}}


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
