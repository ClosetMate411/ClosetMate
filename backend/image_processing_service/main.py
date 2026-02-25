"""
Image Processing Service - Railway Compatible
Returns base64 encoded images - no persistent storage required
Dual-model: auto-detects person vs plain clothing
"""
import os
import uuid
import io
import base64
import logging
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ── Load both models at startup ──────────────────────────────────────────────
# u2net_human_seg  → person wearing clothing (cuts person + outfit together)
# u2net_cloth_seg  → plain product photo     (cuts just the garment)
# 8GB RAM on Railway is enough to hold both simultaneously

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


# ── Person detection helper ───────────────────────────────────────────────────

def has_person(image: Image.Image, skin_threshold: float = 0.04) -> bool:
    """
    Lightweight heuristic: checks for skin-tone pixel ratio.
    If >4% of pixels are skin-toned → likely a person is wearing the clothing.
    No heavy ML model needed for this check.
    """
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    # Skin tone range in RGB (covers light to dark skin)
    skin_mask = (
        (r > 60) & (r < 255) &
        (g > 40) & (g < 220) &
        (b > 20) & (b < 195) &
        (r > g) & (r > b) &
        (r - g > 10) &
        (np.abs(r.astype(np.int32) - b.astype(np.int32)) > 10)
    )

    skin_ratio = skin_mask.sum() / (arr.shape[0] * arr.shape[1])
    logger.info(f"Skin ratio detected: {skin_ratio:.3f}")
    return float(skin_ratio) > skin_threshold


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Handles image uploads and background removal",
    version="3.0.0",
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
    # At least one model must be loaded
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

        # ── Auto-select model based on person detection ───────────────────────
        person_detected = has_person(input_image)

        if person_detected and SESSION_HUMAN is not None:
            session = SESSION_HUMAN
            model_used = "u2net_human_seg"
        elif SESSION_CLOTH is not None:
            session = SESSION_CLOTH
            model_used = "u2net_cloth_seg"
        else:
            # Fallback to whichever is available
            session = SESSION_HUMAN or SESSION_CLOTH
            model_used = "fallback"

        logger.info(f"Person detected: {person_detected} → using {model_used}")

        # ── Remove background ─────────────────────────────────────────────────
        output_image = remove(input_image, session=session)

        # ── Encode original as base64 ─────────────────────────────────────────
        original_b64 = base64.b64encode(content).decode("utf-8")
        original_mime = "image/png" if original_ext == ".png" else "image/jpeg"
        original_data_url = f"data:{original_mime};base64,{original_b64}"

        # ── Encode processed as base64 ────────────────────────────────────────
        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="PNG")
        processed_bytes = processed_buffer.getvalue()
        processed_b64 = base64.b64encode(processed_bytes).decode("utf-8")
        processed_data_url = f"data:image/png;base64,{processed_b64}"

        logger.info(f"Successfully processed image {file_id} with {model_used}")

        return {
            "success": True,
            "data": {
                "original_url": original_data_url,
                "processed_url": processed_data_url,
                "file_name": f"{file_id}.png",
                "file_size": len(processed_bytes),
                "model_used": model_used,         # debug için
                "person_detected": person_detected # debug için
            }
        }

    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        return create_error_response("PROCESSING_FAILED", str(e), 500)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3002))
    uvicorn.run(app, host="0.0.0.0", port=port)