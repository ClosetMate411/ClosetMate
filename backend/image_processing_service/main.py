"""
Image Processing Service - Railway Compatible
v5.0: 3-model routing — human_seg / cloth_seg / u2net general
- person detected       → u2net_human_seg
- clothing (top/bottom) → u2net_cloth_seg
- footwear/accessories  → u2net (general purpose)
"""
import os
import uuid
import io
import base64
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageEnhance, ImageFilter
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ── Load all 3 models at startup ─────────────────────────────────────────────
logger.info("Loading u2net_human_seg model...")
try:
    SESSION_HUMAN = new_session("u2net_human_seg")
    logger.info("u2net_human_seg loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net_human_seg: {e}")
    SESSION_HUMAN = None

logger.info("Loading u2net_cloth_seg model...")
try:
    SESSION_CLOTH = new_session("u2net_cloth_seg")
    logger.info("u2net_cloth_seg loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net_cloth_seg: {e}")
    SESSION_CLOTH = None

logger.info("Loading u2net (general) model...")
try:
    SESSION_GENERAL = new_session("u2net")
    logger.info("u2net general loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net general: {e}")
    SESSION_GENERAL = None

# Thread pool: rembg inference is CPU-bound, runs in executor to avoid blocking
EXECUTOR = ThreadPoolExecutor(max_workers=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def has_person(image: Image.Image, skin_threshold: float = 0.04) -> bool:
    """Skin-tone pixel ratio heuristic. >4% → person detected."""
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    skin_mask = (
        (r > 60) & (r < 255) &
        (g > 40) & (g < 220) &
        (b > 20) & (b < 195) &
        (r > g) & (r > b) &
        (r - g > 10) &
        (np.abs(r.astype(np.int32) - b.astype(np.int32)) > 10)
    )

    skin_ratio = float(skin_mask.sum()) / (arr.shape[0] * arr.shape[1])
    logger.info(f"Skin ratio: {skin_ratio:.3f}")
    return skin_ratio > skin_threshold


def is_clothing_shape(image: Image.Image) -> bool:
    """
    Heuristic: clothing items (tops/bottoms) tend to be taller than wide
    and occupy a large central area.
    Footwear/accessories tend to be wider than tall or small.
    Returns True if likely clothing, False if likely footwear/accessory.
    """
    w, h = image.size
    aspect_ratio = h / w  # >1.0 means portrait (likely clothing), <1.0 landscape (likely shoe/bag)
    return aspect_ratio > 0.85


def is_low_contrast(image: Image.Image, threshold: float = 0.20) -> bool:
    """
    Low contrast = foreground and background have similar brightness.
    Raised threshold to 0.20 to catch more edge cases like white shoes.
    """
    gray = np.array(image.convert("L"), dtype=np.float32) / 255.0
    std = float(gray.std())
    logger.info(f"Grayscale std (contrast): {std:.3f}")
    return std < threshold


def preprocess_image(image: Image.Image, low_contrast: bool) -> Image.Image:
    """Sharpen + boost contrast for low-contrast images before removal."""
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
    """CPU-bound background removal — runs in thread pool executor."""
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
    description="Handles image uploads and background removal",
    version="5.0.0",
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
        "version": "5.0.0",
        "models": {
            "human_seg":  SESSION_HUMAN is not None,
            "cloth_seg":  SESSION_CLOTH is not None,
            "general":    SESSION_GENERAL is not None,
        }
    }


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    if all(s is None for s in [SESSION_HUMAN, SESSION_CLOTH, SESSION_GENERAL]):
        return create_error_response(
            "MODEL_NOT_LOADED",
            "All background removal models failed to load.",
            503
        )

    error = validate_image_file(image)
    if error:
        return create_error_response("INVALID_FILE_TYPE", error)

    content = await image.read()
    if len(content) > MAX_FILE_SIZE:
        return create_error_response("FILE_TOO_LARGE", "File exceeds 5MB limit")

    try:
        file_id      = str(uuid.uuid4())
        original_ext = Path(image.filename).suffix.lower()

        logger.info(f"Processing: {image.filename} ({len(content)} bytes)")

        input_image = Image.open(io.BytesIO(content)).convert("RGBA")

        # ── Detect image characteristics ──────────────────────────────────────
        person_detected  = has_person(input_image)
        clothing_shape   = is_clothing_shape(input_image)
        low_contrast     = is_low_contrast(input_image)

        # ── Route to correct model ────────────────────────────────────────────
        # 1. Person wearing clothing → human_seg
        # 2. Clothing product photo (portrait aspect) → cloth_seg
        # 3. Footwear, accessories, bags (landscape/square) → u2net general
        if person_detected and SESSION_HUMAN is not None:
            session    = SESSION_HUMAN
            model_used = "u2net_human_seg"
        elif clothing_shape and SESSION_CLOTH is not None:
            session    = SESSION_CLOTH
            model_used = "u2net_cloth_seg"
        elif SESSION_GENERAL is not None:
            session    = SESSION_GENERAL
            model_used = "u2net_general"
        else:
            session    = SESSION_HUMAN or SESSION_CLOTH
            model_used = "fallback"

        logger.info(
            f"Person: {person_detected}, Clothing shape: {clothing_shape}, "
            f"Low contrast: {low_contrast} → model: {model_used}, "
            f"alpha_matting: {low_contrast}"
        )

        # ── Preprocess ────────────────────────────────────────────────────────
        processed_input = preprocess_image(input_image, low_contrast)

        # ── Remove background (non-blocking) ──────────────────────────────────
        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            processed_input,
            session,
            low_contrast,
        )

        # ── Encode original ───────────────────────────────────────────────────
        original_b64      = base64.b64encode(content).decode("utf-8")
        original_mime     = "image/png" if original_ext == ".png" else "image/jpeg"
        original_data_url = f"data:{original_mime};base64,{original_b64}"

        # ── Encode processed ──────────────────────────────────────────────────
        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="PNG")
        processed_bytes    = processed_buffer.getvalue()
        processed_b64      = base64.b64encode(processed_bytes).decode("utf-8")
        processed_data_url = f"data:image/png;base64,{processed_b64}"

        logger.info(f"Done: {file_id} with {model_used}")

        return {
            "success": True,
            "data": {
                "original_url":       original_data_url,
                "processed_url":      processed_data_url,
                "file_name":          f"{file_id}.png",
                "file_size":          len(processed_bytes),
                "model_used":         model_used,
                "person_detected":    person_detected,
                "alpha_matting_used": low_contrast,
            }
        }

    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return create_error_response("PROCESSING_FAILED", str(e), 500)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)