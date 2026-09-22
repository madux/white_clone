# -*- coding: utf-8 -*-
import logging
import threading

from odoo import SUPERUSER_ID, api
from odoo.modules.registry import Registry
from odoo.tools import config

_logger = logging.getLogger(__name__)


def run_after_commit(env, callback, name="cleon-bg"):
    """Run callback(new_env) after this transaction commits, in a daemon thread.

    Tests stay synchronous-free: callers that need work in tests already run
    it inline. Cron remains a backup if a thread fails to start.
    """
    if config.get("test_enable"):
        return
    dbname = env.cr.dbname

    def _thread():
        try:
            registry = Registry(dbname)
            with registry.cursor() as cr:
                new_env = api.Environment(cr, SUPERUSER_ID, {})
                callback(new_env)
                cr.commit()
        except Exception:
            _logger.exception("Background task %s failed", name)

    def _start():
        threading.Thread(target=_thread, daemon=True, name=name).start()

    postcommit = getattr(env.cr, "postcommit", None)
    if postcommit is not None:
        postcommit.add(_start)
    else:
        _start()
