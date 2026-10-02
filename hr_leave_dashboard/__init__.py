# -*- coding: utf-8 -*-
from . import model, controllers


def post_init_hook(env):
    """Activate the baseline routes after their XML steps exist."""
    env["cleon.approval.chain"].search([("code", "in", [
        "LEAVE_STANDARD", "LEAVE_DEPARTMENT", "LEAVE_EXECUTIVE", "LEAVE_HR_REVIEW",
        "LEAVE_SHORT_AUTO", "LEAVE_PROJECT", "LEAVE_INDIVIDUAL",
    ])]).write({"active": True})
