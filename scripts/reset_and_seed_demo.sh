#!/usr/bin/env bash
# Clear DMS transactional data and seed ~40-employee board demo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export WHITE_CLONE_SCRIPTS_DIR="${WHITE_CLONE_SCRIPTS_DIR:-$REPO_ROOT/scripts}"

"${REPO_ROOT}/scripts/run_odoo_shell.sh" clear_dms_data.py
DMS_DEMO_SKIP_CLEAR=1 "${REPO_ROOT}/scripts/run_odoo_shell.sh" seed_demo_board.py
