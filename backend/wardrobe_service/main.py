"""
Wardrobe Service - with Full Authentication System + Gemini Integration
Based on requirements: Registration, Login, Password Reset, Logout
+ Triggers AI clothing analysis on upload via Outfit Service
"""
import os
import re
import uuid
import secrets
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, Boolean, text as sa_text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

import jwt
import bcrypt
import httpx

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ============== CONFIGURATION ==============

DATABASE_URL = os.getenv("DATABASE_URL")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")
EMAIL_SERVICE_URL = os.getenv("EMAIL_SERVICE_URL", "http://localhost:3005")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 0.5  # 30 minutes per SRS 6.3a
PASSWORD_RESET_EXPIRY_MINUTES = 60  # 1 hour per SRS FReq1.3
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY environment variable is required")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Security
security = HTTPBearer()


# ============== MODELS ==============

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(254), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    lockout_until = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
    avatar_url = Column(String(500), nullable=True, default=None)
    comment_strike_count = Column(Integer, default=0)
    comment_banned_until = Column(DateTime, nullable=True)
    comment_ban_permanent = Column(Boolean, default=False)
    role = Column(String(20), nullable=False, default="user")  # "user" | "admin"

    # Relationship
    items = relationship("ClothingItem", back_populates="owner", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used = Column(Boolean, default=False)
    
    # Relationship
    user = relationship("User", back_populates="reset_tokens")


class ClothingItem(Base):
    __tablename__ = "clothing_items"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String(255), default="Untitled")
    season = Column(String(50), default="Untitled")
    image_url = Column(String, nullable=False)
    file_name = Column(String(255))
    file_size = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    owner = relationship("User", back_populates="items")


# Create tables
Base.metadata.create_all(bind=engine)

# Idempotent migrations for existing databases
with engine.connect() as _conn:
    for _stmt in (
        "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN comment_strike_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN comment_banned_until TIMESTAMP DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN comment_ban_permanent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'",
    ):
        try:
            _conn.execute(sa_text(_stmt))
            _conn.commit()
            logger.info(f"Migration applied: {_stmt}")
        except Exception:
            _conn.rollback()


# Admin is no longer a user role. Privileged operations (reset-strikes,
# moderation-logs) are gated by X-API-Key matching INTERNAL_API_KEY,
# not by a JWT role. The users.role column is kept for future use but
# is always "user" for human accounts.


# ============== VALIDATION HELPERS ==============

def validate_email(email: str) -> tuple[bool, str]:
    """Validate email address according to requirements"""
    if not email or len(email) > 254:
        return False, "Email must not exceed 254 characters"
    
    if email.count('@') != 1:
        return False, "Email must contain exactly one '@' symbol"
    
    local, domain = email.split('@')
    
    if len(local) < 1:
        return False, "Email must have at least one character before '@'"
    
    if '.' not in domain:
        return False, "Email domain must contain at least one '.' character"
    
    pattern = r'^[a-zA-Z0-9._\-]+@[a-zA-Z0-9._\-]+$'
    if not re.match(pattern, email):
        return False, "Email contains invalid characters"
    
    return True, ""


def validate_password(password: str) -> tuple[bool, str]:
    """Validate password according to requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if len(password) > 128:
        return False, "Password must not exceed 128 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one digit"
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:\',.<>?/~`]', password):
        return False, "Password must contain at least one special character"
    
    return True, ""


def validate_full_name(name: str) -> tuple[bool, str]:
    """Validate full name according to requirements"""
    if len(name) < 2:
        return False, "Name must be at least 2 characters"
    if len(name) > 100:
        return False, "Name must not exceed 100 characters"
    if not re.match(r'^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$', name):
        return False, "Name must contain only alphabetic characters and spaces"
    
    return True, ""


# ============== AUTH HELPERS ==============

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def create_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    """Get current user from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def generate_reset_token() -> str:
    """Generate secure password reset token"""
    return secrets.token_urlsafe(32)


