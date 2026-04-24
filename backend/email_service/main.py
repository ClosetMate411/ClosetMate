"""
Email Service - Standalone microservice for OTP management and email delivery
Uses Resend API for sending, PostgreSQL for OTP storage
"""
import os
import uuid
import secrets
import logging
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Index, text as sa_text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# ============== CONFIGURATION ==============

DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "ClosetMate <noreply@closetmate.org.tr>")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.closetmate.org.tr")

OTP_EXPIRY_MINUTES = 10
# Sliding-window rate limit on OTP issuance — keyed per-email.
# Short enough that legitimate users retrying during a login session
# won't lock themselves out; long enough to slow brute-force / enumeration.
# 5 codes per 10-minute window = max 30 per hour per email.
OTP_RATE_LIMIT_MAX = 5
OTP_RATE_LIMIT_WINDOW_MINUTES = 10

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")
if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY environment variable is required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Resend setup
_resend = None
if RESEND_API_KEY:
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        _resend = resend
        logger.info("Resend configured successfully")
    except ImportError:
        logger.warning("resend package not installed")
else:
    logger.warning("RESEND_API_KEY not set — dev mode, emails logged to console")


# ============== MODEL ==============

class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(254), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(20), nullable=False)  # "register", "login", "resend"
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_otp_email_purpose", "email", "purpose"),
    )


Base.metadata.create_all(bind=engine)

# ── Auto-migrate: add failed_attempts column if missing ──
with engine.connect() as conn:
    try:
        conn.execute(sa_text("ALTER TABLE otp_codes ADD COLUMN failed_attempts INTEGER DEFAULT 0"))
        conn.commit()
        logger.info("Migration: added failed_attempts column to otp_codes")
    except Exception:
        conn.rollback()  # Column already exists, ignore


# ============== HELPERS ==============

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_internal_key(request: Request) -> bool:
    """Verify service-to-service API key. Strict: always requires key match."""
    if not INTERNAL_API_KEY:
        return False
    api_key = request.headers.get("X-API-Key", "")
    return api_key == INTERNAL_API_KEY


def generate_otp() -> str:
    """Generate 6-digit numeric OTP using a CSPRNG (secrets module)."""
    return f"{secrets.randbelow(900000) + 100000}"


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Resend or log in dev mode"""
    if not _resend:
        logger.info(f"[DEV MODE] Email to {to_email} | Subject: {subject}")
        return True
    try:
        response = _resend.Emails.send({
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        logger.info(f"Email sent to {to_email}, id: {response.get('id', 'unknown')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


# ============== EMAIL TEMPLATES ==============

def _otp_email_html(full_name: str, code: str, purpose: str) -> str:
    if purpose == "login":
        title = "Login verification"
        subtitle = "Use the code below to complete your login:"
    else:
        title = "Verify your email"
        subtitle = "Use the code below to verify your ClosetMate account:"

    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; color: #1a1a1a; margin: 0;">ClosetMate</h1>
        </div>
        <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 20px;">{title}</h2>
        <p style="color: #666; font-size: 15px; line-height: 1.5;">Hi {full_name},</p>
        <p style="color: #666; font-size: 15px; line-height: 1.5;">{subtitle}</p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">{code}</span>
        </div>
        <p style="color: #999; font-size: 13px;">This code expires in {OTP_EXPIRY_MINUTES} minutes.</p>
        <p style="color: #999; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">ClosetMate — Your AI-Powered Wardrobe Assistant</p>
    </div>
    """


