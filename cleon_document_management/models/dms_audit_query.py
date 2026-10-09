# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.osv import expression


class DocAuditQueryService(models.AbstractModel):
    _name = "doc.audit.query.service"
    _description = "Unified audit query API (C7)"

    MODULE_LABELS = {
        "doc.document": "employee_files",
        "doc.folder": "organizational_files",
        "doc.document.type": "settings",
        "res.users": "settings",
    }

    @api.model
    def query(self, filters=None, page=1, page_size=50):
        user = self.env.user
        filters = filters or {}
        domain = []
        if filters.get("date_from"):
            domain.append(("occurred_at", ">=", filters["date_from"]))
        if filters.get("date_to"):
            domain.append(("occurred_at", "<=", filters["date_to"]))
        if filters.get("action"):
            domain.append(("action", "ilike", filters["action"]))
        if filters.get("person_id"):
            domain.append(("actor_id", "=", int(filters["person_id"])))
        if filters.get("search"):
            term = filters["search"]
            domain = expression.AND(
                [
                    domain,
                    ["|", ("summary", "ilike", term), ("action", "ilike", term)],
                ]
            )
        page = max(int(page or 1), 1)
        page_size = min(max(int(page_size or 50), 1), 200)
        Audit = self.env["doc.object.audit"].sudo()
        if not self._user_may_query_audit(user):
            return {"items": [], "total": 0, "page": page, "page_size": page_size}
        total = Audit.search_count(domain)
        rows = Audit.search(
            domain,
            limit=page_size,
            offset=(page - 1) * page_size,
            order="occurred_at desc, id desc",
        )
        items = [self._serialize_row(row) for row in rows]
        if filters.get("module"):
            wanted = filters["module"]
            items = [item for item in items if item.get("module") == wanted]
        if filters.get("result") == "denied":
            items = [
                item
                for item in items
                if "denied" in (item.get("action") or "").lower()
                or "refused" in (item.get("summary") or "").lower()
            ]
        elif filters.get("result") == "success":
            items = [
                item
                for item in items
                if "denied" not in (item.get("action") or "").lower()
            ]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @api.model
    def get_event(self, event_id):
        if not self._user_may_query_audit(self.env.user):
            return None
        row = self.env["doc.object.audit"].sudo().browse(int(event_id)).exists()
        if not row:
            return None
        data = self._serialize_row(row)
        data["details"] = row.details or ""
        return data

    @api.model
    def _user_may_query_audit(self, user):
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        if user.has_group("base.group_system"):
            return True
        perm = self.env["doc.organizational.files.permission"]
        if hasattr(perm, "user_has_org_permission"):
            return perm.user_has_org_permission(user, "view_audit_activity")
        return False

    @api.model
    def _serialize_row(self, row):
        module = self.MODULE_LABELS.get(row.res_model, "document_management")
        result = "success"
        if "denied" in (row.action or "").lower() or "refused" in (row.summary or "").lower():
            result = "denied"
        return {
            "id": row.id,
            "occurred_at": fields.Datetime.to_string(row.occurred_at),
            "person_id": row.actor_id.id,
            "person_name": row.actor_id.name,
            "action": row.action,
            "summary": row.summary,
            "record_model": row.res_model,
            "record_id": row.res_id,
            "module": module,
            "result": result,
        }
