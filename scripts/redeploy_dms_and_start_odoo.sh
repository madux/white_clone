#!/usr/bin/env bash
# Build/sync module Next apps, upgrade Odoo modules, then start the server (one dev loop).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ODOO_DB="${ODOO_DB:-white_cleon_17}"

deploy_next_app() {
  local module_name="$1"
  local next_app_dir="$2"
  echo "==> Deploy Next app (${module_name})" >&2
  cd "${next_app_dir}"
  npm run deploy
}

deploy_next_app "cleon_document_management" "${REPO_ROOT}/cleon_document_management/next-app"
deploy_next_app "cleon_company_documentary" "${REPO_ROOT}/cleon_company_documentary/next-app"
deploy_next_app "cleon_social_gallery" "${REPO_ROOT}/cleon_social_gallery/next-app"

echo "==> Stop any running Odoo on database ${ODOO_DB}" >&2
if pgrep -f "odoo-bin.*-d[ =]${ODOO_DB}" >/dev/null 2>&1 || pgrep -f "odoo-bin.*-d ${ODOO_DB}" >/dev/null 2>&1; then
  pkill -TERM -f "odoo-bin.*${ODOO_DB}" 2>/dev/null || true
  for _ in $(seq 1 20); do
    pgrep -f "odoo-bin.*${ODOO_DB}" >/dev/null 2>&1 || break
    sleep 1
  done
  pkill -KILL -f "odoo-bin.*${ODOO_DB}" 2>/dev/null || true
  sleep 1
fi

echo "==> Upgrade Odoo modules" >&2
"${SCRIPT_DIR}/run_odoo_upgrade.sh"

echo "==> Start Odoo server" >&2
exec "${SCRIPT_DIR}/run_odoo_server.sh"
