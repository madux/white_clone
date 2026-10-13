# -*- coding: utf-8 -*-
import logging
import threading

from odoo import api, SUPERUSER_ID
from odoo.modules.registry import Registry
from odoo.tools import config

_logger = logging.getLogger(__name__)


def schedule_compliance_run(env, run_id):
    """Execute a compliance evaluation run outside the HTTP request."""
    if config.get("test_enable"):
        run = env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if run:
            run.policy_id._execute_evaluation_run(run)
        return

    dbname = env.cr.dbname
    env.cr.commit()

    def _worker():
        registry = Registry(dbname)
        try:
            with registry.cursor() as cr:
                bg_env = api.Environment(cr, SUPERUSER_ID, {})
                run = bg_env["doc.compliance.evaluation.run"].browse(run_id).exists()
                if not run:
                    return
                try:
                    run.policy_id._execute_evaluation_run(run)
                    cr.commit()
                except Exception as error:
                    cr.rollback()
                    _logger.exception("Compliance run %s failed", run_id)
                    with registry.cursor() as err_cr:
                        err_env = api.Environment(err_cr, SUPERUSER_ID, {})
                        failed_run = err_env["doc.compliance.evaluation.run"].browse(
                            run_id
                        ).exists()
                        if failed_run:
                            failed_run.write(
                                {
                                    "state": "failed",
                                    "error_message": str(error),
                                    "progress_message": str(error),
                                }
                            )
                            failed_run.policy_id.write(
                                {
                                    "run_in_progress": False,
                                    "run_started_at": False,
                                }
                            )
                        err_cr.commit()

        except Exception:
            _logger.exception("Compliance run worker failed for run %s", run_id)

    threading.Thread(
        target=_worker,
        daemon=True,
        name=f"compliance-run-{run_id}",
    ).start()
