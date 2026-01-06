"""
Wardrobe Service - with Full Authentication System
Based on requirements: Registration, Login, Password Reset, Logout
"""
import os
import re
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

import jwt
import bcrypt
import httpx

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/closetmate")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
PASSWORD_RESET_EXPIRY_HOURS = 1
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

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
    original_image_url = Column(String)
    file_name = Column(String(255))
    file_size = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    owner = relationship("User", back_populates="items")


# Create tables
Base.metadata.create_all(bind=engine)


# ============== VALIDATION HELPERS ==============

def validate_email(email: str) -> tuple[bool, str]:
    """Validate email address according to requirements"""
    if not email or len(email) > 254:
        return False, "Email must not exceed 254 characters"
    
    # Check for exactly one @ symbol
    if email.count('@') != 1:
        return False, "Email must contain exactly one '@' symbol"
    
    local, domain = email.split('@')
    
    # Check for characters before @
    if len(local) < 1:
        return False, "Email must have at least one character before '@'"
    
    # Check domain has at least one dot
    if '.' not in domain:
        return False, "Email domain must contain at least one '.' character"
    
    # Check allowed characters
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
    if not re.match(r'^[a-zA-Z\s]+$', name):
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


# ============== APP ==============

app = FastAPI(
    title="ClosetMate Wardrobe Service",
    description="Wardrobe management with full authentication",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== HEALTH ==============

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "wardrobe"}


# ============== AUTH ENDPOINTS ==============