def _reset_email_html(full_name: str, reset_token: str) -> str:
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; color: #1a1a1a; margin: 0;">ClosetMate</h1>
        </div>
        <h2 style="color: #1a1a1a; margin-bottom: 8px; font-size: 20px;">Reset your password</h2>
        <p style="color: #666; font-size: 15px; line-height: 1.5;">Hi {full_name},</p>
        <p style="color: #666; font-size: 15px; line-height: 1.5;">We received a password reset request for your account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="{reset_link}" style="background: #1a1a1a; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #999; font-size: 13px;">This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">Or copy this link: {reset_link}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #bbb; font-size: 11px; text-align: center;">ClosetMate — Your AI-Powered Wardrobe Assistant</p>
    </div>
    """


# ============== APP ==============

app = FastAPI(
    title="ClosetMate Email Service",
    description="OTP management and email delivery microservice",
    version="1.0.0",
    # Internal service — no public docs
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

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
            content={"success": False, "error": "Database connection failed. Please try again later."}
        )
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "An unexpected error occurred."}
    )


# ============== HEALTH ==============

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(sa_text("SELECT 1"))
        return {
            "status": "healthy",
            "service": "email",
            "database": "connected",
            "resend_configured": _resend is not None,
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "service": "email", "database": "disconnected", "error": str(e)}
        )


# ============== INTERNAL ENDPOINTS (called by Wardrobe Service) ==============

@app.post("/otp/send")
async def send_otp(request: Request, db: Session = Depends(get_db)):
    """
    Generate and send 6-digit OTP.
    Called internally by Wardrobe Service.

    Body (JSON): { "email", "full_name", "purpose": "register"|"login" }
    Header: X-API-Key for service-to-service auth
    """
    if not verify_internal_key(request):
        return JSONResponse(status_code=403, content={"success": False, "error": "Invalid API key"})

    body = await request.json()
    email = body.get("email", "").lower()
    full_name = body.get("full_name", "User")
    purpose = body.get("purpose", "register")

    if not email:
        return JSONResponse(status_code=400, content={"success": False, "error": "Email is required"})

    # Sliding-window rate limit — N OTPs per email per short window.
    window_start = datetime.utcnow() - timedelta(minutes=OTP_RATE_LIMIT_WINDOW_MINUTES)
    recent_count = db.query(OTPCode).filter(
        OTPCode.email == email,
        OTPCode.created_at > window_start
    ).count()

    if recent_count >= OTP_RATE_LIMIT_MAX:
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "error": f"Too many verification code requests. Please try again in {OTP_RATE_LIMIT_WINDOW_MINUTES} minutes.",
            }
        )

    # Invalidate previous unused codes for this email
    db.query(OTPCode).filter(
        OTPCode.email == email,
        OTPCode.used == False
    ).update({"used": True})

    # Generate new OTP
    code = generate_otp()
    otp = OTPCode(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp)
    db.commit()

    # Send email
    subject = f"ClosetMate — Your verification code is {code}"
    html = _otp_email_html(full_name, code, purpose)
    sent = _send_email(email, subject, html)

    return {
        "success": True,
        "sent": sent,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
        "expires_at": otp.expires_at.isoformat() + "Z"
    }


@app.post("/otp/verify")
async def verify_otp(request: Request, db: Session = Depends(get_db)):
    """
    Verify a 6-digit OTP code.
    Called internally by Wardrobe Service.

    Body (JSON): { "email", "code" }
    Header: X-API-Key

    Returns: { "success": true, "valid": true/false }
    """
    if not verify_internal_key(request):
        return JSONResponse(status_code=403, content={"success": False, "error": "Invalid API key"})

    body = await request.json()
    email = body.get("email", "").lower()
    code = body.get("code", "")

    if not email or not code:
        return JSONResponse(status_code=400, content={"success": False, "error": "Email and code are required"})

    MAX_OTP_ATTEMPTS = 5

    # Find the latest unused, non-expired OTP for this email
    latest_otp = db.query(OTPCode).filter(
        OTPCode.email == email,
        OTPCode.used == False,
        OTPCode.expires_at > datetime.utcnow()
    ).order_by(OTPCode.created_at.desc()).first()

    if not latest_otp:
        return {"success": True, "valid": False, "error": "Invalid or expired verification code."}

    # Brute-force protection: lock after MAX_OTP_ATTEMPTS failed tries
    if latest_otp.failed_attempts >= MAX_OTP_ATTEMPTS:
        latest_otp.used = True
        db.commit()
        return {"success": True, "valid": False, "error": "Too many failed attempts. Please request a new code."}

    # Check code match
    if latest_otp.code != code:
        latest_otp.failed_attempts += 1
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - latest_otp.failed_attempts
        return {"success": True, "valid": False, "error": f"Invalid verification code. {remaining} attempts remaining."}

    # Mark as used
    latest_otp.used = True
    db.commit()

    return {"success": True, "valid": True, "purpose": latest_otp.purpose}


@app.post("/email/send-reset")
async def send_reset_email(request: Request):
    """
    Send password reset email.
    Called internally by Wardrobe Service.

    Body (JSON): { "email", "full_name", "reset_token" }
    Header: X-API-Key
    """
    if not verify_internal_key(request):
        return JSONResponse(status_code=403, content={"success": False, "error": "Invalid API key"})

    body = await request.json()
    email = body.get("email", "")
    full_name = body.get("full_name", "User")
    reset_token = body.get("reset_token", "")

    if not email or not reset_token:
        return JSONResponse(status_code=400, content={"success": False, "error": "Email and reset_token required"})

    subject = "ClosetMate — Reset your password"
    html = _reset_email_html(full_name, reset_token)
    sent = _send_email(email, subject, html)

    return {"success": True, "sent": sent}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3005))
    uvicorn.run(app, host="0.0.0.0", port=port)
