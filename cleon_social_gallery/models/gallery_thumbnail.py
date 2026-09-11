import io
import logging

_logger = logging.getLogger(__name__)

THUMB_MAX_SIZE = 400
THUMB_QUALITY = 82


def generate_image_thumbnail(image_bytes, max_size=THUMB_MAX_SIZE):
    """Resize image bytes to a JPEG thumbnail. Returns (bytes, mime_type) or (None, None)."""
    if not image_bytes:
        return None, None
    try:
        from PIL import Image
    except ImportError:
        _logger.warning("Pillow is not installed; Social Gallery thumbnails are disabled.")
        return None, None
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image = image.convert("RGB")
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=THUMB_QUALITY, optimize=True)
            return buffer.getvalue(), "image/jpeg"
    except Exception:
        _logger.exception("Failed to generate Social Gallery thumbnail")
        return None, None
