#!/usr/bin/env bash
# Run a white_clone script via Odoo shell (stdin). Used by .vscode/tasks.json.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: run_odoo_shell.sh <script.py under scripts/>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_NAME="$1"
SCRIPT_PATH="${REPO_ROOT}/scripts/${SCRIPT_NAME}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Script not found: $SCRIPT_PATH" >&2
  exit 1
fi

ODOO_HOME="${ODOO_HOME:-$HOME/Documents/Projects/odoo-17.0}"
ODOO_CONF="${ODOO_CONF:-odoo.conf}"
ODOO_DB="${ODOO_DB:-white_cleon_17}"

export WHITE_CLONE_SCRIPTS_DIR="${WHITE_CLONE_SCRIPTS_DIR:-$REPO_ROOT/scripts}"

if [[ -x "${ODOO_HOME}/.venv/bin/python" ]]; then
  PYTHON="${ODOO_HOME}/.venv/bin/python"
elif [[ -x "${ODOO_HOME}/venv/bin/python" ]]; then
  PYTHON="${ODOO_HOME}/venv/bin/python"
else
  echo "No Python venv under ODOO_HOME=$ODOO_HOME (.venv or venv)" >&2
  exit 1
fi

cd "$ODOO_HOME"
exec "$PYTHON" odoo-bin shell -c "$ODOO_CONF" -d "$ODOO_DB" < "$SCRIPT_PATH"
