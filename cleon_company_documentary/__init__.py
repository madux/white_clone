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
        _logger.exception("Company Documentary R2 CORS bootstrap failed")
    if "documentary.role.definition" in env:
        env["documentary.role.definition"].sync_registry()
