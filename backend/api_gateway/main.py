"""
API Gateway - Routes requests to appropriate services
Full authentication support + Image Processing
Accepts both JSON and Form data for auth endpoints
"""
import os
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form, Header, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

# Service URLs
WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")

app = FastAPI(
    title="ClosetMate API Gateway",
    description="API Gateway for ClosetMate microservices",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== PYDANTIC MODELS ==============

class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


def create_error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}}
    )


# ============== HEALTH CHECKS ==============

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "gateway"}


@app.get("/api/health/all")
async def health_all():
    """Check health of all services"""
    results = {"gateway": {"status": "healthy"}}

    # Check wardrobe service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{WARDROBE_SERVICE_URL}/health")
            results["wardrobe"] = response.json()
    except Exception as e:
        results["wardrobe"] = {"status": "unhealthy", "error": str(e)}
    
    # Check image processing service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{IMAGE_SERVICE_URL}/health")
            results["image_processing"] = response.json()
    except Exception as e:
        results["image_processing"] = {"status": "unhealthy", "error": str(e)}
    
    all_healthy = all(
        s.get("status") == "healthy" 
        for s in results.values()
    )
    
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


# ============== AUTH ROUTES (JSON Body) ==============

@app.post("/api/auth/register")
async def register(body: RegisterRequest):
    """Register a new user"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/register",
                data={
                    "email": body.email,
                    "password": body.password,
                    "confirm_password": body.confirm_password,
                    "full_name": body.full_name
                }
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    """Login with email and password"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/login",
                data={"email": body.email, "password": body.password}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Request password reset"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/forgot-password",
                data={"email": body.email}
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
        return create_error_response("SERVICE_UNAVAILABLE", f"Auth service unavailable: {str(e)}", 503)


@app.post("/api/auth/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Reset password with token"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WARDROBE_SERVICE_URL}/auth/reset-password",
                data={
                    "token": body.token,
                    "new_password": body.new_password,
                    "confirm_password": body.confirm_password
                }
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
    except httpx.RequestError as e:
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)