#!/usr/bin/env bash
# Build/sync the DMS Next app, upgrade Odoo modules, then start the server (one dev loop).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NEXT_APP="${REPO_ROOT}/cleon_document_management/next-app"
ODOO_DB="${ODOO_DB:-white_cleon_17}"

echo "==> Deploy Next app (cleon_document_management)" >&2
cd "${NEXT_APP}"
npm run deploy

echo "==> Stop any running Odoo on database ${ODOO_DB}" >&2
if pgrep -f "odoo-bin.*-d[ =]${ODOO_DB}" >/dev/null 2>&1 || pgrep -f "odoo-bin.*-d ${ODOO_DB}" >/dev/null 2>&1; then
  pkill -f "odoo-bin.*${ODOO_DB}" || true
  sleep 2
fi

echo "==> Upgrade Odoo modules" >&2
"${SCRIPT_DIR}/run_odoo_upgrade.sh"

echo "==> Start Odoo server" >&2
exec "${SCRIPT_DIR}/run_odoo_server.sh"
