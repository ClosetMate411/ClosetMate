"""
API Gateway - Routes requests to appropriate services
Full authentication support + Image Processing + Outfit Service
Accepts both JSON and Form data for auth endpoints

Docs at /docs are public (discovery is allowed). Each endpoint's own
auth dependency controls execution. /api/admin/* additionally requires
role=admin in the JWT claims.
"""
import os
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form, Header, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Service URLs
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")
COMMUNITY_SERVICE_URL = os.getenv("COMMUNITY_SERVICE_URL", "http://localhost:3004")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.closetmate.org.tr")

# Internal API key — guards /api/admin/* at the gateway edge.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "https://www.closetmate.org.tr",
    "https://closetmate.org.tr",
    "https://apigateway-production-b91d.up.railway.app",  # Railway public gateway
    "http://localhost:5173",      # Vite dev server
    "http://127.0.0.1:5173",     # Vite dev server (IP form)
    "http://localhost:3000",
]

# Append any extra origins from env (comma-separated)
_extra = os.getenv("EXTRA_CORS_ORIGINS", "")
if _extra:
    ALLOWED_ORIGINS.extend([o.strip() for o in _extra.split(",") if o.strip()])

_DOCS_ENABLED = os.getenv("ENABLE_DOCS", "").lower() in ("1", "true", "yes")
app = FastAPI(
    title="ClosetMate API Gateway",
    description="API Gateway for ClosetMate microservices",
    version="3.0.0",
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}}
    )


async def get_body_data(request: Request) -> dict:
    """Extract data from JSON or Form body"""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        return await request.json()
    else:
        form = await request.form()
        return dict(form)


# ============== AUTH DEPENDENCIES ==============

