# -*- coding: utf-8 -*-
import hashlib
import re
import secrets

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError

# Crockford base32 alphabet (no I, L, O, U)
_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_CODE_BODY_LEN = 6  # Displayed as XXX-XXX (Google Meet style)
_CODE_RATE_LIMIT = 5
_CODE_RATE_WINDOW_MINUTES = 15

# Allowed for any active grant (app shell data, served as the owner).
SHELL_ROUTE = "*"
# Generic document/folder routes shared by every document module.
DOCUMENT_MODULES = (
    "my_workspace",
    "employee_files",
    "organizational_files",
    "templates_forms",
)

# API path prefix → workspace module key, tuple of keys (any grants access), or
# SHELL_ROUTE. Fail-closed: unmapped paths are refused when delegating.
ROUTE_MODULE_REGISTRY = {
    # Phase 1 — personal / self-service
    "/api/my-workspace": "my_workspace",
    "/api/my-documents": "my_workspace",
    "/api/my-pending-uploads": "my_workspace",
    "/api/my-compliance": "self_service_compliance",
    "/api/compliance/submit-document": "self_service_compliance",
    "/api/compliance/my-inbox/item": "self_service_compliance",
    "/api/compliance/my-tasks": "self_service_compliance",
    "/api/compliance/tasks/complete": "self_service_compliance",
    "/api/admin-approval-inbox": "self_service_approvals",
    "/api/compliance/my-reviews": "self_service_reviews",
    "/api/compliance/reviews/": "self_service_reviews",
    "/api/compliance/my-team": "self_service_team",
    "/api/compliance/my-verifications": "self_service_team",
    "/api/compliance/verifications/": "self_service_team",
    # Phase 2 — employee / org / templates / activity
    "/api/employee-files": "employee_files",
    "/api/employee-files/": "employee_files",
    "/api/organizational": "organizational_files",
    "/api/templates": "templates_forms",
    "/api/templates-forms": "templates_forms",
    "/api/quick-access": "home",
    "/api/dashboard": "home",
    "/api/workspace-activity": "home",
    # Phase 3 — intelligence / compliance admin
    "/api/document-intelligence": "document_intelligence",
    "/api/compliance/policies": "compliance_admin",
    "/api/compliance/targets": "compliance_admin",
    "/api/compliance/evaluations": "compliance_admin",
    "/api/compliance/runs": "compliance_admin",
    "/api/compliance/exceptions": "compliance_admin",
    "/api/compliance/audit-log": "compliance_admin",
    "/api/compliance/retention": "compliance_admin",
    "/api/compliance/reports": "compliance_admin",
    "/api/compliance/request-linkable-content": "compliance_admin",
    "/api/compliance/request-linkable-tree": "compliance_admin",
    # Phase 4 — settings / roles / super admin
    "/api/settings": "settings",
    "/api/dms/": SHELL_ROUTE,
    "/api/create-document-type": "settings",
    "/api/get-document-type": "settings",
    "/api/roles": "roles",
    "/api/module-roles": "roles",
    "/api/document-management/roles": "roles",
    "/api/super-admin": "super_admin",
    # App shell — needed to render any delegated page
    "/api/me": SHELL_ROUTE,
    "/api/onboarding": SHELL_ROUTE,
    "/api/dashboard-stats": "home",
    "/api/admin-attention": "self_service_approvals",
    "/api/my-review-alerts": "self_service_reviews",
    # Employee-file specific folder/upload routes
    "/api/employee-documents/upload": "employee_files",
    "/api/admin/pending-employee-uploads": "employee_files",
    "/api/folder/add-employees": "employee_files",
    "/api/folder/check-employee-conflicts": "employee_files",
    "/api/folder/move-employees": "employee_files",
    "/api/folder/remove-employees": "employee_files",
    # Compliance admin extras
    "/api/compliance/policy-types": "compliance_admin",
    "/api/compliance/retention-batches": "compliance_admin",
    "/api/compliance/retention-batches/": "compliance_admin",
    "/api/compliance/retention-preview": "compliance_admin",
    "/api/compliance/retention-settings": "compliance_admin",
    # Shared document / folder routes used by every document module
    "/api/acknowledgements/document-audience": DOCUMENT_MODULES,
    "/api/archive-folder": DOCUMENT_MODULES,
    "/api/check-upload-conflicts": DOCUMENT_MODULES,
    "/api/create-document": DOCUMENT_MODULES,
    "/api/create-folder": DOCUMENT_MODULES,
    "/api/delete-document": DOCUMENT_MODULES,
    "/api/delete-document-version": DOCUMENT_MODULES,
    "/api/delete-folder": DOCUMENT_MODULES,
    "/api/delete-folders": DOCUMENT_MODULES,
    "/api/document-action": DOCUMENT_MODULES,
    "/api/document-lifecycle": DOCUMENT_MODULES,
    "/api/document-review": DOCUMENT_MODULES,
    "/api/document-versions": DOCUMENT_MODULES,
    "/api/document/acknowledge": DOCUMENT_MODULES,
    "/api/document/acknowledge-review-decision": DOCUMENT_MODULES,
    "/api/documents-action": DOCUMENT_MODULES,
    "/api/folder-action": DOCUMENT_MODULES,
    "/api/folder-lifecycle": DOCUMENT_MODULES,
    "/api/folder/move-recycle-documents": DOCUMENT_MODULES,
    "/api/get-document": DOCUMENT_MODULES,
    "/api/get-folder": DOCUMENT_MODULES,
    "/api/lifecycle-bulk-action": DOCUMENT_MODULES,
    "/api/move-documents": DOCUMENT_MODULES,
    "/api/share-links": DOCUMENT_MODULES,
    "/api/update-document": DOCUMENT_MODULES,
    "/api/update-folder": DOCUMENT_MODULES,
    "/api/upload-document": DOCUMENT_MODULES,
    "/api/view-document/": DOCUMENT_MODULES,
    "/api/view-folder/": DOCUMENT_MODULES,
}

