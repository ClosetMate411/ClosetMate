"""
API Gateway - Routes requests to appropriate services
Full authentication support + Image Processing + Outfit Service
Accepts both JSON and Form data for auth endpoints
"""
import os
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Service URLs
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")

app = FastAPI(
    title="ClosetMate API Gateway",
    description="API Gateway for ClosetMate microservices",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# ============== HEALTH CHECKS ==============

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "gateway"}


@app.get("/api/health/all")
async def health_all():
    """Check health of all services"""
    results = {"gateway": {"status": "healthy"}}

    services = {
        "wardrobe": WARDROBE_SERVICE_URL,
        "image_processing": IMAGE_SERVICE_URL,
        "outfit": OUTFIT_SERVICE_URL,
    }

    for name, url in services.items():
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{url}/health")
                results[name] = response.json()
        except Exception as e:
            results[name] = {"status": "unhealthy", "error": str(e)}

    all_healthy = all(s.get("status") == "healthy" for s in results.values())
    return {"success": True, "all_healthy": all_healthy, "services": results}


# ============== IMAGE PROCESSING ROUTES ==============

@app.post("/api/images/process")
async def process_image(image: UploadFile = File(...)):
    """Process image - remove background"""
    content = await image.read()
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
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
async def logout(authorization: Optional[str] = Header(None)):
    """Logout user"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/logout",
                headers={"Authorization": authorization}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
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


@app.post("/api/wardrobe/items")
async def create_item(
    authorization: Optional[str] = Header(None),
    image: UploadFile = File(...),
    item_name: str = Form("Untitled"),
    season: str = Form("Untitled")
):
    """Create a new clothing item"""
    if not authorization:
        return create_error_response("UNAUTHORIZED", "Authorization header required", 401)
    content = await image.read()
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            files = {"image": (image.filename, content, image.content_type)}
            data = {"item_name": item_name, "season": season}
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/items",
                files=files, data=data,
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
    season: Optional[str] = Form(None)
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)