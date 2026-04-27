"""
Outfit Service: AI-powered clothing analysis and outfit generation
Integrates with Gemini for image analysis and outfit recommendations

Endpoints:
  POST /analyze           - Analyze a clothing image (called by wardrobe service after upload)
  POST /outfits/generate  - Generate outfit combinations from user's wardrobe
  GET  /outfits           - Get user's saved outfits
  GET  /outfits/{id}      - Get a single outfit
  POST /outfits/save      - Save a generated outfit
  DELETE /outfits/{id}    - Delete a saved outfit
  GET  /health            - Health check
"""
import os
import uuid
import base64
import logging
from datetime import datetime
from typing import Optional, List, Literal

from fastapi import FastAPI, Depends, HTTPException, Header, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from sqlalchemy import (
    create_engine, Column, String, Integer, Text, DateTime,
    Boolean, ForeignKey, JSON as SQLAlchemyJSON, text as sa_text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

import jwt
import httpx

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from gemini_analyzer import (
    analyzer,
    VALID_CATEGORIES,
    VALID_STYLES,
    VALID_OCCASIONS,
    ContentModerationError,
)

# ============== FILTER MAPS ==============

# Maps frontend occasion values → allowed formality_level range
# Items outside this range are excluded before being sent to Gemini
OCCASION_FORMALITY_MAP = {
    "gym":          [1],
    "beach":        [1],
    "lounging":     [1, 2],
    "everyday":     [1, 2, 3],
    "outdoor":      [1, 2, 3],
    "travel":       [1, 2, 3],
    "party":        [2, 3, 4],
    "date-night":   [3, 4, 5],
    "work":         [3, 4],
    "wedding":      [3, 4, 5],
    "formal-event": [3, 4, 5],
}

async def fetch_image_bytes(image_url: str) -> tuple[bytes, str]:
    """
    Fetch image bytes from either:
    - HTTP/HTTPS URL  → httpx GET
    - data: URL       → base64 decode directly (Railway ephemeral storage workaround)
    
    Returns (image_bytes, content_type)
    """
    if image_url.startswith("data:"):
        # data:image/png;base64,<b64data>
        header, b64data = image_url.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "")
        image_bytes = base64.b64decode(b64data)
        return image_bytes, content_type
    else:
        async with httpx.AsyncClient(timeout=30.0) as client:
            img_response = await client.get(image_url)
            if img_response.status_code != 200:
                raise ValueError(f"Could not fetch image from {image_url} (status {img_response.status_code})")
            content_type = img_response.headers.get("content-type", "")
            # Static file servers may return wrong MIME for .webp — infer from URL
            if not content_type.startswith("image/"):
                ext = image_url.rsplit(".", 1)[-1].lower() if "." in image_url else ""
                mime_map = {"webp": "image/webp", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}
                content_type = mime_map.get(ext, "image/png")
            return img_response.content, content_type

# ============== CONFIGURATION ==============

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
COMMUNITY_SERVICE_URL = os.getenv("COMMUNITY_SERVICE_URL", "http://localhost:3004")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")  # For service-to-service auth

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY environment variable is required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== DATABASE ==============

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ClothingAttribute(Base):
    """
    Stores Gemini-analyzed attributes for each clothing item.
    One-to-one relationship with clothing_items table (via item_id).
    """
    __tablename__ = "clothing_attributes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)

    # Core attributes from Gemini
    name = Column(String(60), nullable=True)                # AI-generated display name
    category = Column(String(50), nullable=False)          # top, bottom, outerwear, etc.
    subcategory = Column(String(50), nullable=False)        # t-shirt, jeans, blazer, etc.
    color_primary = Column(String(30), nullable=False)
    color_secondary = Column(String(30), nullable=True)
    pattern = Column(String(30), default="solid")
    material = Column(String(30), default="unknown")
    style = Column(String(30), default="casual")
    fit = Column(String(30), default="regular")
    formality_level = Column(Integer, default=2)            # 1-5

    # JSON arrays stored as text
    weather_suitability = Column(SQLAlchemyJSON, default=list)  # ["mild", "cool"]
    seasons = Column(SQLAlchemyJSON, default=list)              # ["Spring", "Fall"]
    suitable_occasions = Column(SQLAlchemyJSON, default=list)   # ["everyday", "work"]

    # AI-generated description
    description = Column(Text, nullable=True)

    # Metadata
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    analysis_version = Column(String(20), default="1.0")

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "name": self.name,
            "category": self.category,
            "subcategory": self.subcategory,
            "color_primary": self.color_primary,
            "color_secondary": self.color_secondary,
            "pattern": self.pattern,
            "material": self.material,
            "style": self.style,
            "fit": self.fit,
            "formality_level": self.formality_level,
            "weather_suitability": self.weather_suitability or [],
            "seasons": self.seasons or [],
            "suitable_occasions": self.suitable_occasions or [],
            "description": self.description,
            "analyzed_at": self.analyzed_at.isoformat() + "Z" if self.analyzed_at else None,
        }