WORKSPACE_ACCESS_MUTATION_PREFIXES = (
    "/api/workspace-access/invites/create",
    "/api/workspace-access/grants/revoke",
    "/api/workspace-access/grants/cancel",
    "/api/workspace-access/grants/deactivate",
    "/api/workspace-access/grants/update",
    "/api/workspace-access/invites/accept",
    "/api/workspace-access/invites/accept-code",
    "/api/workspace-access/invites/decline",
)


class WorkspaceDelegationContext:
    __slots__ = ("grant", "owner", "owner_employee", "module_keys", "actor")

    def __init__(self, grant, owner, owner_employee, module_keys, actor):
        self.grant = grant
        self.owner = owner
        self.owner_employee = owner_employee
        self.module_keys = module_keys
        self.actor = actor


class DocWorkspaceAccess(models.AbstractModel):
    _name = "doc.workspace.access"
    _description = "Workspace delegation service"

    # --- registry / context ---

    @api.model
    def module_key_for_path(self, path):
        path = path or ""
        if path in ROUTE_MODULE_REGISTRY:
            return ROUTE_MODULE_REGISTRY[path]
        for prefix, key in ROUTE_MODULE_REGISTRY.items():
            if prefix.endswith("/") and path.startswith(prefix):
                return key
            if not prefix.endswith("/") and path.startswith(prefix + "/"):
                return key
        return None

    @api.model
    def assert_not_delegated(self, kwargs, message=None):
        if kwargs.get("workspace_grant_id"):
            raise AccessError(
                message
                or _(
                    "You cannot manage workspace sharing while acting on someone else's workspace."
                )
            )

    @api.model
    def workspace_ctx_from_kwargs(self, kwargs, http_path=None):
        grant_id = kwargs.get("workspace_grant_id")
        if not grant_id:
            return None
        path = http_path or self.env.context.get("workspace_http_path")
        return self.validate_grant(int(grant_id), self.env.user, http_path=path)

    @api.model
    def validate_grant(self, grant_id, actor, http_path=None):
        grant = self.env["doc.workspace.grant"].sudo().browse(grant_id)
        if not grant.exists():
            raise AccessError(_("Workspace access grant is not valid."))
        if grant.state != "active":
            raise AccessError(_("Workspace access grant is not active."))
        if grant.delegate_id.id != actor.id:
            raise AccessError(_("You are not the delegate for this workspace grant."))
        now = fields.Datetime.now()
        if grant.valid_until and grant.valid_until < now:
            grant.sudo().write({"state": "expired"})
            raise AccessError(_("Workspace access has expired."))
        if grant.valid_from and grant.valid_from > now:
            raise AccessError(_("Workspace access is not yet valid."))
        module_keys = set(grant.module_ids.mapped("key"))
        if http_path:
            module_key = self.module_key_for_path(http_path)
            if module_key is None:
                raise AccessError(
                    _("This action is not available under delegated workspace access.")
                )
            if module_key == SHELL_ROUTE:
                allowed = True
            elif isinstance(module_key, tuple):
                allowed = bool(module_keys & set(module_key))
            else:
                allowed = module_key in module_keys
            if not allowed:
                raise AccessError(
                    _("You do not have access to this module in the delegated workspace.")
                )
        owner = grant.owner_id
        owner_employee = owner.employee_id
        return WorkspaceDelegationContext(
            grant=grant,
            owner=owner,
            owner_employee=owner_employee,
            module_keys=module_keys,
            actor=actor,
        )

    @api.model
    def assert_module(self, ctx, module_key):
        if module_key not in ctx.module_keys:
            raise AccessError(
                _("You do not have access to this module in the delegated workspace.")
            )

    @api.model
    def resolve_owner_employee(self, ctx, fallback_user):
        if ctx and ctx.owner_employee:
            return ctx.owner_employee
        if ctx and ctx.owner:
            return ctx.owner.employee_id
        return fallback_user.employee_id

    # --- owner module eligibility ---

    @api.model
    def _owner_has_module(self, owner, module_key):
        user = owner
        env = self.env
        dms = env["doc.dms.permission"]
        ef = env["doc.employee.files.permission"]
        org = env["doc.organizational.files.permission"]

        if module_key == "home":
            return (
                dms.user_has_dms_permission(user, "view_workspace_activity")
                or ef.user_can_access_ef_home(user)
                or org.user_can_access_org_library(user)
                or bool(user.employee_id)
            )
        if module_key == "my_workspace":
            return bool(user.employee_id) or dms.user_is_odoo_break_glass_admin(user)
        if module_key == "self_service_compliance":
            return bool(user.employee_id)
        if module_key == "self_service_approvals":
            ef_perms = ef.serialize_user_permissions(user)
            return (
                ef_perms.get("can_approve")
                or org.user_can_approve_org_requests(user)
                or dms.user_has_legacy_manager(user)
            )
        if module_key == "self_service_reviews":
            return bool(user.employee_id)
        if module_key == "self_service_team":
            return dms.user_has_legacy_manager(user) or ef.user_can_access_ef_home(user)
        if module_key == "employee_files":
            return ef.user_can_access_ef_home(user)
        if module_key == "organizational_files":
            return org.user_can_access_org_library(user)
        if module_key == "templates_forms":
            return dms.user_has_dms_permission(user, "templates_view")
        if module_key == "document_intelligence":
            return dms.user_has_dms_permission(user, "access_dms_module")
        if module_key == "compliance_admin":
            return dms.user_has_dms_permission(user, "compliance_view")
        if module_key == "settings":
            perms = dms.effective_permissions(user)
            return any(
                perms.get(k)
                for k in (
                    "manage_document_types",
                    "manage_retention_lifecycle",
                    "manage_ef_tenant_config",
                    "manage_org_tenant_config",
                )
            )
        if module_key == "roles":
            return dms.user_has_dms_permission(user, "assign_dms_roles")
        if module_key == "super_admin":
            return dms.user_is_super_admin(user)
        return False

    @api.model
    def eligible_modules_for_owner(self, owner):
        Module = self.env["doc.workspace.module"]
        modules = Module.search([("active", "=", True)])
        return modules.filtered(
            lambda m: self._owner_has_module(owner, m.key)
        )

    # --- invite codes ---

    @api.model
    def _normalize_code(self, code):
        if not code:
            return ""
        return re.sub(r"[^0-9A-Za-z]", "", str(code).upper())

    @api.model
    def _hash_code(self, code):
        normalized = self._normalize_code(code)
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return digest

    @api.model
    def _format_invite_code(self, normalized_body):
        """Format 6-char body as XXX-XXX for display and copy."""
        body = self._normalize_code(normalized_body)
        if len(body) != _CODE_BODY_LEN:
            return body
        return f"{body[:3]}-{body[3:]}"

    @api.model
    def _generate_invite_code(self):
        body = "".join(
            secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_BODY_LEN)
        )
        return self._format_invite_code(body)

    @api.model
    def _check_code_rate_limit(self, grant, user):
        now = fields.Datetime.now()
        window_start = grant.invite_code_window_start
        if (
            window_start
            and (now - window_start).total_seconds()
            < _CODE_RATE_WINDOW_MINUTES * 60
        ):
            if grant.invite_code_attempts >= _CODE_RATE_LIMIT:
                raise AccessError(
                    _("Too many failed invite code attempts. Try again later.")
                )
        else:
            grant.sudo().write(
                {
                    "invite_code_attempts": 0,
                    "invite_code_window_start": now,
                }
            )

    @api.model
    def _record_code_failure(self, grant):
        grant.sudo().write({"invite_code_attempts": grant.invite_code_attempts + 1})

    # --- serialization ---

    @api.model
    def _serialize_module(self, module):
        return {
            "id": module.id,
            "key": module.key,
            "name": module.name,
            "group": module.group or "",
            "sequence": module.sequence,
            "sensitive": module.sensitive,
        }

    @api.model
    def _serialize_grant(self, grant, include_modules=True):
        data = {
            "id": grant.id,
            "state": grant.state,
            "owner_id": grant.owner_id.id,
            "owner_name": grant.owner_id.name or "",
            "delegate_id": grant.delegate_id.id or False,
            "delegate_name": grant.delegate_id.name if grant.delegate_id else "",
            "valid_from": fields.Datetime.to_string(grant.valid_from)
            if grant.valid_from
            else "",
            "valid_until": fields.Datetime.to_string(grant.valid_until)
            if grant.valid_until
            else "",
            "note": grant.note or "",
            "company_id": grant.company_id.id,
            "accepted_at": fields.Datetime.to_string(grant.accepted_at)
            if grant.accepted_at
            else "",
        }
        if include_modules:
            data["module_keys"] = grant.module_ids.mapped("key")
            data["modules"] = [
                self._serialize_module(m) for m in grant.module_ids.sorted("sequence")
            ]
        return data

    @api.model
    def _log(self, grant, event, detail=None, module_key=None):
        owner_id = self.env.user.id
        grant_id = False
        if grant and grant.exists():
            grant_id = grant.id
            owner_id = grant.owner_id.id
        self.env["doc.workspace.access.log"].sudo().create(
            {
                "grant_id": grant_id,
                "actor_id": self.env.user.id,
                "owner_id": owner_id,
                "event": event,
                "detail": detail or {},
                "module_key": module_key,
            }
        )

    # --- CRUD operations ---

    @api.model
    def create_invite(
        self,
        owner,
        module_keys,
        valid_until,
        delegate_id=None,
        note=None,
        generate_code=False,
    ):
        if owner.id != self.env.user.id:
            raise AccessError(_("You can only share your own workspace."))
        if not valid_until:
            raise UserError(_("Valid until is required."))
        if isinstance(valid_until, str):
            until_dt = fields.Datetime.from_string(valid_until)
        else:
            until_dt = valid_until
        if until_dt <= fields.Datetime.now():
            raise UserError(_("Valid until must be in the future."))
        Module = self.env["doc.workspace.module"]
        modules = Module.search([("key", "in", list(module_keys or []))])
        if not modules:
            raise UserError(_("Select at least one module to share."))
        eligible = self.eligible_modules_for_owner(owner)
        ineligible = modules - eligible
        if ineligible:
            raise UserError(
                _("You cannot grant modules you do not have access to: %s")
                % ", ".join(ineligible.mapped("name"))
            )
        if delegate_id:
            delegate = self.env["res.users"].browse(int(delegate_id))
            if not delegate.exists() or not delegate.active:
                raise UserError(_("Select a valid delegate user."))
            if delegate.id == owner.id:
                raise UserError(_("You cannot delegate to yourself."))
            if delegate.company_id and owner.company_id:
                if delegate.company_id.id != owner.company_id.id:
                    raise UserError(_("Delegate must belong to the same company."))
        else:
            delegate = self.env["res.users"]

        vals = {
            "owner_id": owner.id,
            "delegate_id": delegate.id if delegate else False,
            "state": "pending",
            "valid_until": until_dt,
            "module_ids": [fields.Command.set(modules.ids)],
            "note": note or False,
            "company_id": owner.company_id.id,
        }
        plaintext_code = None
        if generate_code:
            plaintext_code = self._generate_invite_code()
            vals["invite_code_hash"] = self._hash_code(plaintext_code)
            vals["invite_code_expires_at"] = until_dt
        grant = self.env["doc.workspace.grant"].create(vals)
        self._log(grant, "invite_created", {"module_keys": modules.mapped("key")})
        payload = self._serialize_grant(grant)
        if plaintext_code:
            payload["invite_code"] = plaintext_code
        return payload

    @api.model
    def update_grant(self, grant_id, owner, module_keys=None, valid_until=None):
        """Change the modules or end time of a pending or active share."""
        grant = self.env["doc.workspace.grant"].browse(int(grant_id))
        if not grant.exists() or grant.owner_id.id != owner.id:
            raise AccessError(_("Grant not found."))
        if grant.state not in ("pending", "active"):
            raise UserError(_("Only pending or active shares can be edited."))
        vals = {}
        detail = {}
        if module_keys is not None:
            modules = self.env["doc.workspace.module"].search(
                [("key", "in", list(module_keys))]
            )
            if not modules:
                raise UserError(_("Select at least one module to share."))
            ineligible = modules - self.eligible_modules_for_owner(owner)
            if ineligible:
                raise UserError(
                    _("You cannot grant modules you do not have access to: %s")
                    % ", ".join(ineligible.mapped("name"))
                )
            previous = set(grant.module_ids.mapped("key"))
            current = set(modules.mapped("key"))
            vals["module_ids"] = [fields.Command.set(modules.ids)]
            detail["added"] = sorted(current - previous)
            detail["removed"] = sorted(previous - current)
        if valid_until:
            until_dt = (
                fields.Datetime.from_string(valid_until)
                if isinstance(valid_until, str)
                else valid_until
            )
            if until_dt <= fields.Datetime.now():
                raise UserError(_("Valid until must be in the future."))
            vals["valid_until"] = until_dt
            if grant.invite_code_hash:
                vals["invite_code_expires_at"] = until_dt
            detail["valid_until"] = fields.Datetime.to_string(until_dt)
        if vals:
            grant.sudo().write(vals)
            self._log(grant, "grant_updated", detail)
        return self._serialize_grant(grant)

    @api.model
    def accept(self, grant_id, delegate):
        grant = self.env["doc.workspace.grant"].browse(int(grant_id))
        if not grant.exists():
            raise AccessError(_("Invitation not found."))
        if grant.state != "pending":
            raise UserError(_("This invitation is no longer pending."))
        if grant.delegate_id and grant.delegate_id.id != delegate.id:
            raise AccessError(_("This invitation was sent to another user."))
        if not grant.delegate_id:
            grant.sudo().write({"delegate_id": delegate.id})
        grant.sudo().write(
            {
                "state": "active",
                "accepted_at": fields.Datetime.now(),
                "invite_code_hash": False,
                "invite_code_expires_at": False,
            }
        )
        delegate.sudo().write({"workspace_active_grant_id": grant.id})
        self._log(grant, "accepted")
        return self._serialize_grant(grant)

    @api.model
    def accept_code(self, code, delegate):
        normalized = self._normalize_code(code)
        if len(normalized) != _CODE_BODY_LEN:
            raise UserError(_("Enter a valid invite code (e.g. ABC-DEF)."))
        code_hash = self._hash_code(normalized)
        # Open code invites have no delegate yet, so record rules would hide them;
        # holding the code is what authorizes the lookup.
        grant = self.env["doc.workspace.grant"].sudo().search(
            [
                ("invite_code_hash", "=", code_hash),
                ("state", "in", ("pending", "active")),
            ],
            limit=1,
        )
        if not grant:
            self._record_code_failure_on_user(delegate)
            raise UserError(_("Invite code is not valid."))
        self._check_code_rate_limit(grant, delegate)
        if grant.invite_code_expires_at and grant.invite_code_expires_at < fields.Datetime.now():
            raise UserError(_("Invite code has expired."))
        if grant.delegate_id and grant.delegate_id.id != delegate.id:
            self._record_code_failure(grant)
            raise AccessError(_("This invite code is assigned to another user."))
        if delegate.company_id and grant.company_id:
            if delegate.company_id.id != grant.company_id.id:
                self._record_code_failure(grant)
                raise AccessError(_("Invite code is not valid for your company."))
        write_vals = {
            "state": "active",
            "accepted_at": fields.Datetime.now(),
            "invite_code_hash": False,
            "invite_code_expires_at": False,
            "invite_code_attempts": 0,
        }
        if not grant.delegate_id:
            write_vals["delegate_id"] = delegate.id
        grant.sudo().write(write_vals)
        delegate.sudo().write({"workspace_active_grant_id": grant.id})
        grant = grant.with_env(self.env)
        self._log(grant, "accepted_via_code")
        return self._serialize_grant(grant)

    @api.model
    def _record_code_failure_on_user(self, user):
        # Best-effort: no grant to attach; failures tracked per-grant on match
        pass

    @api.model
    def decline(self, grant_id, delegate):
        grant = self.env["doc.workspace.grant"].browse(int(grant_id))
        if not grant.exists() or grant.state != "pending":
            raise UserError(_("Invitation not found."))
        if grant.delegate_id and grant.delegate_id.id != delegate.id:
            raise AccessError(_("You cannot decline this invitation."))
        grant.sudo().write({"state": "declined"})
        self._log(grant, "declined")
        return {"id": grant.id, "state": grant.state}

    @api.model
    def revoke(self, grant_id, actor):
        grant = self.env["doc.workspace.grant"].browse(int(grant_id))
        if not grant.exists():
            raise AccessError(_("Grant not found."))
        dms = self.env["doc.dms.permission"]
        if grant.owner_id.id != actor.id and not dms.user_is_odoo_break_glass_admin(actor):
            raise AccessError(_("Only the workspace owner can revoke access."))
        if grant.state not in ("pending", "active"):
            raise UserError(_("Grant cannot be revoked."))
        grant.sudo().write(
            {
                **self._clear_invite_code_vals(),
                "state": "revoked",
                "revoked_at": fields.Datetime.now(),
            }
        )
        if grant.delegate_id and grant.delegate_id.workspace_active_grant_id.id == grant.id:
            grant.delegate_id.sudo().write({"workspace_active_grant_id": False})
        self._log(grant, "revoked")
        return self._serialize_grant(grant)

    @api.model
    def _clear_invite_code_vals(self):
        return {
            "invite_code_hash": False,
            "invite_code_expires_at": False,
            "invite_code_attempts": 0,
            "invite_code_window_start": False,
        }

    @api.model
    def deactivate(self, grant_id, owner):
        """End a pending or active share; invite codes cannot be reused."""
        grant = self.env["doc.workspace.grant"].browse(int(grant_id))
        if not grant.exists() or grant.owner_id.id != owner.id:
            raise AccessError(_("Grant not found."))
        if grant.state not in ("pending", "active"):
            raise UserError(_("This share is already inactive."))
        previous_state = grant.state
        clear = self._clear_invite_code_vals()
        now = fields.Datetime.now()
        if previous_state == "pending":
            grant.sudo().write({**clear, "state": "cancelled"})
        else:
            grant.sudo().write(
                {**clear, "state": "revoked", "revoked_at": now}
            )
            if (
                grant.delegate_id
                and grant.delegate_id.workspace_active_grant_id.id == grant.id
            ):
                grant.delegate_id.sudo().write({"workspace_active_grant_id": False})
        self._log(grant, "deactivated", {"previous_state": previous_state})
        return self._serialize_grant(grant)

    @api.model
    def cancel(self, grant_id, owner):
        return self.deactivate(grant_id, owner)

    @api.model
    def list_incoming(self, delegate):
        """Pending invitations and active grants delegated to this user."""
        grants = self.env["doc.workspace.grant"].search(
            [
                ("state", "in", ("pending", "active")),
                ("delegate_id", "=", delegate.id),
            ],
            order="create_date desc",
        )
        now = fields.Datetime.now()
        lapsed = grants.filtered(
            lambda g: g.state == "active" and g.valid_until and g.valid_until < now
        )
        if lapsed:
            lapsed.sudo().write({"state": "expired"})
        return [self._serialize_grant(g) for g in grants - lapsed]

    @api.model
    def list_outgoing(self, owner):
        grants = self.env["doc.workspace.grant"].search(
            [("owner_id", "=", owner.id)],
            order="create_date desc",
        )
        return [self._serialize_grant(g) for g in grants]

    @api.model
    def session_summary(self, delegate, grant_id=None):
        Grant = self.env["doc.workspace.grant"]
        grant = Grant.browse(False)
        if grant_id:
            grant = Grant.browse(int(grant_id))
        elif delegate.workspace_active_grant_id:
            grant = delegate.workspace_active_grant_id
        if not grant or not grant.exists() or grant.delegate_id.id != delegate.id:
            return None
        if grant.state != "active":
            return None
        try:
            self.validate_grant(grant.id, delegate)
        except AccessError:
            return None
        return self._serialize_grant(grant)

    @api.model
    def clear_session(self, delegate, grant_id=None):
        if grant_id:
            grant = self.env["doc.workspace.grant"].browse(int(grant_id))
            if grant.delegate_id.id != delegate.id:
                raise AccessError(_("Grant not found."))
        active = delegate.workspace_active_grant_id
        if active:
            if not grant_id or active.id == int(grant_id):
                delegate.sudo().write({"workspace_active_grant_id": False})
                self._log(active, "session_cleared", {"grant_id": grant_id})
        else:
            self._log(
                self.env["doc.workspace.grant"],
                "session_cleared",
                {"grant_id": grant_id},
            )
        return {"cleared": True}

    @api.model
    def pending_invite_count(self, delegate):
        return self.env["doc.workspace.grant"].search_count(
            [
                ("state", "=", "pending"),
                ("delegate_id", "=", delegate.id),
            ]
        )

    @api.model
    def expire_cron(self):
        now = fields.Datetime.now()
        expired = self.env["doc.workspace.grant"].sudo().search(
            [
                ("state", "=", "active"),
                ("valid_until", "<", now),
            ]
        )
        for grant in expired:
            grant.write({"state": "expired"})
            if (
                grant.delegate_id
                and grant.delegate_id.workspace_active_grant_id.id == grant.id
            ):
                grant.delegate_id.sudo().write({"workspace_active_grant_id": False})
        pending_expired = self.env["doc.workspace.grant"].sudo().search(
            [
                ("state", "=", "pending"),
                ("valid_until", "<", now),
            ]
        )
        pending_expired.write({"state": "expired"})
