# -*- coding: utf-8 -*-
"""Runs seed_ef_qa_roster.py (reset EF-QA employees with realistic names)."""
from __future__ import annotations

import os

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./odoo-bin shell -c odoo.conf -d DB < scripts/seed_ef_qa_roster.py"
    )

os.environ.setdefault("SEED_EF_QA_SKIP_DELETE", "0")
_roster = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_ef_qa_roster.py")
with open(_roster, encoding="utf-8") as fh:
    exec(compile(fh.read(), _roster, "exec"), globals())
