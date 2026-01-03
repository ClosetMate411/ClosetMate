"""
Wardrobe Service - Standalone for Railway
Manages clothing items CRUD operations
"""
import os
import httpx
from typing import Optional
from uuid import UUID
from datetime import datetime
import uuid as uuid_lib

from fastapi import FastAPI, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Model
class ClothingItem(Base):
    __tablename__ = "clothing_items"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid_lib.uuid4)
    item_name = Column(String(255), nullable=False, default="Untitled")
    season = Column(String(50), default="Untitled")
    image_url = Column(Text, nullable=False)
    original_image_url = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "item_name": self.item_name,
            "season": self.season,
            "image_url": self.image_url,
            "original_image_url": self.original_image_url,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


# Create tables
Base.metadata.create_all(bind=engine)

# Config
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:3002")

app = FastAPI(
    title="ClosetMate Wardrobe Service",
    description="Manages clothing items CRUD operations",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_error_response(code: str, message: str, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}}
    )


def validate_season(season: Optional[str]) -> str:
    valid = ["Spring", "Summer", "Fall", "Winter", "Untitled"]
    if not season:
        return "Untitled"
    for v in valid:
        if season.lower() == v.lower():
            return v
    return "Untitled"


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "wardrobe"}


@app.get("/items")
async def get_all_items(db: Session = Depends(get_db)):
    items = db.query(ClothingItem).order_by(ClothingItem.created_at.desc()).all()
    return {"success": True, "data": [item.to_dict() for item in items]}


@app.get("/items/{item_id}")
async def get_item(item_id: str, db: Session = Depends(get_db)):
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    return {"success": True, "data": item.to_dict()}


@app.post("/items")
async def create_item(
    image: UploadFile = File(...),
    item_name: Optional[str] = Form(default="Untitled"),
    season: Optional[str] = Form(default="Untitled"),
    db: Session = Depends(get_db)
):
    validated_season = validate_season(season)
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            content = await image.read()
            files = {"image": (image.filename, content, image.content_type)}
            
            response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
            result = response.json()
            
            if not result.get("success"):
                error = result.get("error", {})
                return create_error_response(
                    error.get("code", "PROCESSING_FAILED"),
                    error.get("message", "Image processing failed")
                )
            
            image_data = result["data"]
            
    except httpx.RequestError as e:
        return create_error_response("SERVER_ERROR", f"Image service unavailable: {str(e)}", 503)
    
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
        
        return {"success": True, "data": new_item.to_dict()}
        
    except Exception as e:
        db.rollback()
        return create_error_response("SERVER_ERROR", str(e), 500)


@app.put("/items/{item_id}")
async def update_item(
    item_id: str,
    image: Optional[UploadFile] = File(default=None),
    item_name: Optional[str] = Form(default=None),
    season: Optional[str] = Form(default=None),
    db: Session = Depends(get_db)
):
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    if item_name is not None:
        item.item_name = item_name
    if season is not None:
        item.season = validate_season(season)
    
    if image and image.filename:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                if item.file_name:
                    await client.delete(f"{IMAGE_SERVICE_URL}/images/{item.file_name}", params={"type": "both"})
                
                content = await image.read()
                files = {"image": (image.filename, content, image.content_type)}
                response = await client.post(f"{IMAGE_SERVICE_URL}/images/process", files=files)
                result = response.json()
                
                if result.get("success"):
                    image_data = result["data"]
                    item.image_url = image_data["processed_url"]
                    item.original_image_url = image_data["original_url"]
                    item.file_name = image_data["file_name"]
                    item.file_size = image_data["file_size"]
                    
        except httpx.RequestError as e:
            return create_error_response("SERVER_ERROR", f"Image service unavailable: {str(e)}", 503)
    
    try:
        db.commit()
        db.refresh(item)
        return {"success": True, "data": item.to_dict()}
    except Exception as e:
        db.rollback()
        return create_error_response("SERVER_ERROR", str(e), 500)


@app.delete("/items/{item_id}")
async def delete_item(item_id: str, db: Session = Depends(get_db)):
    try:
        uuid_id = UUID(item_id)
    except ValueError:
        return create_error_response("INVALID_INPUT", "Invalid item ID format")
    
    item = db.query(ClothingItem).filter(ClothingItem.id == uuid_id).first()
    if not item:
        return create_error_response("ITEM_NOT_FOUND", "Item not found", 404)
    
    if item.file_name:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.delete(f"{IMAGE_SERVICE_URL}/images/{item.file_name}", params={"type": "both"})
        except:
            pass
    
    try:
        db.delete(item)
        db.commit()
        return {"success": True, "message": "Item deleted successfully"}
    except Exception as e:
        db.rollback()
        return create_error_response("SERVER_ERROR", str(e), 500)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=port)
