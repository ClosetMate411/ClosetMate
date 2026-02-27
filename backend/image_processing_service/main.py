"""
Image Processing Service - Railway Compatible
v8.0: Single model, maximum simplicity
- One model: u2net general — handles all cases (flat items, person+clothing)
- No skin detection, no person routing, no edge case bugs
- File-based storage with static serving
- WebP output, resize before inference
"""
import os
import uuid
import io
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance, ImageFilter
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE      = 5 * 1024 * 1024  # 5MB
MAX_DIMENSION      = 800               # resize before inference — ~60% faster
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ── Storage config ───────────────────────────────────────────────────────────
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/app/storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002").rstrip("/")

# ── Load single model at startup ─────────────────────────────────────────────
logger.info("Loading u2net model...")
try:
    SESSION = new_session("u2net")
    logger.info("u2net loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net: {e}")
    SESSION = None

# Thread pool: rembg inference is CPU-bound
EXECUTOR = ThreadPoolExecutor(max_workers=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_low_contrast(image: Image.Image, threshold: float = 0.12) -> bool:
    """Only truly low-contrast items trigger alpha matting."""
    gray = np.array(image.convert("L"), dtype=np.float32) / 255.0
    std  = float(gray.std())
    logger.info(f"Grayscale std (contrast): {std:.3f}")
    return std < threshold


def resize_for_inference(image: Image.Image) -> Image.Image:
    """Resize large images before bg removal — 800px is sufficient for wardrobe."""
    if max(image.size) > MAX_DIMENSION:
        image = image.copy()
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
        logger.info(f"Resized to {image.size} for inference")
    return image


def preprocess_image(image: Image.Image, low_contrast: bool) -> Image.Image:
    """Sharpen + boost contrast for genuinely low-contrast images."""
    if low_contrast:
        image = image.filter(ImageFilter.SHARPEN)
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = ImageEnhance.Sharpness(image).enhance(2.0)
        logger.info("Low contrast → applied sharpen + contrast boost")
    return image


def remove_background_sync(
    image: Image.Image,
    session,
    use_alpha_matting: bool
) -> Image.Image:
    """CPU-bound background removal."""
    if use_alpha_matting:
        return remove(
            image,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=235,
            alpha_matting_background_threshold=15,
            alpha_matting_erode_size=10,
        )
    return remove(image, session=session)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Background removal for wardrobe items",
    version="8.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/files", StaticFiles(directory=str(STORAGE_PATH)), name="files")


@app.middleware("http")
async def add_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/files/"):
        response.headers["Cache-Control"] = "public, max-age=31536000"
    return response


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
        "version": "8.0.0",
        "model_loaded": SESSION is not None,
    }


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    if SESSION is None:
        return create_error_response(
            "MODEL_NOT_LOADED",
            "Background removal model failed to load.",
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
        logger.info(f"Processing: {image.filename} ({len(content)} bytes)")

        input_image = Image.open(io.BytesIO(content)).convert("RGBA")

        # ── Detect & preprocess ───────────────────────────────────────────────
        low_contrast = is_low_contrast(input_image)
        processed_input = resize_for_inference(input_image)
        processed_input = preprocess_image(processed_input, low_contrast)

        # ── Remove background ─────────────────────────────────────────────────
        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            processed_input,
            SESSION,
            low_contrast,
        )

        # ── Save to disk ──────────────────────────────────────────────────────
        file_name = f"{file_id}.webp"
        file_path = STORAGE_PATH / file_name

        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="WEBP", quality=85)
        processed_bytes = processed_buffer.getvalue()

        with open(file_path, "wb") as f:
            f.write(processed_bytes)

        processed_url = f"{BASE_URL}/files/{file_name}"

        logger.info(f"Done: {file_id} | saved: {file_path} ({len(processed_bytes)} bytes)")

        return {
            "success": True,
            "data": {
                "processed_url": processed_url,
                "file_name":     file_name,
                "file_size":     len(processed_bytes),
            }
        }

    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return create_error_response("PROCESSING_FAILED", str(e), 500)


@app.delete("/images/{file_name}")
async def delete_image(file_name: str):
    """Delete a processed image file from storage."""
    file_path = STORAGE_PATH / file_name
    if not file_path.exists():
        return create_error_response("FILE_NOT_FOUND", "File not found", 404)

    file_path.unlink()
    logger.info(f"Deleted: {file_path}")
    return {"success": True, "message": "File deleted"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)