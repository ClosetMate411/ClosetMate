"""
Image Processing Service - Railway Compatible
v7.0: File-based storage replaces base64 data URLs
- Processed images saved to disk, served via static endpoint
- No more base64 in JSON responses (~6.7MB → ~50 byte URL)
- Original image NOT stored (only processed/bg-removed)
- HSV-based skin detection for all skin tones
- Person + clothing → human_seg + skin strip → garment only
- Flat items → u2net general → item only
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
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance, ImageFilter
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE      = 5 * 1024 * 1024  # 5MB
MAX_DIMENSION      = 800               # resize before inference — ~60% faster
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ── Storage config ───────────────────────────────────────────────────────────
# STORAGE_PATH: where processed images are saved (Railway volume mount)
# BASE_URL: public URL for constructing download links
#   Railway: set to https://<your-service>.up.railway.app
#   Local:   defaults to http://localhost:3002
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/app/storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002").rstrip("/")

# ── Load 2 models at startup ─────────────────────────────────────────────
logger.info("Loading u2net_human_seg model...")
try:
    SESSION_HUMAN = new_session("u2net_human_seg")
    logger.info("u2net_human_seg loaded successfully")
except Exception as e:
    logger.error(f"Failed to load u2net_human_seg: {e}")
    SESSION_HUMAN = None

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

def detect_skin_mask(rgb_array: np.ndarray) -> np.ndarray:
    """
    HSV-based skin detection that works across ALL skin tones.
    
    RGB heuristics fail on dark skin because they rely on r>g>b relationships
    that don't hold for melanin-rich skin. HSV separates chrominance (hue/sat)
    from luminance (value), so the same hue range covers light → dark skin.
    
    Returns a boolean mask of skin pixels.
    """
    from PIL import Image as _Image

    # Convert to HSV (PIL uses H: 0-179, S: 0-255, V: 0-255 via OpenCV convention)
    # We use PIL's HSV which is H: 0-255, S: 0-255, V: 0-255
    hsv = np.array(_Image.fromarray(rgb_array.astype(np.uint8)).convert("HSV"), dtype=np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # PIL HSV: H is 0-255 (not 0-179 like OpenCV)
    # Skin hue in PIL scale: ~0-35 (reds/oranges/yellows) and ~230-255 (wraps around red)
    # Saturation: >15 (avoids grays/whites) and <200 (avoids neon colors)
    # Value: >20 (covers very dark skin) and <250 (avoids blown-out whites)
    hue_mask = ((h >= 0) & (h <= 35)) | ((h >= 230) & (h <= 255))
    sat_mask = (s >= 15) & (s <= 200)
    val_mask = (v >= 20) & (v <= 250)

    skin = hue_mask & sat_mask & val_mask

    # Secondary RGB check to reduce false positives on brown/tan clothing
    # Skin always has some red dominance even in dark tones
    r, g, b = rgb_array[:, :, 0].astype(np.float32), rgb_array[:, :, 1].astype(np.float32), rgb_array[:, :, 2].astype(np.float32)
    rgb_refine = (r > g - 15) & (r > b - 15)

    return skin & rgb_refine


def has_person(image: Image.Image, skin_threshold: float = 0.04) -> bool:
    """HSV skin-tone pixel ratio heuristic. >4% → person detected."""
    rgb = np.array(image.convert("RGB"))
    skin_mask = detect_skin_mask(rgb)

    skin_ratio = float(skin_mask.sum()) / (rgb.shape[0] * rgb.shape[1])
    logger.info(f"Skin ratio (HSV): {skin_ratio:.3f}")
    return skin_ratio > skin_threshold


def is_low_contrast(image: Image.Image, threshold: float = 0.12) -> bool:
    """
    Tuned to 0.12: only truly low-contrast items trigger alpha matting.
    Avoids unnecessary slowdown on normal items (e.g. white shoe w/ black stripes).
    """
    gray = np.array(image.convert("L"), dtype=np.float32) / 255.0
    std  = float(gray.std())
    logger.info(f"Grayscale std (contrast): {std:.3f}")
    return std < threshold


def resize_for_inference(image: Image.Image) -> Image.Image:
    """
    Resize large images before background removal.
    rembg inference time scales with resolution — 800px is sufficient for wardrobe.
    """
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


def remove_skin_pixels(image: Image.Image) -> Image.Image:
    """
    After background removal, strip remaining skin-tone pixels to isolate clothing.
    Uses HSV-based detection for all skin tones. Works on RGBA — sets alpha=0 for skin.
    """
    arr = np.array(image)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # Only process visible pixels (alpha > 0)
    skin_mask = detect_skin_mask(rgb) & (alpha > 0)

    result = arr.copy()
    result[skin_mask, 3] = 0

    logger.info(f"Skin removal (HSV): zeroed {int(skin_mask.sum())} skin pixels")
    return Image.fromarray(result, "RGBA")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Handles image uploads and background removal",
    version="7.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving for processed images ─────────────────────────────────
app.mount("/files", StaticFiles(directory=str(STORAGE_PATH)), name="files")


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
        "version": "7.0.0",
        "models": {
            "human_seg": SESSION_HUMAN is not None,
            "general":   SESSION_GENERAL is not None,
        }
    }


@app.post("/images/process")
async def process_image(image: UploadFile = File(...)):
    if all(s is None for s in [SESSION_HUMAN, SESSION_GENERAL]):
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
        file_id = str(uuid.uuid4())

        logger.info(f"Processing: {image.filename} ({len(content)} bytes)")

        input_image = Image.open(io.BytesIO(content)).convert("RGBA")

        # ── Detect characteristics ────────────────────────────────────────────
        person_detected = has_person(input_image)
        low_contrast    = is_low_contrast(input_image)

        # ── Select model ──────────────────────────────────────────────────────
        # Two use cases, same goal: isolate the garment with transparent bg.
        #
        #   1. Person + clothing → human_seg strips bg → skin removal strips body
        #      Result: only the garment remains
        #   2. Flat clothing / shoes / accessories → general u2net strips bg
        #      Result: only the item remains
        if person_detected and SESSION_HUMAN is not None:
            session    = SESSION_HUMAN
            model_used = "u2net_human_seg"
        elif SESSION_GENERAL is not None:
            session    = SESSION_GENERAL
            model_used = "u2net_general"
        else:
            session    = SESSION_HUMAN or SESSION_GENERAL
            model_used = "fallback"

        logger.info(
            f"Person: {person_detected}, LowContrast: {low_contrast} → "
            f"{model_used}, alpha_matting: {low_contrast}"
        )

        # ── Resize → Preprocess → Remove background ───────────────────────────
        processed_input = resize_for_inference(input_image)
        processed_input = preprocess_image(processed_input, low_contrast)

        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            processed_input,
            session,
            low_contrast,
        )

        # ── Step 2: Strip skin pixels when person detected ────────────────────
        # human_seg keeps person+clothes; we only want clothes.
        # Remove skin-tone pixels to isolate the garment.
        if person_detected:
            output_image = remove_skin_pixels(output_image)

        # ── Save processed image to disk (WebP, ~40% smaller than PNG) ─────────
        file_name = f"{file_id}.webp"
        file_path = STORAGE_PATH / file_name

        processed_buffer = io.BytesIO()
        output_image.save(processed_buffer, format="WEBP", quality=85)
        processed_bytes = processed_buffer.getvalue()

        with open(file_path, "wb") as f:
            f.write(processed_bytes)

        processed_url = f"{BASE_URL}/files/{file_name}"

        logger.info(
            f"Done: {file_id} | {model_used} | "
            f"saved: {file_path} ({len(processed_bytes)} bytes)"
        )

        return {
            "success": True,
            "data": {
                "processed_url":      processed_url,
                "file_name":          file_name,
                "file_size":          len(processed_bytes),
                "model_used":         model_used,
                "person_detected":    person_detected,
                "skin_removal_used":  person_detected,
                "alpha_matting_used": low_contrast,
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