@app.post("/auth/register")
async def register(
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
    
    # Validate email
    valid, msg = validate_email(email)
    if not valid:
        errors.append({"field": "email", "message": msg})
    
    # Validate password
    valid, msg = validate_password(password)
    if not valid:
        errors.append({"field": "password", "message": msg})
    
    # Validate confirm password
    if password != confirm_password:
        errors.append({"field": "confirm_password", "message": "Passwords do not match"})
    
    # Validate full name
    valid, msg = validate_full_name(full_name)
    if not valid:
        errors.append({"field": "full_name", "message": msg})
    
    # Return all validation errors
    if errors:
        return JSONResponse(
            status_code=400,
            content={"success": False, "errors": errors}
        )
    
    # Check if email exists
    existing_user = db.query(User).filter(User.email == email.lower()).first()
    if existing_user:
        return JSONResponse(
            status_code=409,
            content={
                "success": False,
                "error": {
                    "code": "EMAIL_EXISTS",
                    "message": "Please log in or use a different email address.",
                    "field": "email"
                }
            }
        )
    
    # Create user
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
    
    # Generate token
    token = create_token(user.id, user.email)
    
    return {
        "success": True,
        "message": "Account created successfully! Please check your email to verify your account.",
        "data": {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "token": token
        }
    }


@app.post("/auth/login")
async def login(
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
    
    # Find user
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        return create_error_response(
            "INVALID_CREDENTIALS",
            "Invalid email or password. Please try again.",
            401
        )
    
    # Check if account is locked
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        remaining = (user.lockout_until - datetime.utcnow()).seconds // 60
        return create_error_response(
            "ACCOUNT_LOCKED",
            f"Too many failed login attempts. You cannot login for {remaining + 1} minutes.",
            403
        )
    
    # Reset lockout if expired
    if user.lockout_until and user.lockout_until <= datetime.utcnow():
        user.failed_login_attempts = 0
        user.lockout_until = None
        db.commit()
    
    # Verify password
    if not verify_password(password, user.password_hash):
        # Increment failed attempts
        user.failed_login_attempts += 1
        
        # Lock account if max attempts reached
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.lockout_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
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
    
    # Successful login
    user.failed_login_attempts = 0
    user.lockout_until = None
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Generate token
    token = create_token(user.id, user.email)
    
    return {
        "success": True,
        "data": {
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "token": token
        }
    }


@app.post("/auth/forgot-password")
async def forgot_password(
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Request password reset
    - Generates reset token valid for 1 hour
    - Returns same message regardless of email existence (security)
    """
    email = email.lower()
    
    # Same message for security (prevent email enumeration)
    response_message = "If an account exists with that email address, you will receive a password reset link shortly."
    
    user = db.query(User).filter(User.email == email).first()
    
    if user:
        # Invalidate old tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).update({"used": True})
        
        # Create new reset token
        reset_token = PasswordResetToken(
            id=str(uuid.uuid4()),
            user_id=user.id,
            token=generate_reset_token(),
            expires_at=datetime.utcnow() + timedelta(hours=PASSWORD_RESET_EXPIRY_HOURS)
        )
        db.add(reset_token)
        db.commit()
        
        # TODO: Send email with reset link
        # In production, integrate with email service (SendGrid, SES, etc.)
        # reset_link = f"https://closetmate.org.tr/reset-password?token={reset_token.token}"
    
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
    - Token must be valid and not expired (1 hour)
    - Password must meet requirements
    """
    # Find token
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
    
    # Check if expired
    if reset_token.expires_at < datetime.utcnow():
        reset_token.used = True
        db.commit()
        return create_error_response(
            "TOKEN_EXPIRED",
            "Password reset link has expired or is invalid. Please request a new password reset.",
            400
        )
    
    # Validate new password
    valid, msg = validate_password(new_password)
    if not valid:
        return create_error_response("INVALID_PASSWORD", msg, 400, "new_password")
    
    # Validate confirm password
    if new_password != confirm_password:
        return create_error_response("PASSWORD_MISMATCH", "Passwords do not match", 400, "confirm_password")
    
    # Update password
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    user.password_hash = hash_password(new_password)
    
    # Mark token as used
    reset_token.used = True
    
    db.commit()
    
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
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        }
    }


@app.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user
    - In JWT, logout is client-side (delete token)
    - This endpoint is for logging/confirmation
    """
    return {
        "success": True,
        "message": "You have been logged out successfully."
    }


# ============== WARDROBE ENDPOINTS (Protected) ==============

@app.get("/items")
async def get_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all clothing items for current user"""
    items = db.query(ClothingItem).filter(ClothingItem.user_id == current_user.id).all()
    return {
        "success": True,
        "data": [
            {
                "id": item.id,
                "item_name": item.item_name,
                "season": item.season,
                "image_url": item.image_url,
                "original_image_url": item.original_image_url,
                "file_name": item.file_name,
                "file_size": item.file_size,
                "created_at": item.created_at.isoformat() + "Z" if item.created_at else None,
                "updated_at": item.updated_at.isoformat() + "Z" if item.updated_at else None,
            }
            for item in items
        ]
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
    
    return {
        "success": True,
        "data": {
            "id": item.id,
            "item_name": item.item_name,
            "season": item.season,
            "image_url": item.image_url,
            "original_image_url": item.original_image_url,
            "file_name": item.file_name,
            "file_size": item.file_size,
            "created_at": item.created_at.isoformat() + "Z" if item.created_at else None,
            "updated_at": item.updated_at.isoformat() + "Z" if item.updated_at else None,
        }
    }


@app.post("/items")
async def create_item(
    current_user: User = Depends(get_current_user),
    image: UploadFile = File(...),
    item_name: str = Form("Untitled"),
    season: str = Form("Untitled"),
    db: Session = Depends(get_db)
):
    """Create a new clothing item with background removal"""
    # Validate season
    valid_seasons = ["Spring", "Summer", "Fall", "Winter", "Untitled"]
    if season not in valid_seasons:
        season = "Untitled"
    
    # Read image content
    content = await image.read()
    
    # Send to image processing service
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
            
            if response.status_code != 200:
                return create_error_response("PROCESSING_FAILED", "Image processing failed", 500)
            
            image_data = response.json()
            
            if not image_data.get("success"):
                return create_error_response("PROCESSING_FAILED", image_data.get("error", {}).get("message", "Unknown error"), 500)
            
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Image service unavailable: {str(e)}", 503)
    
    # Create database record
    item = ClothingItem(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        item_name=item_name,
        season=season,
        image_url=image_data["data"]["processed_url"],
        original_image_url=image_data["data"]["original_url"],
        file_name=image_data["data"]["file_name"],
        file_size=image_data["data"]["file_size"],
    )
    
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return {
        "success": True,
        "data": {
            "id": item.id,
            "item_name": item.item_name,
            "season": item.season,
            "image_url": item.image_url,
            "original_image_url": item.original_image_url,
            "file_name": item.file_name,
            "file_size": item.file_size,
            "created_at": item.created_at.isoformat() + "Z" if item.created_at else None,
            "updated_at": item.updated_at.isoformat() + "Z" if item.updated_at else None,
        }
    }


@app.put("/items/{item_id}")
async def update_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    image: Optional[UploadFile] = File(None),
    item_name: Optional[str] = Form(None),
    season: Optional[str] = Form(None),
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
    
    if season is not None:
        valid_seasons = ["Spring", "Summer", "Fall", "Winter", "Untitled"]
        if season in valid_seasons:
            item.season = season
    
    # Process new image if provided
    if image:
        content = await image.read()
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                files = {"image": (image.filename, content, image.content_type)}
                response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
                
                if response.status_code == 200:
                    image_data = response.json()
                    if image_data.get("success"):
                        item.image_url = image_data["data"]["processed_url"]
                        item.original_image_url = image_data["data"]["original_url"]
                        item.file_name = image_data["data"]["file_name"]
                        item.file_size = image_data["data"]["file_size"]
        except httpx.RequestError:
            pass  # Keep old image if processing fails
    
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    
    return {
        "success": True,
        "data": {
            "id": item.id,
            "item_name": item.item_name,
            "season": item.season,
            "image_url": item.image_url,
            "original_image_url": item.original_image_url,
            "file_name": item.file_name,
            "file_size": item.file_size,
            "created_at": item.created_at.isoformat() + "Z" if item.created_at else None,
            "updated_at": item.updated_at.isoformat() + "Z" if item.updated_at else None,
        }
    }


@app.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a clothing item"""
    item = db.query(ClothingItem).filter(
        ClothingItem.id == item_id,
        ClothingItem.user_id == current_user.id
    ).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    # Delete from image service
    if item.file_name:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.delete(f"{IMAGE_SERVICE_URL}/images/{item.file_name}?type=both")
        except:
            pass  # Continue even if image deletion fails
    
    db.delete(item)
    db.commit()
    
    return {"success": True, "message": "Item deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=port)
