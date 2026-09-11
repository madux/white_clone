import logging

from . import models
from . import controllers

_logger = logging.getLogger(__name__)


def post_init_hook(env):
    from .controllers.storage import CloudflareR2Storage

    storage = CloudflareR2Storage(env)
    if not storage.is_configured():
        return
    try:
        storage.ensure_bucket_cors()
    except Exception:
        _logger.exception("Social Gallery R2 CORS bootstrap failed")
    if "gallery.role.definition" in env:
        env["gallery.role.definition"].sync_registry()