def require_internal_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Require X-API-Key matching INTERNAL_API_KEY. Used by /api/admin/*.
    Shown in Swagger as an APIKey security scheme — the Authorize dialog
    lets you paste the key once and it's sent on every 'Try it out'."""
    if not INTERNAL_API_KEY or not x_api_key or x_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")
    return "internal"


# ============== HEALTH CHECKS ==============

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "gateway"}


@app.get("/api/health/all")
async def health_all():
    """Aggregate health check.

    Intentionally does NOT expose service names, versions, database status,
    or error messages to unauthenticated callers — only a boolean aggregate.
    """
    service_urls = [WARDROBE_SERVICE_URL, IMAGE_SERVICE_URL, OUTFIT_SERVICE_URL]
    all_healthy = True
    for url in service_urls:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{url}/health")
                payload = response.json()
                if payload.get("status") != "healthy":
                    all_healthy = False
                    break
        except Exception:
            all_healthy = False
            break

    return {"success": True, "all_healthy": all_healthy}


# ============== IMAGE PROCESSING ROUTES ==============

@app.post("/api/images/process")
async def process_image(
    image: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Process image - remove background. Requires JWT from logged-in user."""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    content = await image.read()
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            response = await client.post(
                f"{IMAGE_SERVICE_URL}/images/process",
                files=files,
                headers={"Authorization": authorization},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Image service unavailable: {str(e)}", 503)


# ============== AUTH ROUTES (JSON or Form) ==============

@app.post("/api/auth/register")
async def register(request: Request):
    """Register a new user"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        password = data.get("password")
        confirm_password = data.get("confirm_password")
        full_name = data.get("full_name")

        if not all([email, password, confirm_password, full_name]):
            return create_error_response("MISSING_FIELDS", "All fields are required", 400)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/register",
                data={"email": email, "password": password,
                      "confirm_password": confirm_password, "full_name": full_name}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/login")
async def login(request: Request):
    """Login with email and password"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        password = data.get("password")

        if not all([email, password]):
            return create_error_response("MISSING_FIELDS", "Email and password are required", 400)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/login",
                data={"email": email, "password": password}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/forgot-password")
async def forgot_password(request: Request):
    """Request password reset"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        if not email:
            return create_error_response("MISSING_FIELDS", "Email is required", 400)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/forgot-password",
                data={"email": email}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/reset-password")
async def reset_password(request: Request):
    """Reset password with token"""
    try:
        data = await get_body_data(request)
        token = data.get("token")
        new_password = data.get("new_password")
        confirm_password = data.get("confirm_password")

        if not all([token, new_password, confirm_password]):
            return create_error_response("MISSING_FIELDS", "All fields are required", 400)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/reset-password",
                data={"token": token, "new_password": new_password,
                      "confirm_password": confirm_password}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.get("/api/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Get current user info"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{WARDROBE_SERVICE_URL}/auth/me",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/logout")
async def logout(request: Request, authorization: Optional[str] = Header(None)):
    """Logout user. Forwards optional refresh_token so wardrobe_service can revoke it."""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        data = await get_body_data(request)
    except Exception:
        data = {}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            form: dict = {}
            if data.get("refresh_token"):
                form["refresh_token"] = data["refresh_token"]
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/logout",
                data=form or None,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/refresh")
async def refresh_token(request: Request):
    """Exchange a refresh token for a new access + refresh pair."""
    try:
        data = await get_body_data(request)
        refresh_token_value = data.get("refresh_token") or data.get("refreshToken")
        if not refresh_token_value:
            return create_error_response("MISSING_FIELDS", "refresh_token is required", 400)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/refresh",
                data={"refresh_token": refresh_token_value},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


# ============== AVATAR ROUTES (Protected) ==============

@app.put("/api/auth/avatar")
async def update_avatar(
    authorization: Optional[str] = Header(None),
    avatar: UploadFile = File(...),
):
    """Upload or replace the user's profile picture (proxied to wardrobe_service)"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    content = await avatar.read()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"avatar": (avatar.filename, content, avatar.content_type)}
            response = await client.put(
                f"{WARDROBE_SERVICE_URL}/auth/avatar",
                files=files,
                headers={"Authorization": authorization},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.delete("/api/auth/avatar")
async def delete_avatar(authorization: Optional[str] = Header(None)):
    """Remove the user's profile picture (proxied to wardrobe_service)"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{WARDROBE_SERVICE_URL}/auth/avatar",
                headers={"Authorization": authorization},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/verify-email")
async def verify_email(request: Request):
    """Verify email with OTP code (registration)"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        code = data.get("code")
        if not all([email, code]):
            return create_error_response("MISSING_FIELDS", "Email and verification code are required", 400)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/verify-email",
                data={"email": email, "code": code}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/verify-login")
async def verify_login(request: Request):
    """Verify login OTP code"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        code = data.get("code")
        if not all([email, code]):
            return create_error_response("MISSING_FIELDS", "Email and verification code are required", 400)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/verify-login",
                data={"email": email, "code": code}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/resend-code")
async def resend_code(request: Request):
    """Resend OTP verification code"""
    try:
        data = await get_body_data(request)
        email = data.get("email")
        purpose = data.get("purpose", "register")
        if not email:
            return create_error_response("MISSING_FIELDS", "Email is required", 400)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/resend-code",
                data={"email": email, "purpose": purpose}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except Exception as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


# ============== WARDROBE ROUTES (Protected) ==============

@app.get("/api/wardrobe/items")
async def get_items(authorization: Optional[str] = Header(None)):
    """Get all clothing items for current user"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{WARDROBE_SERVICE_URL}/items",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


@app.get("/api/wardrobe/items/{item_id}")
async def get_item(item_id: str, authorization: Optional[str] = Header(None)):
    """Get a single clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{WARDROBE_SERVICE_URL}/items/{item_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


@app.post("/api/wardrobe/verify-image")
async def verify_image(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Gemini-check an already-processed image URL before the user confirms it.
    Rejects non-clothing images and poor bg-removal masks up front."""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/items/verify",
                json=body,
                headers={"Authorization": authorization},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


@app.post("/api/wardrobe/items")
async def create_item(
    authorization: Optional[str] = Header(None),
    image: UploadFile = File(...),
    item_name: Optional[str] = Form(None),
    season: Optional[str] = Form(None),
):
    """Create a new clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    content = await image.read()
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            data = {}
            if item_name is not None:
                data["item_name"] = item_name
            if season is not None:
                data["season"] = season
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/items",
                files=files,
                data=data,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


@app.put("/api/wardrobe/items/{item_id}")
async def update_item(
    item_id: str,
    authorization: Optional[str] = Header(None),
    image: Optional[UploadFile] = File(None),
    item_name: Optional[str] = Form(None),
    season: Optional[str] = Form(None),
):
    """Update a clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {}
            data = {}
            if image:
                content = await image.read()
                files["image"] = (image.filename, content, image.content_type)
            if item_name is not None:
                data["item_name"] = item_name
            if season is not None:
                data["season"] = season

            response = await client.put(
                f"{WARDROBE_SERVICE_URL}/items/{item_id}",
                files=files if files else None,
                data=data if data else None,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


@app.delete("/api/wardrobe/items/{item_id}")
async def delete_item(item_id: str, authorization: Optional[str] = Header(None)):
    """Delete a clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{WARDROBE_SERVICE_URL}/items/{item_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Wardrobe service unavailable: {str(e)}", 503)


# ============== OUTFIT ROUTES (Protected) ==============

@app.get("/api/outfits/items/{item_id}/attributes")
async def get_item_attributes(item_id: str, authorization: Optional[str] = Header(None)):
    """Get AI-analyzed attributes for a clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{OUTFIT_SERVICE_URL}/analyze/{item_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.post("/api/outfits/items/{item_id}/reanalyze")
async def reanalyze_item(
    item_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Force re-analysis of a clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OUTFIT_SERVICE_URL}/analyze/{item_id}/reanalyze",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.post("/api/outfits/generate")
async def generate_outfits(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Generate AI-powered outfit combinations"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OUTFIT_SERVICE_URL}/outfits/generate",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.post("/api/outfits/save")
async def save_outfit(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Save a generated outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OUTFIT_SERVICE_URL}/outfits/save",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.get("/api/outfits")
async def get_outfits(authorization: Optional[str] = Header(None)):
    """Get all saved outfits"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{OUTFIT_SERVICE_URL}/outfits",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.get("/api/outfits/{outfit_id}")
async def get_outfit(outfit_id: str, authorization: Optional[str] = Header(None)):
    """Get a single outfit with item details"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{OUTFIT_SERVICE_URL}/outfits/{outfit_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.put("/api/outfits/{outfit_id}/favorite")
async def toggle_favorite(outfit_id: str, authorization: Optional[str] = Header(None)):
    """Toggle outfit favorite status"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{OUTFIT_SERVICE_URL}/outfits/{outfit_id}/favorite",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.delete("/api/outfits/{outfit_id}")
async def delete_outfit(outfit_id: str, authorization: Optional[str] = Header(None)):
    """Delete a saved outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{OUTFIT_SERVICE_URL}/outfits/{outfit_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


@app.get("/api/outfits/wardrobe/stats")
async def get_wardrobe_stats(authorization: Optional[str] = Header(None)):
    """Get wardrobe analytics and stats"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{OUTFIT_SERVICE_URL}/wardrobe/stats",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Outfit service unavailable: {str(e)}", 503)


# ============== COMMUNITY ROUTES (Protected) ==============

@app.post("/api/community/share")
async def share_outfit(request: Request, authorization: Optional[str] = Header(None)):
    """Share an outfit to the community"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/community/share",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/feed")
async def get_community_feed(
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(None),
):
    """Get community feed"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/feed",
                params={"page": page, "limit": limit},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/users/search")
async def search_users(
    q: str = "",
    authorization: Optional[str] = Header(None),
):
    """Search users for @mention"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/users/search",
                params={"q": q},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/users/{profile_user_id}")
async def get_user_profile(
    profile_user_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get user community profile"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/users/{profile_user_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/top-rated")
async def get_top_rated(
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(None),
):
    """Get top-rated shared outfits"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/top-rated",
                params={"page": page, "limit": limit},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/notifications")
async def get_notifications(
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(None),
):
    """Get user notifications"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/notifications",
                params={"page": page, "limit": limit},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.put("/api/community/notifications/read")
async def mark_notifications_read(authorization: Optional[str] = Header(None)):
    """Mark all notifications as read"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                f"{COMMUNITY_SERVICE_URL}/community/notifications/read",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/favorites")
async def get_favorites(
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(None),
):
    """Get user's favorited community outfits"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/favorites",
                params={"page": page, "limit": limit},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


# DELETE comment must come BEFORE /{shared_outfit_id} to avoid path conflict
@app.delete("/api/community/comments/{comment_id}")
async def delete_comment(comment_id: str, authorization: Optional[str] = Header(None)):
    """Delete a comment"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{COMMUNITY_SERVICE_URL}/community/comments/{comment_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.delete("/api/community/{shared_outfit_id}")
async def unshare_outfit(shared_outfit_id: str, authorization: Optional[str] = Header(None)):
    """Unshare an outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.post("/api/community/{shared_outfit_id}/favorite")
async def toggle_favorite(
    shared_outfit_id: str,
    authorization: Optional[str] = Header(None),
):
    """Toggle favorite on a shared outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}/favorite",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.post("/api/community/{shared_outfit_id}/rate")
async def rate_outfit(
    shared_outfit_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Rate a shared outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}/rate",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.post("/api/community/{shared_outfit_id}/react")
async def react_to_outfit(
    shared_outfit_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """React with emoji to a shared outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}/react",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/community/{shared_outfit_id}/comments")
async def get_comments(
    shared_outfit_id: str,
    page: int = 1,
    limit: int = 20,
    authorization: Optional[str] = Header(None),
):
    """Get comments for a shared outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}/comments",
                params={"page": page, "limit": limit},
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.post("/api/community/{shared_outfit_id}/comments")
async def add_comment(
    shared_outfit_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Add a comment to a shared outfit"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        body = await get_body_data(request)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/community/{shared_outfit_id}/comments",
                json=body,
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


# ============== PRIVILEGED ROUTES (X-API-Key gated) ==============
# Gateway enforces X-API-Key match on /api/admin/*. Community service
# re-checks the same key (defense-in-depth).

@app.post("/api/admin/users/{target_user_id}/reset-strikes")
async def admin_reset_strikes(
    target_user_id: str,
    _: str = Depends(require_internal_key),
):
    """Reset a user's comment strikes + lift any active or permanent ban.
    Requires X-API-Key header matching INTERNAL_API_KEY."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{COMMUNITY_SERVICE_URL}/admin/users/{target_user_id}/reset-strikes",
                headers={"X-API-Key": INTERNAL_API_KEY},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


@app.get("/api/admin/moderation-logs")
async def admin_moderation_logs(
    limit: int = 50,
    offset: int = 0,
    _: str = Depends(require_internal_key),
):
    """View paginated moderation logs (most recent first).
    Requires X-API-Key header matching INTERNAL_API_KEY."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{COMMUNITY_SERVICE_URL}/admin/moderation-logs",
                params={"limit": limit, "offset": offset},
                headers={"X-API-Key": INTERNAL_API_KEY},
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Community service unavailable: {str(e)}", 503)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)