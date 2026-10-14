import logging

_logger = logging.getLogger(__name__)


def process_media_thumbnail(env, media):
    """Generate thumbnail off the web request (SRS FR-252)."""
    from odoo.addons.cleon_social_gallery.controllers.storage import CloudflareR2Storage
    from odoo.addons.cleon_social_gallery.models.gallery_thumbnail import generate_image_thumbnail

    if media.media_type != "image" or media.thumbnail_key:
        media.write({"needs_processing": False})
        return

    storage = CloudflareR2Storage(env)
    if not storage.is_configured():
        media.write({"needs_processing": False})
        return

    image_bytes = storage.get_object_bytes(media.storage_key)
    if not image_bytes:
        media.write({"needs_processing": False})
        return

    thumb_bytes, thumb_mime = generate_image_thumbnail(image_bytes)
    if thumb_bytes:
        thumb_key = "%s-thumb.jpg" % media.storage_key.rsplit(".", 1)[0]
        if storage.put_object_bytes(thumb_key, thumb_bytes, thumb_mime):
            media.write({"thumbnail_key": thumb_key, "needs_processing": False})
            return
    media.write({"needs_processing": False})
