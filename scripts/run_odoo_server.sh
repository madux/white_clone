#!/usr/bin/env bash
# Start Odoo. Module upgrade is optional (see ODOO_UPDATE_MODULES).
set -euo pipefail

ODOO_HOME="${ODOO_HOME:-$HOME/Documents/Projects/odoo-17.0}"
ODOO_CONF="${ODOO_CONF:-odoo.conf}"
ODOO_DB="${ODOO_DB:-white_cleon_17}"
# Set to comma-separated module names to run -u on this start (e.g. cleon_document_management).
# Leave unset for a normal start without upgrading. Use scripts/run_odoo_upgrade.sh for a one-shot upgrade.
ODOO_UPDATE_MODULES="${ODOO_UPDATE_MODULES:-}"
# Set ODOO_STOP_AFTER_UPDATE=1 to exit after upgrade (used by run_odoo_upgrade.sh).
ODOO_STOP_AFTER_UPDATE="${ODOO_STOP_AFTER_UPDATE:-0}"

if [[ -x "${ODOO_HOME}/.venv/bin/python" ]]; then
  PYTHON="${ODOO_HOME}/.venv/bin/python"
elif [[ -x "${ODOO_HOME}/venv/bin/python" ]]; then
  PYTHON="${ODOO_HOME}/venv/bin/python"
else
  echo "No Python venv under ODOO_HOME=$ODOO_HOME (.venv or venv)" >&2
  exit 1
fi

if pgrep -f "odoo-bin.*-d[ =]${ODOO_DB}" >/dev/null 2>&1 || pgrep -f "odoo-bin.*-d ${ODOO_DB}" >/dev/null 2>&1; then
  echo "Another Odoo process is already using database ${ODOO_DB}." >&2
  echo "Stop it first (Activity Monitor or: pkill -f 'odoo-bin.*${ODOO_DB}'), then retry." >&2
  echo "Concurrent starts cause: could not serialize access due to concurrent update on ir_module_module." >&2
  exit 1
fi

cd "$ODOO_HOME"
ARGS=(-c "$ODOO_CONF" -d "$ODOO_DB")
if [[ -n "${ODOO_UPDATE_MODULES}" ]]; then
  echo "Upgrading modules: ${ODOO_UPDATE_MODULES}" >&2
  ARGS+=(-u "$ODOO_UPDATE_MODULES")
  if [[ "${ODOO_STOP_AFTER_UPDATE}" == "1" ]]; then
    ARGS+=(--stop-after-init)
  fi
else
  echo "Starting Odoo (db=${ODOO_DB}, no module upgrade). For -u use run_odoo_upgrade.sh or ODOO_UPDATE_MODULES=…" >&2
fi

exec "$PYTHON" odoo-bin "${ARGS[@]}" ${ODOO_EXTRA_ARGS:-}
