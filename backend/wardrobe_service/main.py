"""
Wardrobe Service - Port 3001
Manages clothing items CRUD operations
"""
import os
import sys
import httpx
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

# Add shared module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.database import get_db, engine, Base
from shared.models import ClothingItem
from shared.schemas import SeasonEnum

# Create tables
Base.metadata.create_all(bind=engine)

# Configuration
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")

app = FastAPI(
    title="ClosetMate Wardrobe Service",
    description="Manages clothing items CRUD operations",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_error_response(code: str, message: str, status_code: int = 400):
    """Create standardized error response"""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message
            }
        }
    )


def validate_season(season: Optional[str]) -> str:
    """Validate and normalize season value"""
    if not season:
        return "Untitled"
    
    valid_seasons = ["Spring", "Summer", "Fall", "Winter", "Untitled"]
    # Case-insensitive matching
    for valid in valid_seasons:
        if season.lower() == valid.lower():
            return valid
    
    return "Untitled"


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "wardrobe"}


@app.get("/items")
async def get_all_items(db: Session = Depends(get_db)):
    """Get all clothing items"""
    items = db.query(ClothingItem).order_by(ClothingItem.created_at.desc()).all()
    return {
        "success": True,
        "data": [item.to_dict() for item in items]
    }


@app.get("/items/{item_id}")
async def get_item(item_id: str, db: Session = Depends(get_db)):
    """Get single clothing item by ID"""
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", status_code=404)
    
    return {
        "success": True,
        "data": item.to_dict()
    }


@app.post("/items")
async def create_item(
    image: UploadFile = File(...),
    item_name: Optional[str] = Form(default="Untitled"),
    season: Optional[str] = Form(default="Untitled"),
    db: Session = Depends(get_db)
):
    """
    Create new clothing item
    
    1. Forward image to Image Processing Service
    2. Save item to database with processed image URLs
    """
    # Validate season
    validated_season = validate_season(season)
    
    # Forward image to Image Processing Service
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Read file content
            content = await image.read()
            
            files = {
                "image": (image.filename, content, image.content_type)
            }
            
            response = await client.post(
                f"{IMAGE_SERVICE_URL}/images/process",
                files=files
            )
            
            result = response.json()
            
            if not result.get("success"):
                error = result.get("error", {})
                return create_error_response(
                    error.get("code", "PROCESSING_FAILED"),
                    error.get("message", "Image processing failed")
                )
            
            image_data = result["data"]
            
    except httpx.RequestError as e:
        return create_error_response(
            "SERVER_ERROR",
            f"Failed to connect to image processing service: {str(e)}",
            status_code=503
        )
    
    # Create database record
    try:
        new_item = ClothingItem(
            item_name=item_name or "Untitled",
            season=validated_season,
            image_url=image_data["processed_url"],
            original_image_url=image_data["original_url"],
            file_name=image_data["file_name"],
            file_size=image_data["file_size"]
        )
        
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        
        return {
            "success": True,
            "data": new_item.to_dict()
        }
        
    except Exception as e:
        db.rollback()
        return create_error_response(
            "SERVER_ERROR",
            f"Failed to save item: {str(e)}",
            status_code=500
        )


@app.put("/items/{item_id}")
async def update_item(
    item_id: str,
    image: Optional[UploadFile] = File(default=None),
    item_name: Optional[str] = Form(default=None),
    season: Optional[str] = Form(default=None),
    db: Session = Depends(get_db)
):
    """
    Update existing clothing item
    
    - Can update name, season, and/or image
    - If new image provided, processes it and updates URLs
    """
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", status_code=404)
    
    # Update fields if provided
    if item_name is not None:
        item.item_name = item_name
    
    if season is not None:
        item.season = validate_season(season)
    
    # Process new image if provided
    if image and image.filename:
        try:
            # Delete old images first
            old_filename = item.file_name
            if old_filename:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    await client.delete(
                        f"{IMAGE_SERVICE_URL}/images/{old_filename}",
                        params={"type": "both"}
                    )
            
            # Process new image
            async with httpx.AsyncClient(timeout=60.0) as client:
                content = await image.read()
                files = {
                    "image": (image.filename, content, image.content_type)
                }
                
                response = await client.post(
                    f"{IMAGE_SERVICE_URL}/images/process",
                    files=files
                )
                
                result = response.json()
                
                if not result.get("success"):
                    error = result.get("error", {})
                    return create_error_response(
                        error.get("code", "PROCESSING_FAILED"),
                        error.get("message", "Image processing failed")
                    )
                
                image_data = result["data"]
                
                item.image_url = image_data["processed_url"]
                item.original_image_url = image_data["original_url"]
                item.file_name = image_data["file_name"]
                item.file_size = image_data["file_size"]
                
        except httpx.RequestError as e:
            return create_error_response(
                "SERVER_ERROR",
                f"Failed to connect to image processing service: {str(e)}",
                status_code=503
            )
    
    try:
        db.commit()
        db.refresh(item)
        
        return {
            "success": True,
            "data": item.to_dict()
        }
        
    except Exception as e:
        db.rollback()
        return create_error_response(
            "SERVER_ERROR",
            f"Failed to update item: {str(e)}",
            status_code=500
        )


@app.delete("/items/{item_id}")
async def delete_item(item_id: str, db: Session = Depends(get_db)):
    """
    Delete clothing item
    
    1. Delete associated images from storage
    2. Delete database record
    """
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", status_code=404)
    
    # Delete images from storage
    if item.file_name:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.delete(
                    f"{IMAGE_SERVICE_URL}/images/{item.file_name}",
                    params={"type": "both"}
                )
        except httpx.RequestError:
            # Log error but continue with database deletion
            pass
    
    # Delete from database
    try:
        db.delete(item)
        db.commit()
        
        return {
            "success": True,
            "message": "Item deleted successfully"
        }
        
    except Exception as e:
        db.rollback()
        return create_error_response(
            "SERVER_ERROR",
            f"Failed to delete item: {str(e)}",
            status_code=500
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
