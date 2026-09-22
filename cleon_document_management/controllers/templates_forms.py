# -*- coding: utf-8 -*-
import base64
import csv
import hashlib
import io
import json
import time
from datetime import timedelta

from odoo import fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from ..models.template import validate_upload

RATE_WINDOW_SECONDS = 60
RATE_LIMITS = {
    "export": 8,
    "upload": 20,
    "ai": 12,
    "email": 8,
}


class TemplatesFormsController(http.Controller):
    def _is_manager(self):
        user = request.env.user
        return user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_manager"
        )

    def _deny(self, message="You are not allowed to manage templates and forms."):
        request.env["doc.template.audit.event"].log_event(
            "permission", "denied", detail=message, severity="warning"
        )
        return {"success": False, "message": message}

    def _require_manager(self):
        if not self._is_manager():
            raise AccessError("You are not allowed to manage templates and forms.")

    def _rate_limit(self, action):
        Audit = request.env["doc.template.audit.event"].sudo()
        since = fields.Datetime.now() - timedelta(seconds=RATE_WINDOW_SECONDS)
        count = Audit.search_count(
            [
                ("event_type", "=", "rate"),
                ("action", "=", action),
                ("user_id", "=", request.env.user.id),
                ("create_date", ">=", since),
            ]
        )
        if count >= RATE_LIMITS.get(action, 10):
            raise UserError("Too many %s requests. Try again shortly." % action)
        Audit.log_event("rate", action)

    def _template(self, template_id):
        record = request.env["doc.template"].browse(int(template_id)).exists()
        if not record:
            raise ValidationError("Template not found.")
        record.check_access_rule("read")
        return record

    def _document(self, document_id):
        record = request.env["doc.template.document"].browse(int(document_id)).exists()
        if not record:
            raise ValidationError("Document not found.")
        record.check_access_rule("read")
        return record

    def _params(self, kwargs):
        sort = kwargs.get("sort") or "name"
        direction = kwargs.get("dir") or "asc"
        kind = kwargs.get("kind") or kwargs.get("tab") or "template"
        if kind in ("templates", "template"):
            kind = "template"
        else:
            kind = "form"
        limit = min(int(kwargs.get("limit") or 24), 100)
        cursor = int(kwargs.get("cursor") or 0)
        return {
            "kind": kind,
            "q": kwargs.get("q") or "",
            "sort": sort,
            "dir": direction,
            "favourite": bool(kwargs.get("favourite")),
            "recent": bool(kwargs.get("recent")),
            "category_ids": kwargs.get("category_ids") or [],
            "limit": limit,
            "cursor": cursor,
        }

    def _counts(self, params):
        Template = request.env["doc.template"]
        template_domain = Template.library_domain("template", params)
        form_domain = Template.library_domain("form", params)
        # Counts ignore kind so tab badges stay live for the same filters.
        params_no_kind = dict(params)
        return {
            "templates": Template.search_count(template_domain),
            "forms": Template.search_count(form_domain),
        }

    @http.route(
        "/api/templates-forms/categories",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def categories(self, **kwargs):
        records = request.env["doc.template.category"].search(
            [("active", "=", True)], order="sequence, name"
        )
        return {
            "success": True,
            "data": [
                {
                    "id": item.id,
                    "name": item.name,
                    "applies_to": item.applies_to,
                }
                for item in records
            ],
        }

    @http.route(
        "/api/templates-forms",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_or_create(self, **kwargs):
        if kwargs.get("name") and kwargs.get("category_id") and kwargs.get("kind"):
            self._require_manager()
            return self._create_metadata(kwargs)
        params = self._params(kwargs)
        Template = request.env["doc.template"]
        domain = Template.library_domain(params["kind"], params)
        if params["cursor"]:
            if params["dir"] == "desc":
                domain.append(("id", "<", params["cursor"]))
            else:
                domain.append(("id", ">", params["cursor"]))
        records = Template.search(
            domain, order=Template.library_order(params["sort"], params["dir"]), limit=params["limit"] + 1
        )
        has_more = len(records) > params["limit"]
        records = records[: params["limit"]]
        counts = {
            "templates": Template.search_count(Template.library_domain("template", params)),
            "forms": Template.search_count(Template.library_domain("form", params)),
        }
        return {
            "success": True,
            "data": {
                "items": [item.to_library_dict() for item in records],
                "counts": counts,
                "next_cursor": records[-1].id if has_more and records else False,
            },
        }

    def _create_metadata(self, kwargs):
        category = request.env["doc.template.category"].browse(int(kwargs["category_id"])).exists()
        if not category:
            return {"success": False, "message": "Category is required."}
        record = request.env["doc.template"].create(
            {
                "name": kwargs["name"],
                "kind": "form" if kwargs.get("kind") == "form" else "template",
                "category_id": category.id,
                "description": (kwargs.get("description") or "")[:500],
                "icon": kwargs.get("icon") or "📄",
                "status": "uploading",
            }
        )
        request.env["doc.template.audit.event"].log_event(
            "upload", "created", template_ids=record.ids
        )
        return {"success": True, "data": record.to_library_dict()}

    @http.route(
        ["/api/templates-forms/<int:template_id>"],
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_or_patch(self, template_id, **kwargs):
        record = self._template(template_id)
        action = kwargs.get("action")
        if action == "favourite":
            record.action_toggle_favourite()
            return {"success": True, "data": record.to_library_dict()}
        if action == "opened":
            record.action_mark_opened()
            return {"success": True, "data": record.to_library_dict()}
        if action == "archive":
            self._require_manager()
            record.action_archive()
            return {"success": True, "data": record.to_library_dict()}
        if action == "retry":
            self._require_manager()
            record.process_source_file()
            return {"success": True, "data": record.to_library_dict()}
        if kwargs.get("name") or kwargs.get("description") or kwargs.get("icon"):
            self._require_manager()
            vals = {}
            if kwargs.get("name"):
                vals["name"] = kwargs["name"]
            if "description" in kwargs:
                vals["description"] = (kwargs.get("description") or "")[:500]
            if kwargs.get("icon"):
                vals["icon"] = kwargs["icon"]
            record.write(vals)
            return {"success": True, "data": record.to_library_dict()}
        return {"success": True, "data": record.to_library_dict()}

    @http.route(
        "/api/templates-forms/upload",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def upload(self, **kwargs):
        try:
            self._require_manager()
            self._rate_limit("upload")
            upload = (request.httprequest.files.getlist("file") or [None])[0]
            if not upload:
                return request.make_json_response(
                    {"success": False, "message": "A file is required."}, status=400
                )
            raw = upload.read()
            validate_upload(upload.filename, upload.mimetype, len(raw))
            kind = "form" if request.httprequest.form.get("kind") == "form" else "template"
            category_id = request.httprequest.form.get("category_id")
            description = (request.httprequest.form.get("description") or "")[:500]
            icon = request.httprequest.form.get("icon") or "📄"
            name = request.httprequest.form.get("name") or (upload.filename or "Untitled")
            if "." in name:
                name = name.rsplit(".", 1)[0]
            category = request.env["doc.template.category"].browse(int(category_id or 0)).exists()
            if not category:
                return request.make_json_response(
                    {"success": False, "message": "Category is required."}, status=400
                )
            Template = request.env["doc.template"]
            record = Template.create(
                {
                    "name": name,
                    "kind": kind,
                    "category_id": category.id,
                    "description": description,
                    "icon": icon,
                    "file_name": upload.filename,
                    "file_size": len(raw),
                    "status": "processing",
                }
            )
            record.scan_upload(upload.filename, upload.mimetype, raw)
            attachment = request.env["ir.attachment"].create(
                {
                    "name": upload.filename or "template",
                    "datas": base64.b64encode(raw),
                    "mimetype": upload.mimetype or "application/octet-stream",
                    "res_model": "doc.template",
                    "res_id": record.id,
                }
            )
            version = request.env["doc.template.version"].create(
                {
                    "template_id": record.id,
                    "version_number": 1,
                    "source_attachment_id": attachment.id,
                }
            )
            record.write(
                {
                    "current_version_id": version.id,
                    "source_attachment_id": attachment.id,
                }
            )
            record.process_source_file()
            request.env["doc.template.audit.event"].log_event(
                "upload", "uploaded", template_ids=record.ids
            )
            return request.make_json_response(
                {"success": True, "data": record.to_library_dict()}
            )
        except (AccessError, UserError, ValidationError) as error:
            return request.make_json_response(
                {"success": False, "message": str(error)}, status=400
            )

    @http.route(
        "/api/templates/<int:template_id>/generate",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def generate(self, template_id, **kwargs):
        self._require_manager()
        template = self._template(template_id)
        employee = False
        if kwargs.get("employee_id"):
            employee = request.env["hr.employee"].browse(int(kwargs["employee_id"])).exists()
        document = request.env["doc.template.document"].generate_from_template(
            template,
            employee=employee,
            extra=kwargs.get("values") or {},
            client_token=kwargs.get("client_token"),
        )
        return {"success": True, "data": document.to_dict()}

    @http.route(
        "/api/templates/<int:template_id>/assignments",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def start_assignment(self, template_id, **kwargs):
        self._require_manager()
        template = self._template(template_id)
        assignment = request.env["doc.template.assignment"].start_assignment(
            template, client_token=kwargs.get("client_token")
        )
        return {"success": True, "data": assignment.to_dict()}

    @http.route(
        "/api/assignments/<int:assignment_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assignment(self, assignment_id, **kwargs):
        self._require_manager()
        assignment = request.env["doc.template.assignment"].browse(int(assignment_id)).exists()
        if not assignment:
            return {"success": False, "message": "Assignment not found."}
        action = kwargs.get("action")
        if action == "recipients":
            return {
                "success": True,
                "data": assignment.action_set_recipients(kwargs.get("employee_ids") or []),
            }
        if action == "field-values":
            return {
                "success": True,
                "data": assignment.action_set_field_values(kwargs.get("values") or {}),
            }
        if action == "preview":
            return {"success": True, "data": assignment.action_preview()}
        if action == "confirm":
            return {"success": True, "data": assignment.action_confirm()}
        if action == "cancel":
            assignment.action_cancel()
            return {"success": True, "data": assignment.to_dict()}
        return {"success": True, "data": assignment.to_dict()}

    @http.route(
        "/api/templates-forms/employees",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def employees(self, **kwargs):
        self._require_manager()
        Employee = request.env["hr.employee"]
        domain = [("active", "=", True)]
        if "company_id" in Employee._fields:
            domain.append(("company_id", "in", [request.env.company.id, False]))
        query = (kwargs.get("q") or "").strip()
        if query:
            domain += ["|", ("name", "ilike", query), ("work_email", "ilike", query)]
        if kwargs.get("department_id"):
            domain.append(("department_id", "=", int(kwargs["department_id"])))
        if kwargs.get("job_id") and "job_id" in Employee._fields:
            domain.append(("job_id", "=", int(kwargs["job_id"])))
        if kwargs.get("grade_id") and "grade_id" in Employee._fields:
            domain.append(("grade_id", "=", int(kwargs["grade_id"])))
        if kwargs.get("branch_id") and "branch_id" in Employee._fields:
            domain.append(("branch_id", "=", int(kwargs["branch_id"])))
        employees = Employee.search(domain, order="name", limit=200)
        departments = request.env["hr.department"].search([], order="name", limit=200)
        jobs = []
        if "hr.job" in request.env:
            jobs = [{"id": item.id, "name": item.name} for item in request.env["hr.job"].search([], limit=200)]
        return {
            "success": True,
            "data": {
                "employees": [self._employee_row(item) for item in employees],
                "departments": [{"id": item.id, "name": item.name} for item in departments],
                "jobs": jobs,
            },
        }

    def _employee_row(self, employee):
        initials = "".join(part[:1] for part in (employee.name or "").split()[:2]).upper()
        grade = ""
        if "grade_id" in employee._fields:
            grade = employee.grade_id.name or ""
        branch = ""
        if "branch_id" in employee._fields:
            branch = employee.branch_id.name or ""
        return {
            "id": employee.id,
            "name": employee.name,
            "email": employee.work_email or "",
            "department": employee.department_id.name or "",
            "role": employee.job_id.name if "job_id" in employee._fields else "",
            "grade": grade,
            "branch": branch,
            "initials": initials or "?",
        }

    @http.route(
        "/api/forms/<int:form_id>/submissions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def start_submission(self, form_id, **kwargs):
        form = self._template(form_id)
        submission = request.env["doc.template.submission"].start_or_get_draft(form)
        return {"success": True, "data": submission.to_dict()}

    @http.route(
        "/api/submissions/<int:submission_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def submission(self, submission_id, **kwargs):
        submission = request.env["doc.template.submission"].browse(int(submission_id)).exists()
        if not submission:
            return {"success": False, "message": "Submission not found."}
        if submission.user_id != request.env.user and not self._is_manager():
            return self._deny("You cannot access this submission.")
        action = kwargs.get("action")
        if action == "save":
            return {
                "success": True,
                "data": submission.action_save_draft(
                    kwargs.get("response_json") or "", kwargs.get("answers") or {}
                ),
            }
        if action == "submit":
            return {"success": True, "data": submission.action_submit()}
        if action == "review":
            self._require_manager()
            return {
                "success": True,
                "data": submission.action_review(kwargs.get("status"), kwargs.get("note") or ""),
            }
        if action == "reopen":
            return {"success": True, "data": submission.action_reopen()}
        return {"success": True, "data": submission.to_dict()}

    @http.route(
        "/api/documents/<int:document_id>/autosave",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def autosave(self, document_id, **kwargs):
        document = self._document(document_id)
        data = document.action_autosave(
            kwargs.get("document_json") or "",
            kwargs.get("rendered_text") or "",
            kwargs.get("language"),
        )
        return {"success": True, "data": data}

    @http.route(
        "/api/documents/<int:document_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def document(self, document_id, **kwargs):
        document = self._document(document_id)
        if kwargs.get("track_changes") is not None:
            document.track_changes = bool(kwargs.get("track_changes"))
        comments = [item.to_dict() for item in document.env["doc.template.comment"].search([("document_id", "=", document.id)])]
        changes = [item.to_dict() for item in document.env["doc.template.tracked.change"].search([("document_id", "=", document.id)])]
        messages = [
            item.to_dict()
            for item in document.env["doc.template.ai.message"].search(
                [("document_id", "=", document.id)]
            )
        ]
        revisions = [
            {
                "id": item.id,
                "revision_number": item.revision_number,
                "created_at": fields.Datetime.to_string(item.create_date) or "",
                "author": item.created_by.name,
            }
            for item in document.env["doc.template.revision"].search(
                [("document_id", "=", document.id)], limit=20
            )
        ]
        data = document.to_dict()
        data.update({"comments": comments, "tracked_changes": changes, "ai_messages": messages, "revisions": revisions})
        return {"success": True, "data": data}

    @http.route(
        "/api/documents/<int:document_id>/comments",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def comments(self, document_id, **kwargs):
        document = self._document(document_id)
        comment = request.env["doc.template.comment"].create(
            {
                "document_id": document.id,
                "body": kwargs.get("body") or "",
                "selection": kwargs.get("selection") or "",
            }
        )
        return {"success": True, "data": comment.to_dict()}

    @http.route(
        "/api/documents/<int:document_id>/ai-actions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ai_actions(self, document_id, **kwargs):
        self._require_manager()
        self._rate_limit("ai")
        document = self._document(document_id)
        action = kwargs.get("action") or "rewrite"
        prompt = kwargs.get("prompt") or ""
        selection = kwargs.get("selection") or document.rendered_text or ""
        if action == "apply":
            message = request.env["doc.template.ai.message"].browse(int(kwargs.get("message_id") or 0)).exists()
            if not message:
                return {"success": False, "message": "Proposal not found."}
            before = document.rendered_text or ""
            after = message.proposal or message.response or ""
            document.write({"rendered_text": after})
            message.applied = True
            request.env["doc.template.tracked.change"].create(
                {
                    "document_id": document.id,
                    "change_type": "replace",
                    "before_text": before,
                    "after_text": after,
                    "applied": True,
                }
            )
            request.env["doc.template.audit.event"].log_event(
                "ai",
                "applied",
                document_ids=document.ids,
                prompt=message.prompt,
                model_name=message.model_name,
                applied_result=after[:2000],
            )
            return {"success": True, "data": message.to_dict()}
        if action == "reject":
            message = request.env["doc.template.ai.message"].browse(int(kwargs.get("message_id") or 0)).exists()
            if message:
                message.applied = False
            return {"success": True, "data": message.to_dict() if message else {}}
        from ..models.intelligence_groq import LLM_MODEL, complete_chat, groq_configured

        if not groq_configured(request.env):
            return {"success": False, "message": "AI is not configured on the server."}
        instructions = {
            "rewrite": "Rewrite the selected HR document text more clearly. Return only the rewritten text.",
            "summarize": "Summarize the HR document in a short professional paragraph. Return only the summary.",
            "clause": "Propose a professional clause to insert. Return only the clause.",
            "compliance": "Review the text for HR compliance issues. This is advisory, not legal advice. Return findings then a revised draft after a line with ---DRAFT---.",
        }
        user_prompt = prompt or instructions.get(action, instructions["rewrite"])
        try:
            response = complete_chat(
                [
                    {
                        "role": "system",
                        "content": "You assist with HR document drafting. Never claim legal advice. Keep employee data. Return plain text.",
                    },
                    {
                        "role": "user",
                        "content": "%s\n\nDocument:\n%s" % (user_prompt, selection[:8000]),
                    },
                ],
                env=request.env,
            )
        except Exception as error:
            request.env["doc.template.audit.event"].log_event(
                "ai", "error", document_ids=document.ids, detail=str(error), severity="error"
            )
            return {"success": False, "message": "The AI provider timed out or refused the request."}
        proposal = response
        if "---DRAFT---" in response:
            proposal = response.split("---DRAFT---", 1)[-1].strip()
        message = request.env["doc.template.ai.message"].create(
            {
                "document_id": document.id,
                "conversation_key": kwargs.get("conversation_key") or "default",
                "role": "assistant",
                "prompt": user_prompt,
                "response": response,
                "proposal": proposal,
                "model_name": LLM_MODEL,
            }
        )
        request.env["doc.template.ai.message"].create(
            {
                "document_id": document.id,
                "conversation_key": kwargs.get("conversation_key") or "default",
                "role": "user",
                "prompt": user_prompt,
            }
        )
        request.env["doc.template.audit.event"].log_event(
            "ai",
            action,
            document_ids=document.ids,
            prompt=user_prompt,
            model_name=LLM_MODEL,
        )
        return {"success": True, "data": message.to_dict()}

    @http.route(
        "/api/templates-forms/export",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def export_library(self, **kwargs):
        self._require_manager()
        self._rate_limit("export")
        params = self._params(kwargs)
        Template = request.env["doc.template"]
        records = Template.search(
            Template.library_domain(params["kind"], params),
            order=Template.library_order(params["sort"], params["dir"]),
            limit=2000,
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Name", "Type", "Category", "Status", "Updated", "Description"])
        for item in records:
            writer.writerow(
                [
                    item.name,
                    item.kind,
                    item.category_id.name,
                    item.status,
                    fields.Datetime.to_string(item.write_date),
                    item.description or "",
                ]
            )
        csv_text = output.getvalue()
        html = [
            "<html><body><h1>Templates &amp; Forms export</h1>",
            "<p>Kind: %s | Query: %s</p>" % (params["kind"], params["q"] or "all"),
            "<table border='1' cellpadding='6'><tr><th>Name</th><th>Type</th><th>Category</th><th>Status</th></tr>",
        ]
        for item in records:
            html.append(
                "<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                % (item.name, item.kind, item.category_id.name, item.status)
            )
        html.append("</table></body></html>")
        html_text = "".join(html)
        if kwargs.get("email"):
            self._rate_limit("email")
            request.env["mail.mail"].sudo().create(
                {
                    "subject": "Templates & Forms export",
                    "body_html": html_text,
                    "email_to": kwargs["email"],
                    "auto_delete": False,
                }
            )
            request.env["doc.template.audit.event"].log_event(
                "export", "email", detail=kwargs["email"]
            )
        request.env["doc.template.audit.event"].log_event(
            "export", kwargs.get("format") or "csv", detail=params["q"]
        )
        token = hashlib.sha256(
            ("%s-%s-%s" % (request.env.user.id, time.time(), csv_text[:80])).encode()
        ).hexdigest()[:32]
        request.env["ir.config_parameter"].sudo().set_param(
            "cleon_document_management.export_%s" % token,
            json.dumps({"csv": csv_text, "html": html_text, "expires": time.time() + 600}),
        )
        return {
            "success": True,
            "data": {
                "csv": csv_text,
                "html": html_text,
                "download_url": "/document-management/api/templates-forms/export/%s" % token,
                "count": len(records),
            },
        }

    @http.route(
        "/document-management/api/templates-forms/export/<string:token>",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def download_export(self, token, **kwargs):
        raw = request.env["ir.config_parameter"].sudo().get_param(
            "cleon_document_management.export_%s" % token
        )
        if not raw:
            return request.not_found()
        payload = json.loads(raw)
        if payload.get("expires", 0) < time.time():
            return request.not_found()
        fmt = kwargs.get("format") or "csv"
        if fmt == "html":
            return request.make_response(
                payload["html"],
                headers=[("Content-Type", "text/html; charset=utf-8")],
            )
        return request.make_response(
            payload["csv"],
            headers=[
                ("Content-Type", "text/csv; charset=utf-8"),
                ("Content-Disposition", "attachment; filename=templates-forms.csv"),
            ],
        )
