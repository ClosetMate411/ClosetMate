"""
Image Processing Service - Railway Compatible
v10.0: Similar-color background handling
- Foreground/background color similarity detection (center vs border)
- Edge-aware preprocessing for same-color clothing+background
- Adaptive alpha matting with mask quality gate + retry
- post_process_mask for cleaner edges
- One model: bria-rmbg, file storage, WebP output
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
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE      = 5 * 1024 * 1024  # 5MB
MAX_DIMENSION      = 1024              
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ── Storage config ───────────────────────────────────────────────────────────
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/app/storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002").rstrip("/")

# ── Load single model at startup ─────────────────────────────────────────────
logger.info("Loading bria-rmbg model...")
try:
    SESSION = new_session("bria-rmbg")
    logger.info("bria-rmbg loaded successfully")
except Exception as e:
    logger.error(f"Failed to load bria-rmbg: {e}")
    SESSION = None

# Thread pool: rembg inference is CPU-bound
EXECUTOR = ThreadPoolExecutor(max_workers=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def analyze_difficulty(image: Image.Image) -> dict:
    """Detect foreground/background color similarity + overall contrast."""
    arr = np.array(image)[:, :, :3]
    h, w = arr.shape[:2]

    # Center region = foreground proxy (middle 40%)
    center = arr[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)]
    center_mean = center.reshape(-1, 3).astype(np.float64).mean(axis=0)

    # Border strips = background proxy (outer 10%)
    margin_h = max(int(h * 0.1), 1)
    margin_w = max(int(w * 0.1), 1)
    strips = np.concatenate([
        arr[:margin_h].reshape(-1, 3),
        arr[-margin_h:].reshape(-1, 3),
        arr[:, :margin_w].reshape(-1, 3),
        arr[:, -margin_w:].reshape(-1, 3),
    ])
    border_mean = strips.astype(np.float64).mean(axis=0)

    color_distance = float(np.sqrt(np.sum((center_mean - border_mean) ** 2)))

    gray = np.array(image.convert("L"), dtype=np.float32) / 255.0
    contrast_std = float(gray.std())

    similar_colors = color_distance < 80
    low_contrast = contrast_std < 0.12

    logger.info(
        f"Difficulty — color_dist: {color_distance:.1f}, "
        f"contrast_std: {contrast_std:.3f}, "
        f"similar_colors: {similar_colors}, low_contrast: {low_contrast}"
    )

    return {
        "similar_colors": similar_colors,
        "low_contrast": low_contrast,
        "color_distance": color_distance,
        "needs_enhancement": similar_colors or low_contrast,
    }


def resize_for_inference(image: Image.Image) -> Image.Image:
    """Resize large images before bg removal."""
    if max(image.size) > MAX_DIMENSION:
        image = image.copy()
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
        logger.info(f"Resized to {image.size} for inference")
    return image


def preprocess_image(image: Image.Image, difficulty: dict) -> Image.Image:
    """Edge-aware enhancement based on detected difficulty."""
    if not difficulty["needs_enhancement"]:
        return image

    if difficulty["similar_colors"]:
        # Unsharp mask — amplify subtle edges between garment and background
        blurred = image.filter(ImageFilter.GaussianBlur(radius=2))
        arr = np.array(image, dtype=np.float32)
        blurred_arr = np.array(blurred, dtype=np.float32)
        sharpened = np.clip(arr + 1.5 * (arr - blurred_arr), 0, 255)
        image = Image.fromarray(sharpened.astype(np.uint8), mode=image.mode)

        # Boost saturation to differentiate subtle hue differences
        image = ImageEnhance.Color(image).enhance(1.5)

        # CLAHE-style local contrast via autocontrast on luminance
        image = ImageOps.autocontrast(image, cutoff=1)

        logger.info("Similar colors → unsharp mask + saturation + autocontrast")

    if difficulty["low_contrast"]:
        image = image.filter(ImageFilter.SHARPEN)
        image = ImageEnhance.Contrast(image).enhance(2.0)
        image = ImageEnhance.Sharpness(image).enhance(2.0)
        logger.info("Low contrast → sharpen + contrast boost")

    return image


def remove_background_sync(
    image: Image.Image,
    session,
    difficulty: dict,
) -> Image.Image:
    """Background removal with adaptive strategy and quality gate."""

    if difficulty["needs_enhancement"]:
        # First attempt: alpha matting with relaxed thresholds
        result = remove(
            image,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=230,
            alpha_matting_background_threshold=20,
            alpha_matting_erode_size=8,
            post_process_mask=True,
        )

        # Quality gate — check if mask makes sense
        alpha = np.array(result)[:, :, 3]
        fg_ratio = float(np.mean(alpha > 128))

        if fg_ratio < 0.03 or fg_ratio > 0.97:
            # Mask is nearly empty or nearly full → bad segmentation
            logger.warning(
                f"Mask quality poor (fg_ratio={fg_ratio:.2f}), "
                f"retrying without alpha matting"
            )
            result = remove(image, session=session, post_process_mask=True)

        return result

    return remove(image, session=session, post_process_mask=True)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Background removal for wardrobe items",
    version="10.0.0",
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
        "version": "10.0.0",
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

        # ── Analyze difficulty & preprocess ───────────────────────────────────
        difficulty = analyze_difficulty(input_image)
        processed_input = resize_for_inference(input_image)
        processed_input = preprocess_image(processed_input, difficulty)

        # ── Remove background ─────────────────────────────────────────────────
        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            processed_input,
            SESSION,
            difficulty,
        )

        # ── Save to disk ──────────────────────────────────────────────────────
        file_name = f"{file_id}.webp"
        file_path = STORAGE_PATH / file_name

        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="WEBP", quality=95)
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