class Outfit(Base):
    """Saved outfit combinations"""
    __tablename__ = "outfits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    style = Column(String(30), nullable=True)
    occasion = Column(String(30), nullable=True)
    season = Column(String(20), nullable=True)
    cohesion_score = Column(Integer, nullable=True)
    reasoning = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=False)
    is_shareable = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    outfit_items = relationship("OutfitItem", back_populates="outfit", cascade="all, delete-orphan")

    def to_dict(self, include_items=True):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "style": self.style,
            "occasion": self.occasion,
            "season": self.season,
            "cohesion_score": self.cohesion_score,
            "reasoning": self.reasoning,
            "is_favorite": self.is_favorite,
            "is_shareable": self.is_shareable,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
        if include_items:
            data["item_ids"] = [oi.item_id for oi in self.outfit_items]
        return data


class OutfitItem(Base):
    """Junction table linking outfits to clothing items"""
    __tablename__ = "outfit_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    outfit_id = Column(String, ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String, nullable=False, index=True)
    position = Column(Integer, default=0)  # Ordering within outfit

    outfit = relationship("Outfit", back_populates="outfit_items")


# Create tables
Base.metadata.create_all(bind=engine)

# Auto-migrate: add seasons column if missing
with engine.connect() as conn:
    try:
        conn.execute(sa_text("ALTER TABLE clothing_attributes ADD COLUMN seasons JSON DEFAULT '[]'"))
        conn.commit()
        logger.info("Migration: added seasons column to clothing_attributes")
    except Exception:
        conn.rollback()


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
    """Extract user_id from JWT - lightweight, no DB call needed"""
    payload = decode_token(credentials.credentials)
    return payload["user_id"]


def create_error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}}
    )


def verify_internal_request(api_key: Optional[str]) -> bool:
    """Verify service-to-service requests using shared API key.
    Strict: if INTERNAL_API_KEY is not configured, reject all internal calls."""
    if not INTERNAL_API_KEY or not api_key:
        return False
    return api_key == INTERNAL_API_KEY


# ============== REQUEST MODELS ==============

class AnalyzeRequest(BaseModel):
    item_id: str
    user_id: str
    image_url: str
    x_api_key: Optional[str] = None

class ReanalyzeRequest(BaseModel):
    image_url: str

AllowedOccasion = Literal[
    "everyday", "work", "formal-event", "date-night", "party",
    "outdoor", "gym", "beach", "travel", "lounging", "wedding",
]

AllowedStyle = Literal[
    "any", "casual", "formal", "business-casual", "smart-casual",
    "sporty", "streetwear", "bohemian", "minimalist", "preppy",
    "vintage", "classic", "athleisure",
]

AllowedSeason = Literal["all", "spring", "summer", "fall", "winter"]


class GenerateOutfitsRequest(BaseModel):
    count: int = Field(default=3, ge=1, le=10)
    occasion: AllowedOccasion = "everyday"
    style: AllowedStyle = "any"
    season: AllowedSeason = "all"

class SaveOutfitRequest(BaseModel):
    name: str
    item_ids: List[str]
    style: Optional[str] = None
    occasion: Optional[str] = None
    season: Optional[str] = None
    cohesion_score: Optional[int] = None
    reasoning: Optional[str] = None


# ============== APP ==============

