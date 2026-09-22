#!/usr/bin/env bash
# Upgrade white_clone modules once, then exit. Prefer this over restarting the server with -u.
set -euo pipefail

export ODOO_UPDATE_MODULES="${ODOO_UPDATE_MODULES:-cleon_document_management,cleon_company_documentary,cleon_social_gallery}"
export ODOO_STOP_AFTER_UPDATE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/run_odoo_server.sh"
