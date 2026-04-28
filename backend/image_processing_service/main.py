"""
Image Processing Service - Railway Compatible
v11.0: BiRefNet upgrade + pipeline fixes
- Model: birefnet-general-lite (better edge detection, similar-color resilient)
- Fix: mask resize to match original full-resolution image
- Fix: original image preserved (not resized) for final output
- Softened preprocessing (BiRefNet needs less aggressive enhancement)
- Relaxed alpha matting thresholds for similar-color cases
- post_process_mask for cleaner edges
- File storage, WebP output
"""
import os
import uuid
import io
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

import httpx
import numpy as np
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import remove, new_session

import jwt
import mimetypes
from pillow_heif import register_heif_opener

register_heif_opener()  # Enables PIL to open HEIC/HEIF files

# python:3.11-slim ships with an incomplete mime.types DB; StaticFiles serves
# /files/*.webp with content-type: text/plain otherwise, which makes some
# browsers refuse to render the file as an <img> (CORB / MIME sniffing).
# Register the image MIME types explicitly so the static mount returns the
# correct Content-Type header.
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/heic", ".heic")
mimetypes.add_type("image/heif", ".heif")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE      = 10 * 1024 * 1024  # 10MB per SRS FReq2.1
MAX_DIMENSION      = 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

# ── Auth config ──────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
OUTFIT_SERVICE_URL = os.getenv("OUTFIT_SERVICE_URL", "http://localhost:3003")


def require_user_or_internal(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> str:
    """
    Accept either:
      - X-API-Key matching INTERNAL_API_KEY (service-to-service), OR
      - Authorization: Bearer <JWT> decoding successfully (logged-in user).
    Returns a principal string for logging.
    """
    if INTERNAL_API_KEY and x_api_key and x_api_key == INTERNAL_API_KEY:
        return "internal"

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        if not JWT_SECRET:
            raise HTTPException(status_code=503, detail="JWT_SECRET not configured")
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return f"user:{payload.get('user_id', 'unknown')}"
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

    raise HTTPException(status_code=401, detail="Authorization or X-API-Key required")


def require_internal_only(
    x_api_key: Optional[str] = Header(None),
) -> str:
    """For DELETE: only internal services may remove files."""
    if not INTERNAL_API_KEY or not x_api_key or x_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Valid X-API-Key required")
    return "internal"


# ── Storage config ───────────────────────────────────────────────────────────
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "/app/storage"))
STORAGE_PATH.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "http://localhost:3002").rstrip("/")

# ── Load model at startup ────────────────────────────────────────────────────
logger.info("Loading birefnet-general-lite model...")
try:
    SESSION = new_session("birefnet-general-lite")
    logger.info("birefnet-general-lite loaded successfully")
except Exception as e:
    logger.error(f"Failed to load birefnet-general-lite: {e}")
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
    """
    Edge-aware enhancement based on detected difficulty.
    Softened for BiRefNet — it already has better edge detection,
    so aggressive enhancement can hurt more than help.
    """
    if not difficulty["needs_enhancement"]:
        return image

    if difficulty["similar_colors"]:
        # Mild unsharp mask — amplify subtle edges
        blurred = image.filter(ImageFilter.GaussianBlur(radius=2))
        arr = np.array(image, dtype=np.float32)
        blurred_arr = np.array(blurred, dtype=np.float32)
        sharpened = np.clip(arr + 1.0 * (arr - blurred_arr), 0, 255)
        image = Image.fromarray(sharpened.astype(np.uint8), mode=image.mode)

        # Light saturation boost for subtle hue differences
        image = ImageEnhance.Color(image).enhance(1.2)

        # Autocontrast on RGB only (RGBA not supported)
        if image.mode == "RGBA":
            r, g, b, a = image.split()
            rgb = Image.merge("RGB", (r, g, b))
            rgb = ImageOps.autocontrast(rgb, cutoff=1)
            image = Image.merge("RGBA", (*rgb.split(), a))
        else:
            image = ImageOps.autocontrast(image, cutoff=1)

        logger.info("Similar colors → mild unsharp + saturation 1.2 + autocontrast")

    if difficulty["low_contrast"]:
        image = image.filter(ImageFilter.SHARPEN)
        image = ImageEnhance.Contrast(image).enhance(1.5)
        image = ImageEnhance.Sharpness(image).enhance(1.5)
        logger.info("Low contrast → sharpen + contrast 1.5")

    return image


