# -*- coding: utf-8 -*-
from odoo import http
from odoo.exceptions import ValidationError
from odoo.http import request

from odoo.addons.cleon_document_management.controllers.workspace_delegation import (
    workspace_ctx,
)


class DmsContractsController(http.Controller):
    @http.route(
        "/api/dms/settings/read",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_settings_read(self, **kwargs):
        workspace_ctx(kwargs)
        payload = request.env["doc.dms.settings.read.service"].build_payload()
        return {"success": True, "contract": "C8", "version": "v1", "data": payload}

    @http.route(
        "/api/dms/registry/search",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def registry_search(self, **kwargs):
        workspace_ctx(kwargs)
        service = request.env["doc.registry.service"]
        result = service.search_documents(
            query=kwargs.get("query") or "",
            filters=kwargs.get("filters") or {},
            page=kwargs.get("page") or 1,
            page_size=kwargs.get("page_size") or 25,
        )
        return {"success": True, "contract": "C6", "data": result}

    @http.route(
        "/api/dms/registry/get",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def registry_get(self, **kwargs):
        workspace_ctx(kwargs)
        document_id = kwargs.get("document_id") or kwargs.get("id")
        entry = request.env["doc.registry.service"].get_document(
            document_id,
            audit_source=kwargs.get("audit_source"),
        )
        if not entry:
            return {"success": False, "message": "Not found"}
        return {"success": True, "contract": "C6", "data": entry}

    @http.route(
        "/api/dms/registry/index-status",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def registry_index_status(self, **kwargs):
        workspace_ctx(kwargs)
        data = request.env["doc.registry.service"].index_status()
        return {"success": True, "contract": "C6", "data": data}

    @http.route(
        "/api/dms/registry/reindex",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def registry_reindex(self, **kwargs):
        workspace_ctx(kwargs)
        if not request.env.user.has_group("base.group_system"):
            return {"success": False, "message": "Super Admin only."}
        domain = [("active", "=", True), ("deleted_at", "=", False)]
        module = kwargs.get("module")
        if module == "employee_files":
            domain.append(("folder_id.folder_type", "=", "employee"))
        elif module == "organizational_files":
            domain.append(("folder_id.folder_type", "=", "organizational"))
        documents = request.env["doc.document"].search(domain)
        request.env["doc.registry.service"].sync_document_registry(documents)
        return {
            "success": True,
            "data": {"synced": len(documents)},
        }

    @http.route(
        "/api/dms/audit/query",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_query(self, **kwargs):
        workspace_ctx(kwargs)
        service = request.env["doc.audit.query.service"]
        try:
            data = service.query(
                filters=kwargs.get("filters") or {},
                page=kwargs.get("page") or 1,
                page_size=kwargs.get("page_size") or 50,
            )
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/audit/meta",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_meta(self, **kwargs):
        workspace_ctx(kwargs)
        data = request.env["doc.audit.query.service"].meta()
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/audit/metrics",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_metrics(self, **kwargs):
        workspace_ctx(kwargs)
        service = request.env["doc.audit.query.service"]
        try:
            data = service.metrics(filters=kwargs.get("filters") or {})
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/audit/export",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_export(self, **kwargs):
        workspace_ctx(kwargs)
        service = request.env["doc.audit.query.service"]
        try:
            data = service.export_rows(filters=kwargs.get("filters") or {})
        except Exception as exc:
            return {"success": False, "message": str(exc)}
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/audit/export-job",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_export_job(self, **kwargs):
        workspace_ctx(kwargs)
        job_id = kwargs.get("job_id") or kwargs.get("id")
        data = request.env["doc.audit.query.service"].get_export_job(job_id)
        if not data:
            return {"success": False, "message": "Not found"}
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/audit/log-view",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_log_view(self, **kwargs):
        workspace_ctx(kwargs)
        document_id = kwargs.get("document_id") or kwargs.get("id")
        source = kwargs.get("source") or "search_preview"
        service = request.env["doc.registry.service"]
        entry = service.get_document(document_id, audit_source=source)
        if not entry:
            return {"success": False, "message": "Not found or access denied"}
        return {"success": True, "data": entry}

    @http.route(
        "/api/dms/audit/event",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_event(self, **kwargs):
        workspace_ctx(kwargs)
        event_id = kwargs.get("id") or kwargs.get("event_id")
        data = request.env["doc.audit.query.service"].get_event(event_id)
        if not data:
            return {"success": False, "message": "Not found"}
        return {"success": True, "contract": "C7", "data": data}

    @http.route(
        "/api/dms/notifications/dispatch",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_dispatch(self, **kwargs):
        workspace_ctx(kwargs)
        result = request.env["doc.notification.service"].dispatch(
            kwargs.get("event_type") or "dms.generic",
            payload=kwargs.get("payload") or {},
            dedupe_key=kwargs.get("dedupe_key"),
        )
        return {"success": True, "contract": "C4", "data": result}

    @http.route(
        "/api/dms/notifications/inbox",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_inbox(self, **kwargs):
        workspace_ctx(kwargs)
        from datetime import timedelta

        from odoo import fields

        limit = min(max(int(kwargs.get("limit") or 50), 1), 100)
        tab = (kwargs.get("tab") or "all").lower()
        cutoff = fields.Datetime.now() - timedelta(days=90)
        domain = [
            ("user_id", "=", request.env.user.id),
            ("create_date", ">=", cutoff),
        ]
        if tab == "unread":
            domain.append(("read_at", "=", False))
        Notification = request.env["doc.notification"].sudo()
        notes = Notification.search(domain, limit=limit, order="create_date desc")
        unread_count = Notification.search_count(
            [
                ("user_id", "=", request.env.user.id),
                ("read_at", "=", False),
                ("create_date", ">=", cutoff),
            ]
        )
        return {
            "success": True,
            "data": {
                "items": [note.serialize_for_api() for note in notes],
                "unread_count": unread_count,
                "tab": tab,
            },
        }

    @http.route(
        "/api/dms/notifications/mark-read",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_mark_read(self, **kwargs):
        workspace_ctx(kwargs)
        from odoo import fields

        if kwargs.get("all"):
            notes = request.env["doc.notification"].sudo().search(
                [
                    ("user_id", "=", request.env.user.id),
                    ("read_at", "=", False),
                ]
            )
        else:
            ids = [
                int(value) for value in kwargs.get("ids") or [] if str(value).isdigit()
            ]
            notes = request.env["doc.notification"].sudo().search(
                [("id", "in", ids), ("user_id", "=", request.env.user.id)]
            )
        notes.write({"read_at": fields.Datetime.now()})
        return {"success": True, "updated": len(notes)}

    @http.route(
        "/api/dms/notifications/open",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_open(self, **kwargs):
        workspace_ctx(kwargs)
        note_id = kwargs.get("id") or kwargs.get("notification_id")
        if not note_id:
            return {"success": False, "message": "Missing id"}
        result = request.env["doc.notification.service"].open_notification(
            int(note_id)
        )
        return {"success": True, "data": result}

    @http.route(
        "/api/dms/notifications/preferences",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_preferences(self, **kwargs):
        workspace_ctx(kwargs)
        Pref = request.env["doc.notification.user.preference"]
        pref = Pref.get_or_create_for_user(request.env.user)
        if kwargs.get("save"):
            emitter = request.env.get("doc.audit.emitter.service")
            before = (
                {
                    "digest_enabled": pref.digest_enabled,
                    "email_signatures": pref.email_signatures,
                    "email_documents": pref.email_documents,
                    "email_approvals": pref.email_approvals,
                    "email_organizational": pref.email_organizational,
                    "email_templates": pref.email_templates,
                    "email_compliance": pref.email_compliance,
                    "email_alerts": pref.email_alerts,
                    "email_platform": pref.email_platform,
                }
                if emitter
                else {}
            )
            updates = {}
            if "digest_enabled" in kwargs:
                updates["digest_enabled"] = bool(kwargs.get("digest_enabled"))
            group_map = {
                "signatures": "email_signatures",
                "documents": "email_documents",
                "approvals": "email_approvals",
                "organizational": "email_organizational",
                "templates": "email_templates",
                "compliance": "email_compliance",
                "alerts": "email_alerts",
                "platform": "email_platform",
            }
            locked = Pref._required_groups()
            groups = kwargs.get("groups") or {}
            is_super = request.env.user.has_group("base.group_system")
            for code, field_name in group_map.items():
                if code in locked and not is_super and groups.get(code) is False:
                    continue
                if code in groups:
                    updates[field_name] = bool(groups[code])
            if updates:
                pref.sudo().write(updates)
            if emitter and updates:
                after = {
                    "digest_enabled": pref.digest_enabled,
                    "email_signatures": pref.email_signatures,
                    "email_documents": pref.email_documents,
                    "email_approvals": pref.email_approvals,
                    "email_organizational": pref.email_organizational,
                    "email_templates": pref.email_templates,
                    "email_compliance": pref.email_compliance,
                    "email_alerts": pref.email_alerts,
                    "email_platform": pref.email_platform,
                }
                changes = emitter.diff_dict(before, after)
                emitter.log_settings_changes(
                    pref,
                    "Notification preferences",
                    "Settings → Notifications → My preferences",
                    changes,
                )
        return {"success": True, "data": pref.serialize_for_api()}

    @http.route(
        "/api/dms/notification-rules/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_rules_save(self, **kwargs):
        workspace_ctx(kwargs)
        if not request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            return {"success": False, "message": "Access denied."}
        is_super = request.env.user.has_group("base.group_system")
        Rule = request.env["doc.notification.rule"].sudo()
        rules = kwargs.get("rules") or []
        updated = 0
        emitter = request.env.get("doc.audit.emitter.service")
        corr = emitter.new_correlation_id("notify") if emitter else None
        for item in rules:
            rule_id = item.get("id")
            if not rule_id:
                continue
            rule = Rule.browse(int(rule_id))
            if not rule.exists():
                continue
            if rule.compliance_read_only:
                continue
            before = {
                "active": rule.active,
                "channel_email": rule.channel_email,
                "who_is_told": rule.who_is_told,
                "recipient_mode": rule.recipient_mode,
            }
            vals = {"is_customized": True}
            if "active" in item and (not rule.required or is_super):
                vals["active"] = bool(item["active"])
            if "channel_email" in item:
                if rule.required and not is_super:
                    pass
                else:
                    vals["channel_email"] = bool(item["channel_email"])
            if "who_is_told" in item and is_super:
                vals["who_is_told"] = item["who_is_told"]
            if "recipient_mode" in item and is_super:
                vals["recipient_mode"] = item["recipient_mode"]
            if "user_ids" in item and is_super:
                vals["user_ids"] = [(6, 0, item["user_ids"] or [])]
            rule.write(vals)
            if emitter:
                after = {
                    "active": rule.active,
                    "channel_email": rule.channel_email,
                    "who_is_told": rule.who_is_told,
                    "recipient_mode": rule.recipient_mode,
                }
                changes = emitter.diff_dict(before, after)
                if changes:
                    emitter.log_settings_changes(
                        rule,
                        "Notification Rules",
                        "Settings → Notification Rules → %s" % (rule.name or rule.event_type),
                        changes,
                        correlation_id=corr,
                    )
            updated += 1
        return {"success": True, "updated": updated}

    @http.route(
        "/api/dms/notifications/delivery-log",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def notification_delivery_log(self, **kwargs):
        workspace_ctx(kwargs)
        if not request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            return {"success": False, "message": "Access denied."}
        page = max(int(kwargs.get("page") or 1), 1)
        page_size = min(max(int(kwargs.get("page_size") or 50), 1), 100)
        offset = (page - 1) * page_size
        Delivery = request.env["doc.notification.delivery"].sudo()
        total = Delivery.search_count([])
        rows = Delivery.search([], limit=page_size, offset=offset, order="create_date desc")
        return {
            "success": True,
            "data": {
                "items": [row.serialize_for_api() for row in rows],
                "total": total,
                "page": page,
            },
        }

    @http.route(
        "/api/dms/general/test-email",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_test_email(self, **kwargs):
        workspace_ctx(kwargs)
        if not request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            return {"success": False, "message": "Access denied."}
        to_email = kwargs.get("to_email") or request.env.user.email
        if not to_email:
            return {"success": False, "message": "No recipient email."}
        result = request.env["doc.notification.service"].send_test_email(to_email)
        if result.get("success"):
            return {"success": True}
        return {
            "success": False,
            "message": result.get("message") or "Send failed.",
        }

    @http.route(
        "/api/dms/work-items",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def work_items_stub(self, **kwargs):
        """C5 unified My Workspace to-do feed."""
        from odoo.addons.cleon_document_management.controllers.workspace_delegation import (
            effective_employee,
            effective_user,
        )

        ctx = workspace_ctx(kwargs)
        employee_id = kwargs.get("employeeId") or kwargs.get("employee_id")
        user = effective_user(ctx)
        if employee_id and str(employee_id).isdigit():
            employee = request.env["hr.employee"].browse(int(employee_id))
            if employee.exists() and employee.user_id != user:
                return {
                    "success": False,
                    "message": "Forbidden",
                    "contract": "C5",
                }
        employee = effective_employee(ctx)
        search = kwargs.get("search") or kwargs.get("q") or ""
        payload = request.env["doc.dms.work.items.service"].build_for_user(
            user, employee=employee, search=search
        )
        return {
            "success": True,
            "contract": "C5",
            "data": payload,
        }

    def _require_general_admin(self):
        workspace_ctx({})
        if not request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            return {"success": False, "message": "Access denied."}
        return None

    @http.route(
        "/api/dms/general/holidays/list",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_holidays_list(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        year = kwargs.get("year")
        if not year:
            from odoo import fields

            year = fields.Date.context_today(request.env.user).year
        Holiday = request.env["doc.dms.public.holiday"]
        return {
            "success": True,
            "year": int(year),
            "holidays": Holiday.serialize_list(request.env.company, int(year)),
        }

    @http.route(
        "/api/dms/general/holiday/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_holiday_save(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        Holiday = request.env["doc.dms.public.holiday"]
        name = (kwargs.get("name") or "").strip()
        holiday_date = kwargs.get("date") or kwargs.get("holiday_date")
        if not name or not holiday_date:
            return {"success": False, "message": "Name and date are required."}
        vals = {
            "name": name,
            "holiday_date": holiday_date,
            "company_id": request.env.company.id,
        }
        holiday_id = kwargs.get("id")
        if holiday_id:
            row = Holiday.browse(int(holiday_id))
            if not row.exists() or row.company_id != request.env.company:
                return {"success": False, "message": "Holiday not found."}
            row.write(vals)
        else:
            Holiday.create(vals)
        year = kwargs.get("year")
        if not year and holiday_date:
            year = int(str(holiday_date)[:4])
        return {
            "success": True,
            "holidays": Holiday.serialize_list(request.env.company, year),
        }

    @http.route(
        "/api/dms/general/holiday/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_holiday_delete(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        holiday_id = kwargs.get("id")
        if not holiday_id:
            return {"success": False, "message": "Holiday id is required."}
        row = request.env["doc.dms.public.holiday"].browse(int(holiday_id))
        if not row.exists() or row.company_id != request.env.company:
            return {"success": False, "message": "Holiday not found."}
        year = row.year
        row.unlink()
        return {
            "success": True,
            "holidays": request.env["doc.dms.public.holiday"].serialize_list(
                request.env.company, year
            ),
        }

    @http.route(
        "/api/dms/general/holidays/copy-last-year",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_holidays_copy_last_year(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        year = kwargs.get("year")
        if not year:
            return {"success": False, "message": "Target year is required."}
        try:
            request.env["doc.dms.public.holiday"].copy_from_last_year(
                request.env.company, int(year)
            )
        except ValidationError as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "holidays": request.env["doc.dms.public.holiday"].serialize_list(
                request.env.company, int(year)
            ),
        }

    @http.route(
        "/api/dms/general/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_general_save(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        service = request.env["doc.dms.general.service"]
        emitter = request.env.get("doc.audit.emitter.service")
        audit_keys = [
            "timezone",
            "date_format",
            "language",
            "working_weekdays",
            "reminder_digest_time",
        ]
        before = (
            {key: service.build_general_payload().get(key) for key in audit_keys}
            if emitter
            else {}
        )
        try:
            service.save_general(kwargs)
        except ValidationError as error:
            return {"success": False, "message": str(error)}
        if emitter:
            after = {key: service.build_general_payload().get(key) for key in audit_keys}
            changes = emitter.diff_dict(before, after, audit_keys)
            emitter.log_settings_changes(
                request.env.company,
                "General",
                "Settings → General",
                changes,
            )
        return {"success": True}

    @http.route(
        "/api/dms/approval-workflow/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def approval_workflow_save(self, **kwargs):
        workspace_ctx(kwargs)
        service = request.env["doc.approval.workflow.service"]
        if "enabled" in kwargs and len(kwargs) == 1:
            enabled = bool(kwargs.get("enabled"))
            config = request.env["doc.employee.files.config"].get_for_company().sudo()
            config.approval_workflow_enabled = enabled
            service._sync_legacy_enabled_param(enabled)
            if enabled:
                request.env[
                    "doc.approval.workflow.migration"
                ].clear_type_level_approval_config(deactivate_exceptions=False)
            return {"success": True}
        return service.save_settings(kwargs)

    @http.route(
        "/api/dms/modules/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dms_modules_save(self, **kwargs):
        workspace_ctx(kwargs)
        denied = self._require_general_admin()
        if denied:
            return denied
        modules = kwargs.get("modules")
        if modules is None and isinstance(kwargs.get("payload"), dict):
            modules = kwargs["payload"].get("modules")
        service = request.env["doc.dms.tenant.modules.service"]
        try:
            result = service.write_modules(modules or {})
        except ValidationError as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "data": {
                "modules": result["modules"],
                "notes": result.get("notes") or [],
            },
        }