def create_error_response(code: str, message: str, status_code: int = 400, field: str = None):
    """Create standardized error response"""
    content = {"success": False, "error": {"code": code, "message": message}}
    if field:
        content["error"]["field"] = field
    return JSONResponse(status_code=status_code, content=content)


# ============== ITEM SERIALIZATION HELPER ==============

def serialize_item(item: ClothingItem) -> dict:
    """Serialize a ClothingItem to dict - single source of truth"""
    return {
        "id": item.id,
        "item_name": item.item_name,
        "season": item.season,
        "image_url": item.image_url,
        "file_name": item.file_name,
        "file_size": item.file_size,
        "created_at": item.created_at.isoformat() + "Z" if item.created_at else None,
        "updated_at": item.updated_at.isoformat() + "Z" if item.updated_at else None,
    }


# ============== EMAIL SERVICE INTEGRATION ==============

async def call_email_service(endpoint: str, payload: dict) -> dict:
    """Call Email Service internal API"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{EMAIL_SERVICE_URL}{endpoint}",
                json=payload,
                headers={"X-API-Key": INTERNAL_API_KEY}
            )
            return response.json()
    except Exception as e:
        logger.error(f"Email service call failed ({endpoint}): {e}")
        return {"success": False, "error": str(e)}


# ============== OUTFIT SERVICE INTEGRATION ==============

def _seasons_to_display(seasons_list: list) -> str:
    """Convert seasons array to display string for wardrobe item"""
    if not seasons_list:
        return "All Season"
    if len(seasons_list) == 4:
        return "All Season"
    return "/".join(seasons_list)


async def trigger_clothing_analysis(item_id: str, user_id: str, image_url: str):
    """
    Fire-and-forget call to the outfit service to analyze the clothing item.
    On success, updates the item's name and season from Gemini's analysis.
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OUTFIT_SERVICE_URL}/analyze",
                json={
                    "item_id": item_id,
                    "user_id": user_id,
                    "image_url": image_url,
                    "x_api_key": INTERNAL_API_KEY,
                }
            )
            logger.info(f"Clothing analysis triggered for item {item_id}, status: {resp.status_code}")

            # Update item with AI-generated name and season
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data"):
                    attrs = data["data"]
                    ai_name = attrs.get("name")
                    seasons = attrs.get("seasons", [])
                    season = _seasons_to_display(seasons)

                    db = SessionLocal()
                    try:
                        item = db.query(ClothingItem).filter(ClothingItem.id == item_id).first()
                        if item and item.item_name == "Untitled":
                            item.item_name = ai_name or "Untitled"
                        if item and item.season == "Untitled":
                            item.season = season
                        db.commit()
                        logger.info(f"Item {item_id} updated from analysis: name='{ai_name}', season='{season}'")
                    finally:
                        db.close()

    except Exception as e:
        logger.warning(f"Failed to trigger clothing analysis for item {item_id}: {e}")


