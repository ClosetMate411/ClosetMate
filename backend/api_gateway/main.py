"""
API Gateway - Standalone for Railway
Routes requests to microservices
"""
import os
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

WARDROBE_SERVICE_URL = os.getenv("WARDROBE_SERVICE_URL", "http://localhost:3001")
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")

app = FastAPI(
    title="ClosetMate API Gateway",
    description="Routes requests to microservices",
    version="1.0.0",
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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "api-gateway"}


@app.get("/api/health/all")
async def all_services_health():
    services = {
        "gateway": {"status": "healthy"},
        "wardrobe": {"status": "unknown"},
        "image_processing": {"status": "unknown"}
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(f"{WARDROBE_SERVICE_URL}/health")
            services["wardrobe"] = response.json()
        except Exception as e:
            services["wardrobe"] = {"status": "unhealthy", "error": str(e)}
        
        try:
            response = await client.get(f"{IMAGE_SERVICE_URL}/health")
            services["image_processing"] = response.json()
        except Exception as e:
            services["image_processing"] = {"status": "unhealthy", "error": str(e)}
    
    all_healthy = all(s.get("status") == "healthy" for s in services.values())
    return {"success": True, "all_healthy": all_healthy, "services": services}


# ===== WARDROBE ROUTES =====

@app.get("/api/wardrobe/items")
async def get_all_items():
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{WARDROBE_SERVICE_URL}/items")
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


@app.get("/api/wardrobe/items/{item_id}")
async def get_item(item_id: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"{WARDROBE_SERVICE_URL}/items/{item_id}")
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


@app.post("/api/wardrobe/items")
async def create_item(
    image: UploadFile = File(...),
    item_name: Optional[str] = Form(default="Untitled"),
    season: Optional[str] = Form(default="Untitled")
):
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            content = await image.read()
            files = {"image": (image.filename, content, image.content_type)}
            data = {"item_name": item_name or "Untitled", "season": season or "Untitled"}
            
            response = await client.post(f"{WARDROBE_SERVICE_URL}/items", files=files, data=data)
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


@app.put("/api/wardrobe/items/{item_id}")
async def update_item(
    item_id: str,
    image: Optional[UploadFile] = File(default=None),
    item_name: Optional[str] = Form(default=None),
    season: Optional[str] = Form(default=None)
):
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            files = {}
            data = {}
            
            if image and image.filename:
                content = await image.read()
                files["image"] = (image.filename, content, image.content_type)
            if item_name is not None:
                data["item_name"] = item_name
            if season is not None:
                data["season"] = season
            
            response = await client.put(
                f"{WARDROBE_SERVICE_URL}/items/{item_id}",
                files=files if files else None,
                data=data if data else None
            )
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


@app.delete("/api/wardrobe/items/{item_id}")
async def delete_item(item_id: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.delete(f"{WARDROBE_SERVICE_URL}/items/{item_id}")
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


# ===== IMAGE ROUTES =====

@app.post("/api/images/process")
async def process_image(image: UploadFile = File(...)):
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            content = await image.read()
            files = {"image": (image.filename, content, image.content_type)}
            response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
            return JSONResponse(status_code=response.status_code, content=response.json())
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Service unavailable: {str(e)}", 503)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