def remove_background_sync(
    preprocessed: Image.Image,
    original: Image.Image,
    session,
    difficulty: dict,
) -> Image.Image:
    """
    Background removal with adaptive strategy.
    Runs model on preprocessed image for better edge detection,
    then applies the extracted alpha mask to the original image
    so colors stay clean. Handles size mismatch between
    inference resolution and original full-res image.
    """

    if difficulty["needs_enhancement"]:
        # Run model on preprocessed image (better edge detection)
        result = remove(
            preprocessed,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=200,
            alpha_matting_background_threshold=40,
            alpha_matting_erode_size=5,
            post_process_mask=True,
        )

        # Extract alpha mask
        alpha = result.split()[3]
        alpha_arr = np.array(alpha)
        fg_ratio = float(np.mean(alpha_arr > 128))

        if fg_ratio < 0.03 or fg_ratio > 0.97:
            logger.warning(
                f"Mask quality poor (fg_ratio={fg_ratio:.2f}), "
                f"retrying without alpha matting"
            )
            result = remove(preprocessed, session=session, post_process_mask=True)
            alpha = result.split()[3]

        # Resize mask to match original full-resolution image
        if alpha.size != original.size:
            alpha = alpha.resize(original.size, Image.LANCZOS)
            logger.info(f"Resized mask {result.size} → {original.size}")

        # Apply mask to ORIGINAL image (clean colors, full resolution)
        original_rgba = original.convert("RGBA")
        original_rgba.putalpha(alpha)
        logger.info("Applied mask from preprocessed to original image")
        return original_rgba

    # Normal case: run directly on original
    result = remove(original, session=session, post_process_mask=True)
    return result


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ClosetMate Image Processing Service",
    description="Background removal for wardrobe items",
    version="11.0.0",
    # No public docs — endpoints are gated by JWT or X-API-Key
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Mutation endpoints are gated by the auth dependency regardless of origin,
# but we still restrict browser-origin requests to the known frontend domains.
# <img src> fetches do not trigger CORS, so /files/* remains publicly viewable.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://closetmate.org.tr",
        "https://www.closetmate.org.tr",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
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
        "version": "11.0.0",
        "model_loaded": SESSION is not None,
    }


