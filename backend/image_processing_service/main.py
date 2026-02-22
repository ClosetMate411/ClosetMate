"""
Image Processing Service - Railway Compatible
Returns base64 encoded images - no persistent storage required
"""
import os
import uuid
import io
import base64
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Load model at startup - Railway keeps container alive so this runs once
logger.info("Loading u2net model...")
try:
    SESSION = new_session("u2net")
    logger.info("u2net model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net model: {e}")
    SESSION = None

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Handles image uploads and background removal",
    version="2.0.0",
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


def validate_image_file(file: UploadFile) -> Optional[str]:
    if not file.filename:
        return "No filename provided"
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    return None


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "image-processing",
        "model_loaded": SESSION is not None
    }


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    if SESSION is None:
        return create_error_response(
            "MODEL_NOT_LOADED",
            "Background removal model failed to load. Check service logs.",
            503
        )

    error = validate_image_file(image)
    if error:
        return create_error_response("INVALID_FILE_TYPE", error)

    content = await image.read()

    if len(content) > MAX_FILE_SIZE:
        return create_error_response("FILE_TOO_LARGE", "File exceeds 5MB limit")

    try:
        file_id = str(uuid.uuid4())
        original_ext = Path(image.filename).suffix.lower()

        logger.info(f"Processing image: {image.filename} ({len(content)} bytes)")

        # Encode original as base64
        original_b64 = base64.b64encode(content).decode("utf-8")
        original_mime = "image/png" if original_ext == ".png" else "image/jpeg"
        original_data_url = f"data:{original_mime};base64,{original_b64}"

        # Remove background
        input_image = Image.open(io.BytesIO(content)).convert("RGBA")
        output_image = remove(input_image, session=SESSION)

        # Encode processed as base64
        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="PNG")
        processed_bytes = processed_buffer.getvalue()
        processed_b64 = base64.b64encode(processed_bytes).decode("utf-8")
        processed_data_url = f"data:image/png;base64,{processed_b64}"

        logger.info(f"Successfully processed image {file_id}")

        return {
            "success": True,
            "data": {
                "original_url": original_data_url,
                "processed_url": processed_data_url,
                "file_name": f"{file_id}.png",
                "file_size": len(processed_bytes)
            }
        }

    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return create_error_response("PROCESSING_FAILED", str(e), 500)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)