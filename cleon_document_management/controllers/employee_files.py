# -*- coding: utf-8 -*-
import csv
import io
import json

from odoo import http
from odoo.exceptions import AccessError, UserError
from odoo.http import request, content_disposition



class EmployeeFilesController(http.Controller):
    @staticmethod
    def _service():
        return request.env["doc.employee.files.service"]

    @staticmethod
    def _require_manager():
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            raise AccessError("Document manager access is required.")

    @staticmethod
    def _require_admin():
        if not request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            raise AccessError("Document administrator access is required.")

    @staticmethod
    def _require_admin_or_manager():
        user = request.env.user
        if not (
            user.has_group("cleon_document_management.group_document_admin")
            or user.has_group("cleon_document_management.group_document_manager")
        ):
            raise AccessError("Document manager access is required.")

    @http.route(
        "/api/employee-files/config",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_config(self, **kwargs):
        config = request.env["doc.employee.files.config"].get_for_company()
        return {"success": True, "data": config.serialize_for_api()}

    @http.route(
        "/api/employee-files/config/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_config(self, **kwargs):
        self._require_admin()
        config = request.env["doc.employee.files.config"].get_for_company()
        writable = {
            "include_all_existing",
            "include_inactive",
            "exclude_test_employees",
            "collect_existing_documents",
            "group_name_display",
            "show_inactive_groups",
            "show_group_counts_on_cards",
            "duplicate_detection_mode",
            "max_file_size_mb",
            "allowed_file_types",
            "max_issue_retry_attempts",
            "enable_custom_groups",
            "enable_esign",
            "esign_provider",
            "sub_organizing_dimension",
        }
        values = {key: kwargs[key] for key in writable if key in kwargs}
        if "header_field_keys" in kwargs:
            config.set_header_field_keys(kwargs["header_field_keys"])
        if "error_escalation_user_id" in kwargs:
            values["error_escalation_user_id"] = int(
                kwargs["error_escalation_user_id"] or 0
            ) or False
        if "notification_routing_json" in kwargs:
            values["notification_routing_json"] = kwargs["notification_routing_json"]
        if "integration_mapping_json" in kwargs:
            values["integration_mapping_json"] = kwargs["integration_mapping_json"]
        if "category_action_matrix_json" in kwargs:
            values["category_action_matrix_json"] = kwargs["category_action_matrix_json"]
        reconcile_flags = ("include_inactive", "exclude_test_employees")
        prior = {key: config[key] for key in reconcile_flags}
        prior_dims = config.get_organizing_dimensions()
        prior_sub = config.sub_organizing_dimension
        if values:
            config.write(values)
        if "organizing_dimensions" in kwargs:
            config.set_organizing_dimensions(kwargs["organizing_dimensions"])
        dim_changed = (
            "organizing_dimensions" in kwargs
            and config.get_organizing_dimensions() != prior_dims
        )
        sub_changed = (
            "sub_organizing_dimension" in kwargs
            and config.sub_organizing_dimension != prior_sub
        )
        if (
            dim_changed
            or sub_changed
            or any(
                key in values and prior[key] != config[key] for key in reconcile_flags
            )
        ):
            self._service().reconcile_all_employees_from_ems(config.company_id)
        return {"success": True, "data": config.serialize_for_api()}

    @http.route(
        "/api/employee-files/config/header-fields",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_header_field_keys(self, header_field_keys=None, **kwargs):
        self._require_admin_or_manager()
        keys = header_field_keys
        if keys is None and "header_field_keys" in kwargs:
            keys = kwargs["header_field_keys"]
        config = request.env["doc.employee.files.config"].get_for_company()
        config.set_header_field_keys(keys or [])
        return {"success": True, "data": config.serialize_for_api()}

    @http.route(
        "/api/employee-files/config/preview",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def config_organizing_preview(self, **kwargs):
        self._require_admin()
        data = self._service().setup_preview(kwargs, persist=False)
        return {"success": True, "data": data}

    @http.route(
        "/api/employee-files/setup/preview",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def setup_preview(self, **kwargs):
        self._require_admin()
        data = self._service().setup_preview(kwargs)
        return {"success": True, "data": data}

    @http.route(
        "/api/employee-files/setup/confirm",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def setup_confirm(self, **kwargs):
        self._require_admin()
        run = self._service().setup_confirm(kwargs)
        config = request.env["doc.employee.files.config"].get_for_company()
        request.env["doc.folder"].sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("company_id", "=", config.company_id.id),
                ("is_employee_file_v3", "=", False),
                ("is_pending_uploads", "=", False),
            ]
        ).write({"legacy_employee_folder": True, "active": False})
        return {"success": True, "data": run.serialize_for_api()}

    @http.route(
        "/api/employee-files/setup/status",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def setup_status(self, run_id=None, **kwargs):
        run = request.env["doc.employee.setup.run"].browse(int(run_id or 0)).exists()
        if not run:
            run = request.env["doc.employee.setup.run"].search(
                [("company_id", "=", request.env.company.id)],
                limit=1,
                order="create_date desc",
            )
        if not run:
            return {"success": True, "data": None}
        return {"success": True, "data": run.serialize_for_api()}

    @http.route(
        "/api/employee-files/home/stats",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def home_stats(self, **kwargs):
        return {"success": True, "data": self._service().home_stats()}

    @http.route(
        "/api/employee-files/groups",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_groups(
        self,
        group_kind=None,
        dimension=None,
        search=None,
        for_home=False,
        include_all_custom=False,
        **kwargs,
    ):
        groups = self._service().list_groups(
            group_kind,
            dimension,
            search,
            bool(for_home),
            bool(include_all_custom),
        )
        return {
            "success": True,
            "data": [
                group.serialize_for_api(include_member_ids=False) for group in groups
            ],
        }

    @http.route(
        "/api/employee-files/group",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_group(self, id=None, **kwargs):
        group = request.env["doc.employee.group"].browse(int(id or 0)).exists()
        if not group:
            return {"success": False, "message": "Group not found."}
        members = [
            member.serialize_for_api(request.env.user) for member in group.member_ids
        ]
        return {
            "success": True,
            "data": {**group.serialize_for_api(), "members": members},
        }

    @http.route(
        "/api/employee-files/group/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_custom_group(self, name=None, description=None, icon=None, **kwargs):
        self._require_manager()
        config = request.env["doc.employee.files.config"].get_for_company()
        if not config.enable_custom_groups:
            return {"success": False, "message": "Custom groups are disabled."}
        if not name:
            return {"success": False, "message": "Group name is required."}
        group = request.env["doc.employee.group"].create(
            {
                "name": name,
                "description": description or "",
                "icon": icon or "",
                "group_kind": "custom",
                "company_id": request.env.company.id,
            }
        )
        return {"success": True, "data": group.serialize_for_api()}

    @http.route(
        "/api/employee-files/group/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_custom_group(
        self,
        id=None,
        name=None,
        description=None,
        show_on_home=None,
        **kwargs,
    ):
        self._require_manager()
        group = request.env["doc.employee.group"].browse(int(id or 0)).exists()
        if not group or group.group_kind != "custom":
            return {"success": False, "message": "Custom group not found."}
        values = {}
        if name is not None:
            values["name"] = name
        if description is not None:
            values["description"] = description
        if show_on_home is not None:
            values["show_on_home"] = bool(show_on_home)
        if values:
            group.write(values)
        return {"success": True, "data": group.serialize_for_api()}

    @http.route(
        "/api/employee-files/group/add-members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def add_group_members(self, id=None, employee_file_ids=None, **kwargs):
        self._require_manager()
        group = request.env["doc.employee.group"].browse(int(id or 0)).exists()
        if not group or group.group_kind != "custom":
            return {"success": False, "message": "Custom group not found."}
        ids = [int(value) for value in (employee_file_ids or [])]
        files = request.env["doc.employee.file"].browse(ids).exists()
        group.write({"member_ids": [(4, file.id) for file in files]})
        return {"success": True, "data": group.serialize_for_api()}

    @http.route(
        "/api/employee-files/group/remove-members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def remove_group_members(self, id=None, employee_file_ids=None, **kwargs):
        self._require_manager()
        group = request.env["doc.employee.group"].browse(int(id or 0)).exists()
        if not group or group.group_kind != "custom":
            return {"success": False, "message": "Custom group not found."}
        ids = [int(value) for value in (employee_file_ids or [])]
        group.write({"member_ids": [(3, file_id) for file_id in ids]})
        return {"success": True, "data": group.serialize_for_api()}

    @http.route(
        "/api/employee-files/employee-files",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_employee_files(self, search=None, limit=10, offset=0, **kwargs):
        files, total = self._service().list_employee_files(search, limit, offset)
        user = request.env.user
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        return {
            "success": True,
            "data": {
                "items": [file.serialize_for_api(user) for file in files],
                "total": total,
                "limit": limit,
                "offset": offset,
            },
        }

    @http.route(
        "/api/employee-files/group/members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_group_members(self, id=None, search=None, limit=10, offset=0, **kwargs):
        files, total = self._service().list_group_members(id, search, limit, offset)
        user = request.env.user
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        return {
            "success": True,
            "data": {
                "items": [file.serialize_for_api(user) for file in files],
                "total": total,
                "limit": limit,
                "offset": offset,
            },
        }

    @http.route(
        "/api/employee-files/employee-file",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_employee_file(self, id=None, employee_id=None, **kwargs):
        EmployeeFile = request.env["doc.employee.file"]
        employee_file = EmployeeFile.browse(int(id or 0)).exists()
        if not employee_file and employee_id:
            employee_file = EmployeeFile.search(
                [
                    ("employee_id", "=", int(employee_id)),
                    ("company_id", "=", request.env.company.id),
                ],
                limit=1,
            )
        ems_note = (
            "Organizational fields are read-only here. "
            "Update the employee record in EMS to change them."
        )
        if not employee_file and employee_id:
            employee = (
                request.env["hr.employee"]
                .sudo()
                .browse(int(employee_id))
                .exists()
            )
            if not employee:
                return {"success": False, "message": "Employee not found."}
            config = request.env["doc.employee.files.config"].get_for_company(
                employee.company_id
            )
            header_fields = self._service().build_employee_file_header_fields(
                employee, config
            )
            return {
                "success": True,
                "data": {
                    "id": False,
                    "employee_id": employee.id,
                    "employee_name": employee.name,
                    "department_id": employee.department_id.id
                    if employee.department_id
                    else False,
                    "department_name": employee.department_id.name
                    if employee.department_id
                    else "",
                    "job_title": employee.job_id.name if employee.job_id else "",
                    "document_count": 0,
                    "attention_count": 0,
                    "state": "active" if employee.active else "inactive",
                    "favorite": False,
                    "storage_folder_id": False,
                    "related_groups": [],
                    "header_fields": header_fields,
                    "ems_read_only_note": ems_note,
                },
            }
        if not employee_file:
            return {"success": False, "message": "Employee File not found."}
        employee = employee_file.employee_id
        self._service().sync_employee_system_groups(employee, employee_file)
        groups = self._service().related_groups_for_employee_file(employee_file)
        config = request.env["doc.employee.files.config"].get_for_company(
            employee_file.company_id
        )
        header_fields = self._service().build_employee_file_header_fields(
            employee, config
        )
        return {
            "success": True,
            "data": {
                **employee_file.serialize_for_api(request.env.user),
                "related_groups": [group.serialize_for_api() for group in groups],
                "header_fields": header_fields,
                "ems_read_only_note": ems_note,
            },
        }

    @http.route(
        "/api/employee-files/employee-file/documents",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_employee_file_documents(self, employee_id=None, id=None, **kwargs):
        EmployeeFile = request.env["doc.employee.file"]
        employee_file = EmployeeFile.browse(int(id or 0)).exists()
        if not employee_file and employee_id:
            employee_file = EmployeeFile.search(
                [
                    ("employee_id", "=", int(employee_id)),
                    ("company_id", "=", request.env.company.id),
                ],
                limit=1,
            )
        if not employee_file:
            return {"success": False, "message": "Employee File not found."}
        documents = self._service().list_employee_file_documents(
            employee_file, request.env.user
        )
        return {"success": True, "data": documents}

    @http.route(
        "/api/employee-files/employee-file/activity",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_employee_file_activity(self, employee_id=None, id=None, **kwargs):
        EmployeeFile = request.env["doc.employee.file"]
        employee_file = EmployeeFile.browse(int(id or 0)).exists()
        if not employee_file and employee_id:
            employee_file = EmployeeFile.search(
                [
                    ("employee_id", "=", int(employee_id)),
                    ("company_id", "=", request.env.company.id),
                ],
                limit=1,
            )
        if not employee_file:
            return {"success": False, "message": "Employee File not found."}
        activity = self._service().list_employee_file_activity(employee_file)
        return {"success": True, "data": activity}

    @http.route(
        "/api/employee-files/favorite",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def toggle_favorite(self, id=None, **kwargs):
        employee_file = request.env["doc.employee.file"].browse(int(id or 0)).exists()
        if not employee_file:
            return {"success": False, "message": "Employee File not found."}
        user = request.env.user
        if user in employee_file.favorite_user_ids:
            employee_file.write({"favorite_user_ids": [(3, user.id)]})
            favorite = False
        else:
            employee_file.write({"favorite_user_ids": [(4, user.id)]})
            favorite = True
        return {"success": True, "favorite": favorite}

    @http.route(
        "/api/employee-files/issues",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_issues(self, category="all", limit=10, offset=0, search=None, **kwargs):
        rows, total = self._service().list_issues(
            category, limit, offset, search=search
        )
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        return {
            "success": True,
            "data": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
            "summary": self._service().issue_summary(),
        }

    @http.route(
        "/api/employee-files/issues/action",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def issue_action(self, id=None, action=None, **kwargs):
        self._require_manager()
        try:
            data = self._service().resolve_issue(id, action)
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        return {"success": True, "data": data}

    @http.route(
        "/api/employee-files/exclusions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_exclusions(self, reason=None, **kwargs):
        self._require_admin_or_manager()
        return {
            "success": True,
            "data": self._service().exclusion_report(reason),
        }

    @http.route(
        "/api/employee-files/exclusions/add",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def add_exclusion(self, employee_ids=None, justification=None, **kwargs):
        self._require_admin()
        ids = [int(value) for value in (employee_ids or [])]
        Exclusion = request.env["doc.employee.exclusion"].sudo()
        created = []
        for employee_id in ids:
            existing = Exclusion.search(
                [
                    ("company_id", "=", request.env.company.id),
                    ("employee_id", "=", employee_id),
                    ("reason", "=", "manual"),
                    ("active", "=", True),
                ],
                limit=1,
            )
            if existing:
                created.append(existing.id)
                continue
            inactive = Exclusion.search(
                [
                    ("company_id", "=", request.env.company.id),
                    ("employee_id", "=", employee_id),
                    ("reason", "=", "manual"),
                    ("active", "=", False),
                ],
                limit=1,
            )
            if inactive:
                inactive.write(
                    {
                        "active": True,
                        "justification": justification or inactive.justification,
                        "configured_by_id": request.env.user.id,
                    }
                )
                created.append(inactive.id)
                continue
            created.append(
                Exclusion.create(
                    {
                        "employee_id": employee_id,
                        "reason": "manual",
                        "justification": justification or "",
                        "configured_by_id": request.env.user.id,
                        "company_id": request.env.company.id,
                    }
                ).id
            )
        service = self._service()
        for employee_id in ids:
            employee = request.env["hr.employee"].sudo().browse(employee_id).exists()
            if employee:
                service.reconcile_employee_from_ems(employee)
        return {"success": True, "ids": created}

    @http.route(
        "/api/employee-files/ems-employees",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_ems_employees(self, search=None, limit=200, **kwargs):
        self._require_admin()
        return {
            "success": True,
            "data": self._service().list_ems_employees(search, limit),
        }

    @http.route(
        "/api/employee-files/exclusions/remove",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def remove_exclusion(self, id=None, **kwargs):
        self._require_admin()
        exclusion = request.env["doc.employee.exclusion"].browse(int(id or 0)).exists()
        employee = exclusion.employee_id if exclusion else False
        if exclusion:
            exclusion.write({"active": False})
        if employee:
            self._service().reconcile_employee_from_ems(employee)
        return {"success": True}

    @http.route(
        "/api/employee-files/search",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def global_search(self, query=None, scope="all", limit=50, **kwargs):
        return {
            "success": True,
            "data": self._service().global_search(query, scope, limit),
        }

    @http.route(
        "/api/employee-files/custom-groups/overlap",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def custom_group_overlap(self, group_ids=None, **kwargs):
        ids = [int(value) for value in (group_ids or [])]
        return {
            "success": True,
            "data": self._service().custom_group_overlap(ids),
        }

    @http.route(
        "/api/employee-files/document/reclassify",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def reclassify_document(self, document_id=None, document_type_id=None, **kwargs):
        self._require_manager()
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.write(
            {
                "document_type_id": int(document_type_id),
                "classification_state": "classified",
            }
        )
        return {"success": True}

    @http.route(
        "/api/employee-files/document/relations",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def document_relations(self, document_id=None, **kwargs):
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        relations = request.env["doc.document.relation"].search(
            [
                ("source_document_id", "=", document.id),
            ]
        )
        return {
            "success": True,
            "data": [relation.serialize_for_api() for relation in relations],
        }

    @http.route(
        "/api/employee-files/document/relation/add",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def add_document_relation(
        self, source_document_id=None, target_document_id=None, relation_type=None, **kwargs
    ):
        self._require_manager()
        relation = request.env["doc.document.relation"].create(
            {
                "source_document_id": int(source_document_id),
                "target_document_id": int(target_document_id),
                "relation_type": relation_type or "related",
            }
        )
        return {"success": True, "data": relation.serialize_for_api()}

    @http.route(
        "/api/employee-files/signature/request",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def request_signature(
        self, document_id=None, signer_employee_id=None, **kwargs
    ):
        self._require_manager()
        if not signer_employee_id:
            return {"success": False, "message": "Signer is required."}
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        request_record = request.env["doc.document.signature.request"].create(
            {
                "document_id": document.id,
                "employee_file_id": document.employee_file_id.id,
                "signer_employee_id": int(signer_employee_id),
            }
        )
        request_record.action_request_via_provider()
        return {"success": True, "data": request_record.serialize_for_api()}

    @http.route(
        "/api/employee-files/issues/export",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def export_issues(self, **kwargs):
        self._require_manager()
        rows = self._service().export_reconciliation_report()
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "Source",
                "Record ID",
                "Classification",
                "Issue type",
                "Title",
                "Employee ID",
                "Employee name",
                "Details",
                "Date identified",
                "Recoverable",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.get("source", "issue"),
                    row.get("id"),
                    row.get("classification_label") or row.get("classification"),
                    row.get("issue_type"),
                    row.get("name"),
                    row.get("employee_id") or "",
                    row.get("employee_name"),
                    row.get("details"),
                    row.get("date_identified"),
                    "yes" if row.get("recoverable") else "no",
                ]
            )
        return request.make_response(
            buffer.getvalue(),
            headers=[
                ("Content-Type", "text/csv"),
                (
                    "Content-Disposition",
                    content_disposition("employee-files-issues-report.csv"),
                ),
            ],
        )

    @http.route(
        "/api/employee-files/exclusions/export",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def export_exclusions(self, **kwargs):
        self._require_manager()
        rows = self._service().exclusion_report()
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "Employee ID",
                "Name",
                "Department",
                "Reason",
                "Date identified",
                "Status",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["employee_id"],
                    row["employee_name"],
                    row["department_name"],
                    row["reason"],
                    row["date_identified"],
                    row["status"],
                ]
            )
        return request.make_response(
            buffer.getvalue(),
            headers=[
                ("Content-Type", "text/csv"),
                ("Content-Disposition", content_disposition("employee-exclusions.csv")),
            ],
        )

    @http.route(
        "/api/employee-files/dimensions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def available_dimensions(self, **kwargs):
        options = []
        Employee = request.env["hr.employee"].sudo()
        company_domain = [("company_id", "=", request.env.company.id)]
        checks = [
            ("department", "Department", "department_id"),
            ("branch", "Branch", "branch_id"),
            ("grade", "Grade / Level", "grade_id"),
            (
                "employment_type",
                "Employment Type",
                ("employment_type_id", "employee_type_id"),
            ),
            ("work_location", "Location", "work_location_id"),
            ("status", "Status", None),
        ]
        for key, label, field_name in checks:
            populated = True
            if field_name:
                field_names = (
                    field_name if isinstance(field_name, (list, tuple)) else (field_name,)
                )
                populated = False
                for fname in field_names:
                    if fname not in Employee._fields:
                        continue
                    if Employee.search_count(
                        company_domain + [(fname, "!=", False)]
                    ):
                        populated = True
                        break
            options.append(
                {
                    "key": key,
                    "label": label,
                    "populated": populated,
                }
            )
        return {"success": True, "data": options}