@app.post("/images/process")
async def process_image(
    image: UploadFile = File(...),
    principal: str = Depends(require_user_or_internal),
):
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
        return create_error_response("FILE_TOO_LARGE", "File exceeds 10MB limit")

    # ── Pre-flight Gemini moderation on the RAW upload ─────────────────────
    # Reject obviously off-topic images (selfies, food, screenshots, random
    # objects, animals) BEFORE running BiRefNet. Fail-CLOSED: pre-flight is
    # the sole moderation gate (the post-bg-removal gate in /analyze has
    # been removed), so any unreachable / non-200 / unexpected response
    # rejects the upload rather than letting it through.
    not_fashion_message = (
        "This image was not recognised as a clothing item, footwear, or "
        "fashion accessory. Please upload an image of the garment or "
        "accessory itself."
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{OUTFIT_SERVICE_URL}/moderate/image",
                files={"image": (image.filename or "upload", content, image.content_type or "image/png")},
                headers={"X-API-Key": INTERNAL_API_KEY or ""},
            )
        if resp.status_code != 200:
            logger.warning(
                f"Pre-flight moderation returned {resp.status_code}; rejecting upload"
            )
            return create_error_response("MODERATION_UNAVAILABLE", not_fashion_message, 503)

        mod = resp.json()
        if not mod.get("success"):
            logger.warning(f"Pre-flight moderation success=false; rejecting: {mod}")
            return create_error_response("MODERATION_UNAVAILABLE", not_fashion_message, 503)

        if mod.get("passed") is not True:
            reason = mod.get("rejection_reason") or "Image is not a clothing item, footwear, or fashion accessory."
            logger.info(f"Pre-flight moderation rejected upload: {reason}")
            return create_error_response("NOT_FASHION", not_fashion_message, 400)
    except Exception as e:
        logger.warning(f"Pre-flight moderation unreachable; rejecting upload: {e}")
        return create_error_response("MODERATION_UNAVAILABLE", not_fashion_message, 503)

    try:
        file_id = str(uuid.uuid4())
        logger.info(f"Processing: {image.filename} ({len(content)} bytes)")

        input_image = Image.open(io.BytesIO(content)).convert("RGBA")

        # Dimension validation — only reject oversized images.
        # Small images are accepted and upscaled after bg removal.
        w, h = input_image.size
        if w > 4000 or h > 4000:
            return create_error_response("IMAGE_TOO_LARGE", "Image must not exceed 4000×4000 pixels")

        # ── Preserve full-resolution original ─────────────────────────────────
        original_full = input_image.copy()

        # ── Analyze difficulty & preprocess ───────────────────────────────────
        difficulty = analyze_difficulty(input_image)
        resized = resize_for_inference(input_image)
        preprocessed = preprocess_image(resized.copy(), difficulty)

        # ── Remove background ─────────────────────────────────────────────────
        loop = asyncio.get_event_loop()
        output_image = await loop.run_in_executor(
            EXECUTOR,
            remove_background_sync,
            preprocessed,
            original_full,      # full-res original, not resized
            SESSION,
            difficulty,
        )

        # ── Upscale small images to minimum 200×200 ─────────────────────────
        out_w, out_h = output_image.size
        if out_w < 200 or out_h < 200:
            scale = max(200 / out_w, 200 / out_h)
            new_w = int(out_w * scale)
            new_h = int(out_h * scale)
            output_image = output_image.resize((new_w, new_h), Image.LANCZOS)
            logger.info(f"Upscaled {out_w}×{out_h} → {new_w}×{new_h}")

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


@app.post("/images/store")
async def store_image(
    image: UploadFile = File(...),
    principal: str = Depends(require_user_or_internal),
):
    """
    Store an image without background removal (for avatars, etc.).
    Resizes to max 256x256 and saves as WebP.
    """
    error = validate_image_file(image)
    if error:
        return create_error_response("INVALID_FILE_TYPE", error)

    content = await image.read()
    if len(content) > 2 * 1024 * 1024:
        return create_error_response("FILE_TOO_LARGE", "File exceeds 2MB limit")

    try:
        file_id = str(uuid.uuid4())
        img = Image.open(io.BytesIO(content)).convert("RGB")

        # Resize for avatar use case
        img.thumbnail((256, 256), Image.LANCZOS)

        file_name = f"avatar_{file_id}.webp"
        file_path = STORAGE_PATH / file_name

        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=85)
        buf_bytes = buf.getvalue()

        with open(file_path, "wb") as f:
            f.write(buf_bytes)

        url = f"{BASE_URL}/files/{file_name}"
        logger.info(f"Stored avatar: {file_name} ({len(buf_bytes)} bytes)")

        return {
            "success": True,
            "data": {
                "url": url,
                "file_name": file_name,
                "file_size": len(buf_bytes),
            },
        }
    except Exception as e:
        logger.error(f"Avatar storage failed: {e}", exc_info=True)
        return create_error_response("PROCESSING_FAILED", str(e), 500)


@app.delete("/images/{file_name}")
async def delete_image(
    file_name: str,
    principal: str = Depends(require_internal_only),
):
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