async def cleanup_clothing_attributes(item_id: str, token: str):
    """
    Notify outfit service to delete attributes when a clothing item is deleted.
    Non-blocking cleanup.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(
                f"{OUTFIT_SERVICE_URL}/analyze/{item_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            logger.info(f"Clothing attributes cleanup triggered for item {item_id}")
    except Exception as e:
        logger.warning(f"Failed to cleanup attributes for item {item_id}: {e}")


async def cleanup_image_file(file_name: str):
    """
    Notify image processing service to delete the stored file.
    Non-blocking cleanup — fire and forget.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.delete(
                f"{IMAGE_SERVICE_URL}/images/{file_name}",
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
            logger.info(f"Image file cleanup triggered for {file_name}")
    except Exception as e:
        logger.warning(f"Failed to cleanup image file {file_name}: {e}")


# ============== APP ==============

app = FastAPI(
    title="ClosetMate Wardrobe Service",
    description="Wardrobe management with full authentication + AI analysis",
    version="3.0.0",
    # Internal service — no public docs
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Rate limiting — per-IP throttle on auth endpoints. These run *before* a
# JWT exists so we cannot key on user_id; the per-user layer is provided by
# ``failed_login_attempts`` + ``lockout_until`` on the User model (5 bad
# password attempts → 15 min lockout) and by the 5-attempt cap enforced by
# the email service on OTP verification. IP limiting is weaker (VPNs can
# rotate addresses) but combined with those user-scoped counters it raises
# the cost of brute force / credential stuffing considerably.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: only allow the public frontend origin. Internal service-to-service
# traffic doesn't need CORS since Docker network bypasses the browser.
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

app.add_middleware(GZipMiddleware, minimum_size=500)


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
        return {"status": "healthy", "service": "wardrobe", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "service": "wardrobe", "database": "disconnected", "error": str(e)}
        )


# ============== AUTH ENDPOINTS ==============

@app.post("/auth/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    full_name: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Register a new user
    - Email: max 254 chars, valid format
    - Password: 8-128 chars, uppercase, lowercase, digit, special char
    - Full name: 2-100 chars, alphabetic only
    """
    errors = []
    
    valid, msg = validate_email(email)
    if not valid:
        errors.append({"field": "email", "message": msg})
    
    valid, msg = validate_password(password)
    if not valid:
        errors.append({"field": "password", "message": msg})

    if password != confirm_password:
        errors.append({"field": "confirmPassword", "message": "Passwords do not match"})

    valid, msg = validate_full_name(full_name)
    if not valid:
        errors.append({"field": "fullName", "message": msg})
    
    if errors:
        return JSONResponse(
            status_code=400,
            content={"success": False, "errors": errors}
        )
    
    existing_user = db.query(User).filter(User.email == email.lower()).first()
    if existing_user:
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "errors": [{"field": "email", "message": "Please log in or use a different email address."}]
            }
        )
    
    user = User(
        id=str(uuid.uuid4()),
        email=email.lower(),
        password_hash=hash_password(password),
        full_name=full_name.strip(),
        is_verified=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send OTP via Email Service
    otp_result = await call_email_service("/otp/send", {
        "email": user.email,
        "full_name": user.full_name,
        "purpose": "register"
    })

    logger.info(f"AUTH: New user registered — {user.email} (id={user.id})")

    # Do NOT return JWT token — user must verify email first
    return {
        "success": True,
        "message": "Account created! Please check your email for a 6-digit verification code.",
        "data": {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "requires_verification": True,
            "otp_expires_in_seconds": otp_result.get("expires_in_seconds", 600)
        }
    }


@app.post("/auth/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    - Tracks failed login attempts
    - Locks account after 5 failed attempts for 15 minutes
    """
    email = email.lower()
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        return create_error_response(
            "INVALID_CREDENTIALS",
            "Invalid email or password. Please try again.",
            401
        )
    
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        remaining = (user.lockout_until - datetime.utcnow()).seconds // 60
        logger.warning(f"AUTH: Login attempt on locked account — {email}")
        return create_error_response(
            "ACCOUNT_LOCKED",
            f"Too many failed login attempts. You cannot login for {remaining + 1} minutes.",
            403
        )
    
    if user.lockout_until and user.lockout_until <= datetime.utcnow():
        user.failed_login_attempts = 0
        user.lockout_until = None
        db.commit()
    
    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        logger.warning(f"AUTH: Failed login attempt {user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS} — {email}")

        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
            logger.warning(f"AUTH: Account locked for {LOCKOUT_MINUTES}min — {email}")
            return create_error_response(
                "ACCOUNT_LOCKED",
                f"Too many failed login attempts. You cannot login for {LOCKOUT_MINUTES} minutes.",
                403
            )
        
        db.commit()
        remaining_attempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts
        return create_error_response(
            "INVALID_CREDENTIALS",
            f"Invalid email or password. Please try again. {remaining_attempts} attempts remaining.",
            401
        )
    
    user.failed_login_attempts = 0
    user.lockout_until = None
    user.last_login = datetime.utcnow()
    db.commit()
    logger.info(f"AUTH: Successful login — {email} (id={user.id})")

    # Send login OTP via Email Service
    otp_result = await call_email_service("/otp/send", {
        "email": user.email,
        "full_name": user.full_name,
        "purpose": "login"
    })

    # If OTP delivery fails we MUST NOT issue a session token — that would
    # reduce the login to single-factor. Fail closed and let the user retry.
    if not otp_result.get("success"):
        logger.warning(f"AUTH: OTP send failed for {email} — refusing to issue token")
        return create_error_response(
            "SERVICE_UNAVAILABLE",
            "Unable to send verification code right now. Please try again in a moment.",
            503,
        )

    # OTP sent — client must now call /auth/verify-login
    return {
        "success": True,
        "message": "Verification code sent to your email.",
        "data": {
            "email": user.email,
            "full_name": user.full_name,
            "requires_otp": True,
            "otp_expires_in_seconds": otp_result.get("expires_in_seconds", 600)
        }
    }


@app.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Request password reset
    - Generates reset token valid for 10 minutes
    - Returns same message regardless of email existence (security)
    """
    email = email.lower()
    
    response_message = "If an account exists with that email address, you will receive a password reset link shortly."
    
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})
        
        reset_token = PasswordResetToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token=generate_reset_token(),
            expires_at=datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRY_MINUTES)
        )
        db.add(reset_token)
        db.commit()
        
        # Send reset email via Email Service
        await call_email_service("/email/send-reset", {
            "email": user.email,
            "full_name": user.full_name,
            "reset_token": reset_token.token
        })
    
    return {
        "success": True,
        "message": response_message
    }


@app.post("/auth/reset-password")
async def reset_password(
    token: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Reset password with valid token
    - Token must be valid and not expired (10 minutes)
    - Password must meet requirements
    """
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.used == False
    ).first()
    
    if not reset_token:
        return create_error_response(
            "INVALID_TOKEN",
            "Password reset link has expired or is invalid. Please request a new password reset.",
            400
        )
    
    if reset_token.expires_at < datetime.utcnow():
        reset_token.used = True
        db.commit()
        return create_error_response(
            "TOKEN_EXPIRED",
            "Password reset link has expired or is invalid. Please request a new password reset.",
            400
        )
    
    valid, msg = validate_password(new_password)
    if not valid:
        return create_error_response("INVALID_PASSWORD", msg, 400, "new_password")
    
    if new_password != confirm_password:
        return create_error_response("PASSWORD_MISMATCH", "Passwords do not match", 400, "confirm_password")
    
    user = db.query(User).filter(User.id == reset_token.user_id).first()

    if verify_password(new_password, user.password_hash):
        return create_error_response(
            "SAME_PASSWORD",
            "New password cannot be the same as your current password.",
            400,
            "new_password"
        )

    user.password_hash = hash_password(new_password)

    reset_token.used = True

    db.commit()
    logger.info(f"AUTH: Password reset successful — user_id={user.id}")

    return {
        "success": True,
        "message": "Password reset successful! Please log in with your new password."
    }


@app.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "success": True,
        "data": {
            "user_id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "avatar_url": current_user.avatar_url,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        }
    }


# ============== AVATAR ENDPOINTS ==============

_AVATAR_ALLOWED_EXTS = {".jpg", ".jpeg", ".png"}
_AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2MB


@app.put("/auth/avatar")
async def update_avatar(
    current_user: User = Depends(get_current_user),
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload or replace the user's profile picture."""
    content = await avatar.read()

    if len(content) > _AVATAR_MAX_BYTES:
        return create_error_response("FILE_TOO_LARGE", "Avatar must be under 2MB.", 400)

    ext = os.path.splitext(avatar.filename or "")[1].lower()
    if ext not in _AVATAR_ALLOWED_EXTS:
        return create_error_response(
            "INVALID_FILE_TYPE",
            f"Allowed formats: {', '.join(sorted(_AVATAR_ALLOWED_EXTS))}",
            400,
        )

    # Send to image processing service for storage (no bg removal)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"image": (avatar.filename, content, avatar.content_type)}
            response = await client.post(
                f"{IMAGE_SERVICE_URL}/images/store",
                files=files,
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
            if response.status_code != 200:
                logger.error(f"Avatar upload: image service returned {response.status_code}: {response.text[:200]}")
                return create_error_response("UPLOAD_FAILED", "Avatar upload failed.", 500)
            data = response.json()
            if not data.get("success") or "data" not in data:
                return create_error_response("UPLOAD_FAILED", "Avatar upload failed.", 500)
    except httpx.TimeoutException:
        return create_error_response("SERVICE_TIMEOUT", "Avatar upload timed out.", 504)
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Image service unavailable: {str(e)}", 503)

    # Cleanup old avatar (fire-and-forget)
    if current_user.avatar_url:
        old_file = current_user.avatar_url.rsplit("/", 1)[-1]
        if old_file:
            asyncio.create_task(cleanup_image_file(old_file))

    current_user.avatar_url = data["data"]["url"]
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "data": {"avatar_url": current_user.avatar_url},
    }


@app.delete("/auth/avatar")
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove the user's profile picture."""
    if not current_user.avatar_url:
        return create_error_response("NO_AVATAR", "No avatar to delete.", 404)

    old_file = current_user.avatar_url.rsplit("/", 1)[-1]
    if old_file:
        asyncio.create_task(cleanup_image_file(old_file))

    current_user.avatar_url = None
    db.commit()

    return {"success": True, "message": "Avatar removed."}


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user
    - In JWT, logout is client-side (delete token)
    - This endpoint is for logging/confirmation
    """
    logger.info(f"AUTH: User logged out — {current_user.email} (id={current_user.id})")
    return {
        "success": True,
        "message": "You have been logged out successfully."
    }


# ============== OTP VERIFICATION ENDPOINTS ==============

@app.post("/auth/verify-email")
async def verify_email(
    email: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Verify email after registration with 6-digit OTP.
    On success: marks user as verified + returns JWT token.
    """
    email = email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return create_error_response("INVALID_CODE", "Invalid email or verification code.", 400)

    if user.is_verified:
        return create_error_response("ALREADY_VERIFIED", "Email is already verified.", 400)

    # Verify OTP via Email Service
    result = await call_email_service("/otp/verify", {"email": email, "code": code})

    if not result.get("valid"):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_CODE",
                    "message": result.get("error", "Invalid or expired verification code. Please request a new one."),
                    "can_resend": True
                }
            }
        )

    # Mark user as verified
    user.is_verified = True
    db.commit()

    # Issue JWT token
    token = create_token(user.id, user.email)

    return {
        "success": True,
        "message": "Email verified successfully!",
        "data": {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "token": token
        }
    }


