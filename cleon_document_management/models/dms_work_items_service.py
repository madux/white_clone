# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import _, api, fields, models


class DmsWorkItemsService(models.AbstractModel):
    _name = "doc.dms.work.items.service"
    _description = "My Workspace unified to-do feed (C5)"

    @api.model
    def _today(self):
        return fields.Date.context_today(self)

    @api.model
    def _week_end(self, today):
        return today + timedelta(days=7)

    @api.model
    def _due_bucket(self, due_date, today):
        if not due_date:
            return "due_this_week"
        if due_date < today:
            return "overdue"
        if due_date <= self._week_end(today):
            return "due_this_week"
        return "later"

    @api.model
    def _overdue_label(self, due_date, today):
        if not due_date or due_date >= today:
            return ""
        days = (today - due_date).days
        if days == 1:
            return _("1 day overdue")
        return _("%(days)s days overdue") % {"days": days}

    @api.model
    def _serialize_item(
        self,
        key,
        kind,
        title,
        subtitle,
        due_date,
        status_label="",
        status_tone="neutral",
        action_label="",
        action_variant="outline",
        href="",
        icon="",
        sort_date=None,
    ):
        today = self._today()
        bucket = self._due_bucket(due_date, today)
        if not status_label and bucket == "overdue" and due_date:
            status_label = self._overdue_label(due_date, today)
            status_tone = "danger"
        return {
            "id": key,
            "kind": kind,
            "icon": icon or kind,
            "title": title,
            "subtitle": subtitle,
            "urgency": bucket,
            "due_date": str(due_date or ""),
            "status_label": status_label or "",
            "status_tone": status_tone,
            "action_label": action_label or _("Open"),
            "action_variant": action_variant,
            "href": href or "/pages/my-workspace/?tab=todo",
            "_sort": sort_date or due_date or today,
        }

    @api.model
    def _compliance_action(self, item):
        action = item.get("primary_action") or "none"
        if action == "resubmit":
            return _("Upload again"), "outline", "upload"
        if action == "upload":
            return _("Upload"), "outline", "upload"
        if action == "complete_task":
            task_type = item.get("task_type") or ""
            if task_type in ("read", "acknowledge", "declaration"):
                return _("Open policy"), "outline", "policy"
            if task_type == "complete_form":
                return _("Fill form"), "outline", "form"
            if task_type == "upload_evidence":
                return _("Upload again"), "outline", "upload"
            return _("Complete now"), "outline", "compliance"
        if action == "view":
            return _("View"), "outline", "compliance"
        return "", "outline", "compliance"

    @api.model
    def _compliance_href(self, item):
        params = ["tab=policies"]
        if item.get("task_id"):
            params.append("task=%s" % item["task_id"])
        elif item.get("evaluation_line_id"):
            params.append("line=%s" % item["evaluation_line_id"])
        return "/pages/my-workspace/?%s" % "&".join(params)

    @api.model
    def _collect_compliance_items(self, employee):
        if not employee:
            return []
        inbox = self._compliance_inbox_for_employee(employee)
        items = []
        for raw in inbox.get("items") or []:
            if raw.get("tab") != "todo":
                continue
            action = raw.get("primary_action") or "none"
            if action in ("none", "view"):
                continue
            due = False
            if raw.get("due_date"):
                try:
                    due = fields.Date.from_string(str(raw["due_date"])[:10])
                except (TypeError, ValueError):
                    due = False
            action_label, variant, icon = self._compliance_action(raw)
            if not action_label:
                continue
            status_label = raw.get("status_label") or ""
            tone = "danger" if status_label.lower().startswith("rejected") else "neutral"
            subtitle = raw.get("policy") or raw.get("subtitle") or ""
            if raw.get("kind") == "task" and raw.get("task_type") == "complete_form":
                subtitle = _("Templates & Forms • %(policy)s") % {"policy": subtitle}
            elif "organisational" not in (subtitle or "").lower():
                module = _("Compliance")
                if icon == "policy":
                    module = _("Organisational Files • Policies")
                subtitle = "%s • %s" % (subtitle, module) if subtitle else module
            items.append(
                self._serialize_item(
                    "compliance-%s" % raw.get("id"),
                    "compliance",
                    raw.get("title") or _("Compliance task"),
                    subtitle,
                    due,
                    status_label=status_label,
                    status_tone=tone,
                    action_label=action_label,
                    action_variant=variant,
                    href=self._compliance_href(raw),
                    icon=icon,
                )
            )
        return items

    @api.model
    def _compliance_inbox_for_employee(self, employee):
        """Workspace feed is server-side; employees lack policy model ACLs."""
        if not employee:
            return {}
        return (
            self.env["doc.compliance.employee.inbox"]
            .sudo()
            .build_for_employee(employee)
        )

    @api.model
    def _esign_enabled_for_employee(self, employee):
        if not employee:
            return False
        company = employee.company_id or self.env.company
        config = self.env["doc.employee.files.config"].get_for_company(company)
        return bool(config.enable_esign)

    @api.model
    def _signature_request_domain(self, employee, state=None):
        domain = [("signer_employee_id", "=", employee.id)]
        if state:
            domain.append(("state", "=", state))
        return domain

    @api.model
    def _signature_requests_for_employee(self, employee, state=None, limit=50):
        """Signers are document users, not managers; scope reads via sudo + domain."""
        if not employee or not self._esign_enabled_for_employee(employee):
            return self.env["doc.document.signature.request"].browse()
        Signature = self.env["doc.document.signature.request"].sudo()
        domain = self._signature_request_domain(employee, state=state)
        if limit is None:
            return Signature.search(domain, order="create_date asc")
        return Signature.search(domain, order="create_date asc", limit=limit)

    @api.model
    def _signature_request_count(self, employee, state=None):
        if not employee or not self._esign_enabled_for_employee(employee):
            return 0
        Signature = self.env["doc.document.signature.request"].sudo()
        return Signature.search_count(self._signature_request_domain(employee, state=state))

    @api.model
    def _collect_signature_items(self, employee):
        if not employee or not self._esign_enabled_for_employee(employee):
            return []
        requests = self._signature_requests_for_employee(
            employee, state="requested", limit=50
        )
        items = []
        for sig in requests:
            document = sig.document_id
            requester = sig.requested_by_id.name or _("HR")
            due = fields.Date.to_date(sig.create_date) + timedelta(days=14)
            employee_id = document.employee_id.id if document.employee_id else False
            href = "/pages/my-workspace/?tab=documents"
            if employee_id and document:
                href = (
                    "/pages/employee/profile/?employee=%s&doc=%s"
                    % (employee_id, document.id)
                )
            items.append(
                self._serialize_item(
                    "signature-%s" % sig.id,
                    "signature",
                    document.name if document else _("Signature request"),
                    _("From %(name)s • Employee Files") % {"name": requester},
                    due,
                    action_label=_("Review and sign"),
                    action_variant="primary",
                    href=href,
                    icon="sign",
                    sort_date=due,
                )
            )
        return items

    @api.model
    def _collect_rejected_uploads(self, employee, user):
        if not employee:
            return []
        documents = self.env["doc.document"].search(
            [
                ("employee_id", "=", employee.id),
                ("approval_state", "=", "rejected"),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ],
            order="write_date desc",
            limit=20,
        )
        items = []
        for document in documents:
            policy = document.document_type_id.name or _("Employee Files")
            reason = document.rejection_reason or _("Rejected")
            items.append(
                self._serialize_item(
                    "rejected-%s" % document.id,
                    "upload",
                    _("Upload %(type)s") % {"type": document.document_type_id.name or document.name},
                    policy,
                    self._today(),
                    status_label=_("Rejected: %s") % reason,
                    status_tone="danger",
                    action_label=_("Upload again"),
                    action_variant="outline",
                    href="/pages/my-workspace/?tab=policies",
                    icon="upload",
                )
            )
        return items

    @api.model
    def _collect_approval_items(self, user):
        Approval = self.env["doc.organizational.approval.request"]
        domain = [
            ("company_id", "=", user.company_id.id),
            ("state", "=", "pending"),
            "|",
            ("assigned_approver_ids", "in", user.id),
            ("fallback_approver_ids", "in", user.id),
        ]
        requests = Approval.search(domain, order="due_at asc, create_date asc", limit=30)
        items = []
        for req in requests:
            due = fields.Date.to_date(req.due_at) if req.due_at else False
            target_label = req.serialize_for_api().get("target_label") or _(
                "Organisational Files"
            )
            items.append(
                self._serialize_item(
                    "approval-%s" % req.id,
                    "approval",
                    req.name or _("Approval request"),
                    target_label,
                    due,
                    action_label=_("Review"),
                    action_variant="primary",
                    href="/pages/organization/?tab=approvals",
                    icon="approval",
                )
            )
        return items

    @api.model
    def _document_metrics(self, user, employee):
        if not employee:
            return {"total": 0, "expiring_soon": 0}
        today = self._today()
        base = [
            ("employee_id", "=", employee.id),
            ("active", "=", True),
            ("deleted_at", "=", False),
        ]
        total = self.env["doc.document"].search_count(base)
        expiry_cutoff = today + timedelta(days=30)
        expiring = self.env["doc.document"].search_count(
            base
            + [
                ("has_expiry", "=", True),
                ("expiry_date", "<=", expiry_cutoff),
                ("state", "=", "approved"),
            ]
        )
        return {"total": total, "expiring_soon": expiring}

    @api.model
    def _compliance_metrics(self, employee):
        if not employee:
            return {
                "status_label": _("Compliant"),
                "status_detail": _("0 policies"),
                "policies_todo": 0,
            }
        inbox = self._compliance_inbox_for_employee(employee)
        overall = inbox.get("overall_status") or "compliant"
        evaluations = (
            self.env["doc.compliance.evaluation"]
            .sudo()
            .search([("employee_id", "=", employee.id)])
            .filtered(lambda row: row.policy_id.active)
        )
        total = len(evaluations)
        compliant = len(evaluations.filtered(lambda e: e.status == "compliant"))
        if overall == "non_compliant":
            label = _("Non-compliant")
        elif overall == "at_risk":
            label = _("At risk")
        else:
            label = _("Compliant")
        detail = _("%(ok)s of %(total)s policies") % {
            "ok": compliant,
            "total": total or compliant,
        }
        return {
            "status_label": label,
            "status_detail": detail,
            "policies_todo": inbox.get("inbox_summary", {}).get("todo", 0),
        }

    @api.model
    def build_for_user(self, user, employee=None, search=""):
        employee = employee or user.employee_id
        items = []
        items.extend(self._collect_signature_items(employee))
        items.extend(self._collect_compliance_items(employee))
        items.extend(self._collect_rejected_uploads(employee, user))
        items.extend(self._collect_approval_items(user))

        query = (search or "").strip().lower()
        if query:
            items = [
                item
                for item in items
                if query in (item.get("title") or "").lower()
                or query in (item.get("subtitle") or "").lower()
            ]

        urgency_order = {"overdue": 0, "due_this_week": 1, "later": 2}
        items.sort(
            key=lambda item: (
                urgency_order.get(item.get("urgency"), 9),
                item.get("_sort") or self._today(),
                item.get("title") or "",
            )
        )
        for item in items:
            item.pop("_sort", None)

        visible = [i for i in items if i.get("urgency") != "later"]
        overdue_count = len([i for i in visible if i.get("urgency") == "overdue"])

        doc_metrics = self._document_metrics(user, employee)
        compliance = self._compliance_metrics(employee)
        signatures = self._signature_request_count(employee, state="requested")
        next_sig = self._signature_requests_for_employee(
            employee, state="requested", limit=1
        )
        sig_due_label = ""
        if next_sig and next_sig.create_date:
            due = fields.Date.to_date(next_sig.create_date) + timedelta(days=14)
            sig_due_label = _("due %(date)s") % {
                "date": due.strftime("%d %b"),
            }

        profile = {
            "name": employee.name if employee else user.name,
            "job_title": employee.job_title if employee else "",
            "department": employee.department_id.name if employee and employee.department_id else "",
        }

        return {
            "items": visible,
            "total": len(visible),
            "overdue_count": overdue_count,
            "profile": profile,
            "summary": {
                "todo_count": len(visible),
                "todo_overdue_label": (
                    _("%(count)s overdue") % {"count": overdue_count}
                    if overdue_count
                    else _("None overdue")
                ),
                "documents_count": doc_metrics["total"],
                "documents_expiring_label": (
                    _("%(count)s expiring soon") % {"count": doc_metrics["expiring_soon"]}
                    if doc_metrics["expiring_soon"]
                    else _("None expiring soon")
                ),
                "compliance_status_label": compliance["status_label"],
                "compliance_status_detail": compliance["status_detail"],
                "signatures_count": signatures,
                "signatures_due_label": sig_due_label or _("No pending signatures"),
            },
            "tab_counts": {
                "todo": len(visible),
                "policies": compliance["policies_todo"],
            },
            "source": "dms_work_items",
        }
