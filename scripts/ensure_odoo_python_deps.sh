#!/usr/bin/env bash
# Install only what Odoo checks in cleon_document_management __manifest__ (fast; no full requirements.txt).
set -euo pipefail

if [[ "${ODOO_SKIP_PYTHON_DEPS:-0}" == "1" ]]; then
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

ODOO_HOME="${ODOO_HOME:-$HOME/Documents/Projects/odoo-17.0}"
PYTHON="${ODOO_HOME}/.venv/bin/python"
PIP="${ODOO_HOME}/.venv/bin/pip"

if [[ ! -x "${PYTHON}" || ! -x "${PIP}" ]]; then
  echo "Odoo venv not found at ${ODOO_HOME}/.venv — skip Python deps." >&2
  exit 0
fi

# Fast check (no heavy torch import). Odoo only requires these two modules.
if "${PYTHON}" -c "
import importlib.util
import sys
for name in ('torch', 'sentence_transformers'):
    if importlib.util.find_spec(name) is None:
        sys.exit(1)
" 2>/dev/null; then
  echo "==> Odoo venv Python deps OK (torch, sentence_transformers); skipping pip." >&2
  exit 0
fi

echo "==> Installing Odoo manifest Python deps (sentence-transformers, torch)…" >&2
echo "    One-time large download. Skip forever with: ODOO_SKIP_PYTHON_DEPS=1" >&2
"${PIP}" install -q --upgrade-strategy only-if-needed "sentence-transformers>=3.0" "torch>=2.0"
