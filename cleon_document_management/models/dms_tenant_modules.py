# -*- coding: utf-8 -*-
import json

from odoo import _, api, models
from odoo.exceptions import ValidationError

# Keys exposed to the Next app (tenant toggles).
TENANT_MODULE_KEYS = (
    "employee_files",
    "organizational_files",
    "templates_forms",
    "compliance",
    "document_intelligence",
    "signatures",
    "audit_trail",
    "approval_workflow",
    "triggers_alerts",
    "retention_legal_hold",
    "cleonai",
)

DEFAULT_TENANT_MODULES = {key: True for key in TENANT_MODULE_KEYS}

# Hard prerequisites when enabling a module (auto-applied on save).
HARD_REQUIRES = {
    "templates_forms": ("organizational_files",),
    "compliance": ("employee_files",),
    "signatures": ("organizational_files",),
}

# At least one of these must be on for document intelligence.
INTELLIGENCE_REQUIRES_ANY = ("employee_files", "organizational_files")

# Approval workflow needs at least one content module.
APPROVAL_WORKFLOW_REQUIRES_ANY = ("employee_files", "organizational_files")

# Triggers need something to attach to.
TRIGGERS_REQUIRES_ANY = ("employee_files", "organizational_files", "compliance")

RETENTION_REQUIRES = ("organizational_files",)


def _dependents_of(key):
    return tuple(
        module
        for module, reqs in HARD_REQUIRES.items()
        if key in reqs
    )


class DocDmsTenantModulesService(models.AbstractModel):
    _name = "doc.dms.tenant.modules.service"
    _description = "Tenant module enablement"

    @api.model
    def default_modules(self):
        return dict(DEFAULT_TENANT_MODULES)

    @api.model
    def _company(self, company=None):
        return company or self.env.company

    @api.model
    def read_modules(self, company=None):
        company = self._company(company)
        raw = company.dms_tenant_modules_json or ""
        if not raw.strip():
            return self.default_modules()
        try:
            data = json.loads(raw)
        except (TypeError, ValueError):
            return self.default_modules()
        if not isinstance(data, dict):
            return self.default_modules()
        merged = self.default_modules()
        for key in TENANT_MODULE_KEYS:
            if key in data:
                merged[key] = bool(data[key])
        return merged

    @api.model
    def write_modules(self, modules, company=None):
        company = self._company(company)
        self.env["doc.dms.permission"].require_super_admin(self.env.user)
        normalized = self._normalize_incoming(modules)
        resolved, notes = self._resolve_enable_dependencies(normalized)
        self._validate_disable_rules(resolved)
        company.sudo().write(
            {"dms_tenant_modules_json": json.dumps(resolved, sort_keys=True)}
        )
        emitter = self.env.get("doc.audit.emitter.service")
        if emitter:
            emitter.log_settings_changes(
                company,
                _("Modules"),
                _("Settings → Modules"),
                {"tenant_modules": resolved},
                action="tenant_modules_changed",
            )
        return {"modules": resolved, "notes": notes}

    @api.model
    def _normalize_incoming(self, modules):
        if not isinstance(modules, dict):
            raise ValidationError(_("Invalid module payload."))
        out = self.default_modules()
        for key in TENANT_MODULE_KEYS:
            if key in modules:
                out[key] = bool(modules[key])
        return out

    @api.model
    def _resolve_enable_dependencies(self, modules):
        notes = []
        changed = True
        while changed:
            changed = False
            for key, reqs in HARD_REQUIRES.items():
                if not modules.get(key):
                    continue
                for req in reqs:
                    if not modules.get(req):
                        modules[req] = True
                        notes.append(
                            _("%(enabled)s was enabled because %(parent)s requires it.")
                            % {
                                "enabled": req.replace("_", " ").title(),
                                "parent": key.replace("_", " ").title(),
                            }
                        )
                        changed = True
            if modules.get("document_intelligence") and not any(
                modules.get(k) for k in INTELLIGENCE_REQUIRES_ANY
            ):
                modules["employee_files"] = True
                notes.append(
                    _("Employee Files was enabled because Document Intelligence needs a content module.")
                )
                changed = True
            if modules.get("approval_workflow") and not any(
                modules.get(k) for k in APPROVAL_WORKFLOW_REQUIRES_ANY
            ):
                modules["employee_files"] = True
                notes.append(
                    _("Employee Files was enabled because Approval workflow needs Employee or Organisational Files.")
                )
                changed = True
            if modules.get("triggers_alerts") and not any(
                modules.get(k) for k in TRIGGERS_REQUIRES_ANY
            ):
                modules["employee_files"] = True
                notes.append(
                    _("Employee Files was enabled because Triggers & Alerts need a content module.")
                )
                changed = True
            if modules.get("retention_legal_hold"):
                for req in RETENTION_REQUIRES:
                    if not modules.get(req):
                        modules[req] = True
                        notes.append(
                            _("%(enabled)s was enabled because Retention & Legal Hold requires it.")
                            % {"enabled": req.replace("_", " ").title()}
                        )
                        changed = True
        return modules, notes

    @api.model
    def _validate_disable_rules(self, modules):
        for key in TENANT_MODULE_KEYS:
            if modules.get(key):
                continue
            for dependent in _dependents_of(key):
                if modules.get(dependent):
                    raise ValidationError(
                        _(
                            "Turn off %(dependent)s before disabling %(module)s."
                        )
                        % {
                            "dependent": dependent.replace("_", " ").title(),
                            "module": key.replace("_", " ").title(),
                        }
                    )
        if modules.get("document_intelligence") and not any(
            modules.get(k) for k in INTELLIGENCE_REQUIRES_ANY
        ):
            raise ValidationError(
                _(
                    "Document Intelligence requires Employee Files or Organisational Files."
                )
            )
        if modules.get("approval_workflow") and not any(
            modules.get(k) for k in APPROVAL_WORKFLOW_REQUIRES_ANY
        ):
            raise ValidationError(
                _(
                    "Approval workflow requires Employee Files or Organisational Files."
                )
            )
        if modules.get("triggers_alerts") and not any(
            modules.get(k) for k in TRIGGERS_REQUIRES_ANY
        ):
            raise ValidationError(
                _("Triggers & Alerts require Employee Files, Organisational Files, or Compliance.")
            )
        if modules.get("retention_legal_hold") and not all(
            modules.get(k) for k in RETENTION_REQUIRES
        ):
            raise ValidationError(
                _("Retention & Legal Hold requires Organisational Files.")
            )

    @api.model
    def module_enabled(self, key, company=None):
        if key not in TENANT_MODULE_KEYS:
            return True
        return bool(self.read_modules(company).get(key))