app = FastAPI(
    title="ClosetMate Outfit Service",
    description="AI-powered clothing analysis and outfit generation",
    version="1.0.0",
    # Internal service — no public docs
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Rate limiting — Gemini calls are expensive. We key on the authenticated
# user instead of IP so a VPN/proxy cannot be used to multiply the quota.
# Unauthenticated callers (shouldn't happen on /outfits/generate) fall back
# to IP so slowapi always has a non-None key.
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


# ============== HEALTH ==============

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(sa_text("SELECT 1"))
        return {"status": "healthy", "service": "outfit", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "service": "outfit", "database": "disconnected", "error": str(e)}
        )



# ============== TEXT MODERATION ==============

@app.post("/moderate/text")
async def moderate_text_endpoint(
    request: Request,
    x_api_key: Optional[str] = Header(None),
):
    """
    Moderate user-submitted text content. Called by Community Service
    before saving comments. Returns {passed, internal_reason, severity}.
    Requires X-API-Key matching INTERNAL_API_KEY.
    """
    if not verify_internal_request(x_api_key):
        return create_error_response("UNAUTHORIZED", "Invalid API key", 401)

    try:
        body = await request.json()
    except Exception:
        return create_error_response("INVALID_BODY", "Invalid JSON body", 400)

    text = (body.get("text") or "").strip()
    if not text:
        return {"success": True, "passed": True, "internal_reason": None, "severity": None, "layer": None}

    # Hard cap to keep prompts cheap
    if len(text) > 2000:
        text = text[:2000]

    result = await analyzer.moderate_text(text)
    return {
        "success": True,
        "passed": result["passed"],
        "internal_reason": result.get("internal_reason"),
        "severity": result.get("severity"),
        "layer": result.get("layer"),
    }


# ============== IMAGE MODERATION (PRE-BG-REMOVAL) ==============

@app.post("/moderate/image")
async def moderate_image_endpoint(
    image: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None),
):
    """Lightweight Gemini-based domain check on a RAW upload.

    Called by image_processing_service BEFORE BiRefNet runs, so we can
    short-circuit obvious off-topic uploads (selfies, food, screenshots,
    random objects) without spending 3-8 seconds on background removal.

    Returns: {success, passed, rejection_reason}.
    Fails OPEN on any Gemini error so transient hiccups never block a
    legitimate upload — a fuller second-pass moderation still runs after
    bg-removal in /analyze.
    """
    if not verify_internal_request(x_api_key):
        return create_error_response("UNAUTHORIZED", "Invalid API key", 401)

    content = await image.read()
    if not content:
        return create_error_response("EMPTY_IMAGE", "Empty image upload", 400)

    mime_type = image.content_type or "image/png"
    if not mime_type.startswith("image/"):
        mime_type = "image/png"

    try:
        result = await analyzer.moderate_image(content, mime_type)
    except Exception as e:
        logger.warning(f"Image moderation endpoint failed open: {e}")
        return {"success": True, "passed": True, "rejection_reason": None}

    return {
        "success": True,
        "passed": result.get("passed", True),
        "rejection_reason": result.get("rejection_reason"),
    }


# ============== CLOTHING ANALYSIS ==============