@app.post("/auth/verify-login")
@limiter.limit("10/minute")
async def verify_login(
    request: Request,
    email: str = Form(...),
    code: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Verify login OTP. Called after successful password check.
    On success: returns JWT token.
    """
    email = email.lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return create_error_response("INVALID_CODE", "Invalid email or verification code.", 400)

    # Verify OTP via Email Service
    result = await call_email_service("/otp/verify", {"email": email, "code": code})

    if not result.get("valid"):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_CODE",
                    "message": result.get("error", "Invalid or expired verification code. Please request a new one."),
                    "can_resend": True
                }
            }
        )

    # Issue JWT token
    token = create_token(user.id, user.email)

    return {
        "success": True,
        "data": {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "token": token
        }
    }


@app.post("/auth/resend-code")
@limiter.limit("3/minute")
async def resend_code(
    request: Request,
    email: str = Form(...),
    purpose: str = Form("register"),
    db: Session = Depends(get_db)
):
    """
    Resend OTP code. Works for both register and login purposes.
    Returns same message regardless of email existence (security).
    """
    email = email.lower()
    success_message = "If an account exists with that email, a new verification code has been sent."

    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"success": True, "message": success_message}

    otp_result = await call_email_service("/otp/send", {
        "email": user.email,
        "full_name": user.full_name,
        "purpose": purpose
    })

    return {
        "success": True,
        "message": success_message,
        "data": {
            "otp_expires_in_seconds": otp_result.get("expires_in_seconds", 600)
        }
    }


# ============== WARDROBE ENDPOINTS (Protected) ==============

@app.get("/items")
async def get_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all clothing items for current user"""
    items = db.query(ClothingItem).filter(
        ClothingItem.user_id == current_user.id
    ).order_by(ClothingItem.created_at.desc()).all()
    return {
        "success": True,
        "data": [serialize_item(item) for item in items]
    }


@app.get("/items/{item_id}")
async def get_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single clothing item"""
    item = db.query(ClothingItem).filter(
        ClothingItem.id == item_id,
        ClothingItem.user_id == current_user.id
    ).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    return {"success": True, "data": serialize_item(item)}


@app.post("/items")
async def create_item(
    current_user: User = Depends(get_current_user),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Create a new clothing item with background removal + AI analysis"""
    # Read image content
    content = await image.read()
    logger.info(f"Create item: received image '{image.filename}' ({len(content)} bytes) from user {current_user.id}")
    
    # Send to image processing service
    try:
        logger.info(f"Create item: calling image service at {IMAGE_SERVICE_URL}/images/process")
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            response = await client.post(
                f"{IMAGE_SERVICE_URL}/images/process",
                files=files,
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
            logger.info(f"Create item: image service responded with status {response.status_code} in {response.elapsed.total_seconds():.2f}s")
            
            if response.status_code != 200:
                logger.error(f"Create item: image processing failed with status {response.status_code}: {response.text[:200]}")
                return create_error_response("PROCESSING_FAILED", "Image processing failed", 500)
            
            image_data = response.json()
            
            if not image_data.get("success"):
                logger.error(f"Create item: image processing returned error: {image_data.get('error', {})}")
                return create_error_response("PROCESSING_FAILED", image_data.get("error", {}).get("message", "Unknown error"), 500)
            
            logger.info(f"Create item: image processing successful, file: {image_data['data'].get('file_name')}")
            
    except httpx.TimeoutException as e:
        logger.error(f"Create item: image service TIMEOUT after 60s: {e}")
        return create_error_response("SERVICE_TIMEOUT", "Image processing timed out. Please try again.", 504)
    except httpx.RequestError as e:
        logger.error(f"Create item: image service connection error: {e}")
        return create_error_response("SERVICE_UNAVAILABLE", f"Image service unavailable: {str(e)}", 503)

    processed_url = image_data["data"]["processed_url"]
    file_name = image_data["data"]["file_name"]
    file_size = image_data["data"]["file_size"]

    # >>> SYNCHRONOUS Gemini analysis + content moderation
    # If moderation rejects, we must reject the upload BEFORE persisting the item.
    # If Gemini is unavailable, we fall back to "Untitled" so the user is not blocked.
    ai_name = "Untitled"
    ai_season = "Untitled"
    analysis_attrs = None
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OUTFIT_SERVICE_URL}/analyze",
                json={
                    "item_id": "pending",  # signals: validate-only, do not persist
                    "user_id": current_user.id,
                    "image_url": processed_url,
                    "x_api_key": INTERNAL_API_KEY,
                },
            )

            if resp.status_code == 400:
                data = resp.json()
                error_info = data.get("error", {}) if isinstance(data, dict) else {}
                if error_info.get("code") == "MODERATION_REJECTED":
                    # Cleanup the processed image since we're rejecting the upload
                    asyncio.create_task(cleanup_image_file(file_name))
                    logger.warning(f"Create item: moderation rejected for user {current_user.id}: {error_info.get('message')}")
                    return create_error_response(
                        "MODERATION_REJECTED",
                        error_info.get("message", "The uploaded image was not recognized as a valid clothing item."),
                        400,
                    )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data"):
                    analysis_attrs = data["data"]
                    ai_name = analysis_attrs.get("name") or "Untitled"
                    seasons = analysis_attrs.get("seasons", [])
                    ai_season = _seasons_to_display(seasons)
            else:
                logger.warning(f"Create item: outfit_service returned {resp.status_code}, proceeding with Untitled")

    except Exception as e:
        # Fail-open on transient Gemini/outfit_service issues — moderation is best-effort
        logger.warning(f"Create item: synchronous analysis failed, proceeding without: {e}")

    # Create database record (with AI-derived name/season already populated)
    item = ClothingItem(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        item_name=ai_name,
        season=ai_season,
        image_url=processed_url,
        file_name=file_name,
        file_size=file_size,
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(f"Create item: saved to DB with id {item.id} (name='{ai_name}', season='{ai_season}')")

    # If we got a full analysis, persist attributes to the outfit_service so
    # future outfit generation works without another Gemini call
    if analysis_attrs:
        asyncio.create_task(
            trigger_clothing_analysis(
                item_id=item.id,
                user_id=current_user.id,
                image_url=item.image_url,
            )
        )

    return {"success": True, "data": serialize_item(item)}


@app.put("/items/{item_id}")
async def update_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    image: Optional[UploadFile] = File(None),
    item_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Update a clothing item"""
    item = db.query(ClothingItem).filter(
        ClothingItem.id == item_id,
        ClothingItem.user_id == current_user.id
    ).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    # Update fields
    if item_name is not None:
        item.item_name = item_name
    
    # Process new image if provided
    image_updated = False
    old_file_name = item.file_name  # track for cleanup
    if image:
        content = await image.read()
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                files = {"image": (image.filename, content, image.content_type)}
                response = await client.post(
                    f"{IMAGE_SERVICE_URL}/images/process",
                    files=files,
                    headers={"X-API-Key": INTERNAL_API_KEY or ""},
                )

                if response.status_code == 200:
                    image_data = response.json()
                    if image_data.get("success"):
                        item.image_url = image_data["data"]["processed_url"]
                        item.file_name = image_data["data"]["file_name"]
                        item.file_size = image_data["data"]["file_size"]
                        image_updated = True
                        # Cleanup old image file
                        if old_file_name:
                            asyncio.create_task(
                                cleanup_image_file(old_file_name)
                            )
        except httpx.RequestError as e:
            logger.warning(f"Image processing failed during update for item {item_id}: {e}")
    
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    
    # >>> GEMINI INTEGRATION: Re-analyze if image was updated
    if image_updated:
        asyncio.create_task(
            trigger_clothing_analysis(
                item_id=item.id,
                user_id=current_user.id,
                image_url=item.image_url,
            )
        )
    
    return {"success": True, "data": serialize_item(item)}


@app.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Delete a clothing item"""
    item = db.query(ClothingItem).filter(
        ClothingItem.id == item_id,
        ClothingItem.user_id == current_user.id
    ).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    # Cleanup clothing attributes in outfit service (await to ensure consistency)
    await cleanup_clothing_attributes(
        item_id=item_id,
        token=credentials.credentials,
    )

    db.delete(item)
    db.commit()

    # Cleanup image file (fire-and-forget — not critical for data consistency)
    if item.file_name:
        asyncio.create_task(
            cleanup_image_file(item.file_name)
        )
    logger.info(f"Item {item_id} deleted by user {current_user.id}")
    
    return {"success": True, "message": "Item deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=port)