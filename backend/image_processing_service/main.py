"""
Image Processing Service - Railway Compatible
Returns base64 encoded images - no persistent storage required
Dual-model: auto-detects person vs plain clothing
v4.0: async executor + alpha matting for better performance and edge quality
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

# ── Load both models at startup ──────────────────────────────────────────────
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

# Thread pool: rembg inference is CPU-bound and blocks the event loop.
# Running it in an executor lets FastAPI handle other requests during processing.
EXECUTOR = ThreadPoolExecutor(max_workers=2)


# ── Helpers ───────────────────────────────────────────────────────────────────

def has_person(image: Image.Image, skin_threshold: float = 0.04) -> bool:
    """
    Lightweight skin-tone heuristic.
    If >4% of pixels are skin-toned → likely a person is wearing the clothing.
    """
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
    logger.info(f"Skin ratio detected: {skin_ratio:.3f}")
    return skin_ratio > skin_threshold


def is_low_contrast(image: Image.Image, threshold: float = 0.15) -> bool:
    """
    Detects low-contrast images (e.g. white item on white background).
    Returns True if std deviation of grayscale is below threshold.
    """
    gray = np.array(image.convert("L"), dtype=np.float32) / 255.0
    return float(gray.std()) < threshold


def preprocess_image(image: Image.Image, low_contrast: bool) -> Image.Image:
    """
    For low-contrast images: sharpen + boost contrast so the model
    can better distinguish foreground from background.
    """
    if low_contrast:
        image = image.filter(ImageFilter.SHARPEN)
        image = ImageEnhance.Contrast(image).enhance(1.8)
        image = ImageEnhance.Sharpness(image).enhance(2.0)
        logger.info("Low contrast detected — applied sharpen + contrast boost")
    return image


def remove_background_sync(image: Image.Image, session, use_alpha_matting: bool) -> Image.Image:
    """
    Synchronous background removal — runs in thread pool.
    alpha_matting improves edge quality for tricky cases (light items, fine details).
    """
    if use_alpha_matting:
        return remove(
            image,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )
    return remove(image, session=session)


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Handles image uploads and background removal",
    version="4.0.0",
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
        "models": {
            "human_seg": SESSION_HUMAN is not None,
            "cloth_seg": SESSION_CLOTH is not None,
        }
    }


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    if SESSION_HUMAN is None and SESSION_CLOTH is None:
        return create_error_response(
            "MODEL_NOT_LOADED",
            "Both background removal models failed to load. Check service logs.",
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

        input_image = Image.open(io.BytesIO(content)).convert("RGBA")

        # ── Detect image characteristics ──────────────────────────────────────
        person_detected = has_person(input_image)
        low_contrast    = is_low_contrast(input_image)

        # ── Select model ──────────────────────────────────────────────────────
        if person_detected and SESSION_HUMAN is not None:
            session    = SESSION_HUMAN
            model_used = "u2net_human_seg"
        elif SESSION_CLOTH is not None:
            session    = SESSION_CLOTH
            model_used = "u2net_cloth_seg"
        else:
            session    = SESSION_HUMAN or SESSION_CLOTH
            model_used = "fallback"

        logger.info(
            f"Person: {person_detected}, Low contrast: {low_contrast} "
            f"→ model: {model_used}, alpha_matting: {low_contrast}"
        )

        # ── Preprocess ────────────────────────────────────────────────────────
        processed_input = preprocess_image(input_image, low_contrast)

        # ── Remove background (non-blocking) ──────────────────────────────────
        # rembg is CPU-bound — running in executor prevents blocking other requests
        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            processed_input,
            session,
            low_contrast,  # alpha matting only when needed (slower but better edges)
        )

        # ── Encode original ───────────────────────────────────────────────────
        original_b64      = base64.b64encode(content).decode("utf-8")
        original_mime     = "image/png" if original_ext == ".png" else "image/jpeg"
        original_data_url = f"data:{original_mime};base64,{original_b64}"

        # ── Encode processed ──────────────────────────────────────────────────
        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="PNG")
        processed_bytes   = processed_buffer.getvalue()
        processed_b64     = base64.b64encode(processed_bytes).decode("utf-8")
        processed_data_url = f"data:image/png;base64,{processed_b64}"

        logger.info(f"Successfully processed image {file_id} with {model_used}")

        return {
            "success": True,
            "data": {
                "original_url":      original_data_url,
                "processed_url":     processed_data_url,
                "file_name":         f"{file_id}.png",
                "file_size":         len(processed_bytes),
                "model_used":        model_used,
                "person_detected":   person_detected,
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