@app.post("/analyze")
async def analyze_clothing_item(
    body: AnalyzeRequest,
    db: Session = Depends(get_db)
):
    """
    Analyze a clothing item image using Gemini.
    Called internally by the wardrobe service after image upload.
    
    JSON body:
    {
        "item_id": "...",
        "user_id": "...",
        "image_url": "data:image/png;base64,...",
        "x_api_key": "..." (optional)
    }
    """
    # Verify internal request
    if not verify_internal_request(body.x_api_key):
        return create_error_response("UNAUTHORIZED", "Invalid API key", 401)

    # "pending" sentinel = pre-save moderation pass; skip DB cache lookup + write
    is_pending = body.item_id == "pending"

    # Check if already analyzed (skip for pending)
    if not is_pending:
        existing = db.query(ClothingAttribute).filter(
            ClothingAttribute.item_id == body.item_id
        ).first()

        if existing:
            return {"success": True, "data": existing.to_dict(), "cached": True}

    # Download the processed image (supports both HTTP URLs and data: URLs)
    try:
        image_bytes, content_type = await fetch_image_bytes(body.image_url)
    except ValueError as e:
        return create_error_response("IMAGE_FETCH_FAILED", str(e), 502)
    except httpx.RequestError as e:
        return create_error_response("IMAGE_FETCH_FAILED", f"Image service unreachable: {str(e)}", 503)

    # Analyze with Gemini (also performs content moderation)
    try:
        attributes = await analyzer.analyze_clothing(image_bytes, content_type)
    except ContentModerationError as e:
        logger.warning(f"Moderation rejected item {body.item_id}: {e.internal_reason}")
        return create_error_response("MODERATION_REJECTED", e.user_message, 400)
    except ValueError as e:
        logger.error(f"Gemini analysis validation failed for item {body.item_id}: {e}")
        return create_error_response("ANALYSIS_FAILED", str(e), 500)
    except Exception as e:
        logger.error(f"Gemini API error for item {body.item_id}: {e}")
        return create_error_response("ANALYSIS_FAILED", f"AI analysis failed: {str(e)}", 500)

    # Pending mode: return analysis without persisting (caller will create the item)
    if is_pending:
        return {"success": True, "data": attributes, "cached": False, "pending": True}

    # Store attributes in database
    clothing_attr = ClothingAttribute(
        id=str(uuid.uuid4()),
        item_id=body.item_id,
        user_id=body.user_id,
        name=attributes.get("name"),
        category=attributes["category"],
        subcategory=attributes["subcategory"],
        color_primary=attributes["color_primary"],
        color_secondary=attributes["color_secondary"],
        pattern=attributes["pattern"],
        material=attributes["material"],
        style=attributes["style"],
        fit=attributes["fit"],
        formality_level=attributes["formality_level"],
        weather_suitability=attributes["weather_suitability"],
        seasons=attributes.get("seasons", ["Spring", "Fall"]),
        suitable_occasions=attributes["suitable_occasions"],
        description=attributes["description"],
    )

    db.add(clothing_attr)
    db.commit()
    db.refresh(clothing_attr)

    return {"success": True, "data": clothing_attr.to_dict(), "cached": False}


