"""
Image Processing Service - Port 3002
Handles image uploads and background removal using rembg
"""
import os
import uuid
import io
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from rembg import remove

# Configuration
STORAGE_PATH = os.getenv("STORAGE_PATH", "./storage")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Create storage directories
Path(f"{STORAGE_PATH}/original").mkdir(parents=True, exist_ok=True)
Path(f"{STORAGE_PATH}/processed").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Handles image uploads and background removal",
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


def validate_image_file(file: UploadFile) -> Optional[str]:
    """Validate uploaded image file, returns error message or None"""
    if not file.filename:
        return "No filename provided"
    
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    return None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "image-processing"}


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    """
    Process image - save original and remove background
    
    Returns URLs for both original and processed images
    """
    # Validate file
    error = validate_image_file(image)
    if error:
        return create_error_response("INVALID_FILE_TYPE", error)
    
    # Read file content
    content = await image.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        return create_error_response(
            "FILE_TOO_LARGE",
            f"File exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_ext = Path(image.filename).suffix.lower()
        original_filename = f"{file_id}{original_ext}"
        processed_filename = f"{file_id}.png"
        
        # Save original image
        original_path = Path(f"{STORAGE_PATH}/original/{original_filename}")
        with open(original_path, "wb") as f:
            f.write(content)
        
        # Process image - remove background
        input_image = Image.open(io.BytesIO(content))
        output_image = remove(input_image)
        
        # Save processed image as PNG (for transparency)
        processed_path = Path(f"{STORAGE_PATH}/processed/{processed_filename}")
        output_image.save(processed_path, "PNG")
        
        # Get processed file size
        processed_size = processed_path.stat().st_size
        
        return {
            "success": True,
            "data": {
                "original_url": f"{BASE_URL}/storage/original/{original_filename}",
                "processed_url": f"{BASE_URL}/storage/processed/{processed_filename}",
                "file_name": processed_filename,
                "file_size": processed_size
            }
        }
        
    except Exception as e:
        return create_error_response(
            "PROCESSING_FAILED",
            f"Failed to process image: {str(e)}",
            status_code=500
        )


@app.delete("/images/{filename}")
async def delete_image(
    filename: str,
    type: str = Query(..., description="Type: 'original', 'processed', or 'both'")
):
    """
    Delete image file(s)
    
    - type=original: Delete only original image
    - type=processed: Delete only processed image  
    - type=both: Delete both original and processed images
    """
    if type not in ["original", "processed", "both"]:
        return create_error_response(
            "INVALID_INPUT",
            "Type must be 'original', 'processed', or 'both'"
        )
    
    deleted_files = []
    errors = []
    
    # Get base filename without extension
    base_name = Path(filename).stem
    
    if type in ["original", "both"]:
        # Try to find and delete original (could be any extension)
        original_dir = Path(f"{STORAGE_PATH}/original")
        for ext in ALLOWED_EXTENSIONS:
            original_path = original_dir / f"{base_name}{ext}"
            if original_path.exists():
                try:
                    original_path.unlink()
                    deleted_files.append(f"original/{base_name}{ext}")
                except Exception as e:
                    errors.append(f"Failed to delete original: {str(e)}")
                break
    
    if type in ["processed", "both"]:
        processed_path = Path(f"{STORAGE_PATH}/processed/{base_name}.png")
        if processed_path.exists():
            try:
                processed_path.unlink()
                deleted_files.append(f"processed/{base_name}.png")
            except Exception as e:
                errors.append(f"Failed to delete processed: {str(e)}")
    
    if errors and not deleted_files:
        return create_error_response(
            "SERVER_ERROR",
            "; ".join(errors),
            status_code=500
        )
    
    return {
        "success": True,
        "message": "Image(s) deleted successfully",
        "deleted": deleted_files
    }


# Serve static files for stored images
from fastapi.staticfiles import StaticFiles
app.mount("/storage", StaticFiles(directory=STORAGE_PATH), name="storage")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)