@app.get("/analyze/{item_id}")
async def get_clothing_attributes(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get the analyzed attributes for a specific clothing item"""
    attr = db.query(ClothingAttribute).filter(
        ClothingAttribute.item_id == item_id,
        ClothingAttribute.user_id == user_id
    ).first()

    if not attr:
        return create_error_response("NOT_FOUND", "No analysis found for this item", 404)

    return {"success": True, "data": attr.to_dict()}


@app.post("/analyze/{item_id}/reanalyze")
async def reanalyze_clothing_item(
    item_id: str,
    body: ReanalyzeRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Force re-analysis of a clothing item (user-triggered)"""
    # Delete existing analysis
    db.query(ClothingAttribute).filter(
        ClothingAttribute.item_id == item_id,
        ClothingAttribute.user_id == user_id
    ).delete()
    db.commit()

    # Download image (supports both HTTP URLs and data: URLs)
    try:
        image_bytes, content_type = await fetch_image_bytes(body.image_url)
    except ValueError as e:
        return create_error_response("IMAGE_FETCH_FAILED", str(e), 502)
    except httpx.RequestError as e:
        return create_error_response("IMAGE_FETCH_FAILED", str(e), 503)

    # Re-analyze (with moderation gate)
    try:
        attributes = await analyzer.analyze_clothing(image_bytes, content_type)
    except ContentModerationError as e:
        logger.warning(f"Moderation rejected reanalyze for item {item_id}: {e.internal_reason}")
        return create_error_response("MODERATION_REJECTED", e.user_message, 400)
    except Exception as e:
        return create_error_response("ANALYSIS_FAILED", str(e), 500)

    # Store new attributes
    clothing_attr = ClothingAttribute(
        id=str(uuid.uuid4()),
        item_id=item_id,
        user_id=user_id,
        name=attributes.get("name"),
        category=attributes["category"],
        subcategory=attributes["subcategory"],
        color_primary=attributes["color_primary"],
        color_secondary=attributes["color_secondary"],
        pattern=attributes["pattern"],
        material=attributes["material"],
        style=attributes["style"],
        fit=attributes["fit"],
        formality_level=attributes["formality_level"],
        weather_suitability=attributes["weather_suitability"],
        seasons=attributes.get("seasons", ["Spring", "Fall"]),
        suitable_occasions=attributes["suitable_occasions"],
        description=attributes["description"],
    )

    db.add(clothing_attr)
    db.commit()
    db.refresh(clothing_attr)

    return {"success": True, "data": clothing_attr.to_dict(), "reanalyzed": True}


@app.delete("/analyze/{item_id}")
async def delete_clothing_attributes(
    item_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete analyzed attributes for a clothing item (called when item is deleted)"""
    deleted = db.query(ClothingAttribute).filter(
        ClothingAttribute.item_id == item_id,
        ClothingAttribute.user_id == user_id
    ).delete()
    db.commit()

    # Also remove this item from any saved outfits
    outfit_items = db.query(OutfitItem).filter(OutfitItem.item_id == item_id).all()
    orphaned_outfit_ids = {oi.outfit_id for oi in outfit_items}
    for oi in outfit_items:
        db.delete(oi)
    db.commit()

    # Delete outfits that now have fewer than 2 items
    for outfit_id in orphaned_outfit_ids:
        remaining = db.query(OutfitItem).filter(OutfitItem.outfit_id == outfit_id).count()
        if remaining < 2:
            db.query(Outfit).filter(Outfit.id == outfit_id).delete()
    db.commit()

    return {
        "success": True,
        "message": f"Attributes deleted for item {item_id}",
        "attributes_deleted": deleted
    }


# ============== OUTFIT GENERATION ==============

@app.post("/outfits/generate")
@limiter.limit("20/hour")
async def generate_outfits(
    request: Request,
    body: GenerateOutfitsRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate outfit combinations using Gemini AI.
    Reads the user's analyzed wardrobe items and creates matching outfits.

    JSON body:
    {
        "count": 3,
        "occasion": "everyday",
        "style": "any"
    }
    """
    # ── Step 1: Base query — only this user's items ──────────────────────────
    query = db.query(ClothingAttribute).filter(
        ClothingAttribute.user_id == user_id
    )
    attributes = query.all()

    # ── Step 2: Occasion → formality pre-filter ──────────────────────────────
    occasion_lower = (body.occasion or "everyday").lower()
    allowed_formality = OCCASION_FORMALITY_MAP.get(occasion_lower)  # None means no restriction
    if allowed_formality is not None:
        attributes = [a for a in attributes if a.formality_level in allowed_formality]

    # Filter out sports jerseys for non-sport occasions
    if occasion_lower not in ("gym", "outdoor", "lounging"):
        attributes = [a for a in attributes if a.subcategory != "jersey"]

    # ── Step 3: Guard — need at least 2 items after filtering ────────────────
    if len(attributes) < 2:
        # Determine why there aren't enough items for a helpful message
        total_items = db.query(ClothingAttribute).filter(
            ClothingAttribute.user_id == user_id
        ).count()

        if total_items < 2:
            detail = (
                f"You need at least 2 analyzed items to generate outfits. "
                f"You have {total_items}."
            )
        else:
            detail = (
                f"Not enough items in your wardrobe match the selected filters "
                f"(occasion: '{body.occasion}'). "
                f"Try adding more appropriate clothing or changing the filters."
            )
        return create_error_response("INSUFFICIENT_ITEMS", detail, 400)

    # ── Step 4: Build slim wardrobe payload for Gemini ──────────────────────
    # Only send fields Gemini needs — avoids bloating the prompt with
    # analyzed_at, description etc.
    wardrobe_items = [
        {
            "id": attr.item_id,
            "category": attr.category,
            "subcategory": attr.subcategory,
            "color_primary": attr.color_primary,
            "color_secondary": attr.color_secondary,
            "pattern": attr.pattern,
            "style": attr.style,
            "formality_level": attr.formality_level,
            "weather_suitability": attr.weather_suitability or ["mild"],
        }
        for attr in attributes
    ]
    count = max(1, min(body.count, 10))

    logger.info(
        f"Outfit generation: {len(wardrobe_items)} items passed to Gemini "
        f"(occasion={body.occasion}, style={body.style})"
    )

    try:
        result = await analyzer.generate_outfits(
            wardrobe_items=wardrobe_items,
            count=count,
            occasion=body.occasion,
            style=body.style,
        )
    except ValueError as e:
        return create_error_response("GENERATION_FAILED", str(e), 400)
    except Exception as e:
        logger.error(f"Outfit generation failed: {e}")
        return create_error_response("GENERATION_FAILED", f"AI outfit generation failed: {str(e)}", 500)

    # ── Step 5: Enrich outfits with full item details ────────────────────────
    attr_map = {a.item_id: a.to_dict() for a in attributes}
    enriched_outfits = []
    for outfit in result["outfits"]:
        # Backward-compat flat items list
        outfit["items"] = [attr_map[iid] for iid in outfit["item_ids"] if iid in attr_map]
        # Enrich required / optional entries with full item data
        for entry in outfit.get("required", []):
            entry["item"] = attr_map.get(entry["id"])
        for entry in outfit.get("optional", []):
            entry["item"] = attr_map.get(entry["id"])
        enriched_outfits.append(outfit)

    if not enriched_outfits:
        return create_error_response(
            "NO_VALID_OUTFITS",
            "AI couldn't generate valid outfits with your current wardrobe. Try different filters or add more items.",
            422
        )

    return {
        "success": True,
        "data": {
            "outfits": enriched_outfits,
            "total_items_analyzed": len(attributes),
        }
    }


# ============== SAVED OUTFITS CRUD ==============

@app.post("/outfits/save")
async def save_outfit(
    body: SaveOutfitRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Save a generated outfit to the user's collection.
    
    JSON body:
    {
        "name": "My Casual Outfit",
        "item_ids": ["id1", "id2", "id3"],
        "style": "casual",
        "occasion": "everyday",
        "season": "spring",
        "cohesion_score": 8,
        "reasoning": "Great color combination"
    }
    """
    if len(body.item_ids) < 2:
        return create_error_response("INVALID_INPUT", "An outfit must have at least 2 items", 400)

    # Verify all items belong to this user
    user_items = db.query(ClothingAttribute).filter(
        ClothingAttribute.user_id == user_id,
        ClothingAttribute.item_id.in_(body.item_ids)
    ).all()

    valid_ids = {a.item_id for a in user_items}
    invalid_ids = [iid for iid in body.item_ids if iid not in valid_ids]

    if invalid_ids:
        return create_error_response(
            "INVALID_ITEMS",
            f"Items not found in your wardrobe: {', '.join(invalid_ids)}",
            400
        )

    # Create outfit
    outfit = Outfit(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=body.name[:100],
        style=body.style[:30] if body.style else None,
        occasion=body.occasion[:30] if body.occasion else None,
        season=body.season[:20] if body.season else None,
        cohesion_score=max(1, min(10, body.cohesion_score)) if body.cohesion_score else None,
        reasoning=body.reasoning[:1000] if body.reasoning else None,
    )
    db.add(outfit)
    db.flush()

    # Add outfit items with order
    for position, item_id in enumerate(body.item_ids):
        outfit_item = OutfitItem(
            id=str(uuid.uuid4()),
            outfit_id=outfit.id,
            item_id=item_id,
            position=position,
        )
        db.add(outfit_item)

    db.commit()
    db.refresh(outfit)

    return {"success": True, "data": outfit.to_dict()}


@app.get("/outfits")
async def get_outfits(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get all saved outfits for the current user"""
    outfits = db.query(Outfit).filter(
        Outfit.user_id == user_id
    ).order_by(Outfit.created_at.desc()).all()

    return {
        "success": True,
        "data": [outfit.to_dict() for outfit in outfits]
    }


@app.get("/outfits/{outfit_id}")
async def get_outfit(
    outfit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Get a single saved outfit"""
    outfit = db.query(Outfit).filter(
        Outfit.id == outfit_id,
        Outfit.user_id == user_id
    ).first()

    if not outfit:
        return create_error_response("OUTFIT_NOT_FOUND", "Outfit not found", 404)

    # Enrich with item attributes
    item_ids = [oi.item_id for oi in outfit.outfit_items]
    attributes = db.query(ClothingAttribute).filter(
        ClothingAttribute.item_id.in_(item_ids)
    ).all()
    attr_map = {a.item_id: a.to_dict() for a in attributes}

    outfit_data = outfit.to_dict()
    outfit_data["items"] = [attr_map.get(iid) for iid in item_ids if iid in attr_map]

    return {"success": True, "data": outfit_data}


@app.put("/outfits/{outfit_id}/favorite")
async def toggle_favorite(
    outfit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Toggle favorite status of an outfit"""
    outfit = db.query(Outfit).filter(
        Outfit.id == outfit_id,
        Outfit.user_id == user_id
    ).first()

    if not outfit:
        return create_error_response("OUTFIT_NOT_FOUND", "Outfit not found", 404)

    outfit.is_favorite = not outfit.is_favorite
    outfit.updated_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "data": {"id": outfit.id, "is_favorite": outfit.is_favorite}
    }


@app.delete("/outfits/{outfit_id}")
async def delete_outfit(
    outfit_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a saved outfit"""
    outfit = db.query(Outfit).filter(
        Outfit.id == outfit_id,
        Outfit.user_id == user_id
    ).first()

    if not outfit:
        return create_error_response("OUTFIT_NOT_FOUND", "Outfit not found", 404)

    # Purge community-side data first. Non-blocking on failure — the startup
    # cleanup in community_service will mop up any stragglers.
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(
                f"{COMMUNITY_SERVICE_URL}/community/internal/outfits/{outfit_id}/purge",
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
    except Exception as e:
        logger.warning(f"Could not purge community data for outfit {outfit_id}: {e}")

    db.delete(outfit)
    db.commit()

    return {"success": True, "message": "Outfit deleted successfully"}


# ============== WARDROBE STATS ==============

@app.get("/wardrobe/stats")
async def get_wardrobe_stats(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get wardrobe analytics - category distribution, color palette,
    style breakdown, etc. Useful for the frontend dashboard.
    """
    attributes = db.query(ClothingAttribute).filter(
        ClothingAttribute.user_id == user_id
    ).all()

    if not attributes:
        return {
            "success": True,
            "data": {
                "total_items": 0,
                "categories": {},
                "colors": {},
                "styles": {},
                "formality_distribution": {},
            }
        }

    # Category distribution
    categories = {}
    colors = {}
    styles = {}
    formality = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for attr in attributes:
        categories[attr.category] = categories.get(attr.category, 0) + 1
        colors[attr.color_primary] = colors.get(attr.color_primary, 0) + 1
        if attr.color_secondary:
            colors[attr.color_secondary] = colors.get(attr.color_secondary, 0) + 1
        styles[attr.style] = styles.get(attr.style, 0) + 1
        formality[attr.formality_level] = formality.get(attr.formality_level, 0) + 1

    # Sort by count descending
    categories = dict(sorted(categories.items(), key=lambda x: x[1], reverse=True))
    colors = dict(sorted(colors.items(), key=lambda x: x[1], reverse=True))
    styles = dict(sorted(styles.items(), key=lambda x: x[1], reverse=True))

    total_outfits = db.query(Outfit).filter(Outfit.user_id == user_id).count()

    return {
        "success": True,
        "data": {
            "total_items": len(attributes),
            "total_outfits": total_outfits,
            "categories": categories,
            "colors": colors,
            "styles": styles,
            "formality_distribution": formality,
            "top_colors": list(colors.keys())[:5],
            "dominant_style": list(styles.keys())[0] if styles else None,
        }
    }


# ============== INTERNAL ENDPOINTS (service-to-service) ==============

@app.put("/outfits/{outfit_id}/shareable")
async def update_outfit_shareable(
    outfit_id: str,
    body: dict,
    x_api_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Internal endpoint — update outfit shareable status (called by community_service)"""
    if not verify_internal_request(x_api_key):
        return create_error_response("UNAUTHORIZED", "Invalid API key", 401)

    outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
    if not outfit:
        return create_error_response("OUTFIT_NOT_FOUND", "Outfit not found", 404)

    outfit.is_shareable = body.get("is_shareable", False)
    db.commit()
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3003))
    uvicorn.run(app, host="0.0.0.0", port=port)