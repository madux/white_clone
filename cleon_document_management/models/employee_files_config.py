# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocEmployeeFilesConfig(models.Model):
    _name = "doc.employee.files.config"
    _description = "Employee Files tenant configuration (EF-F)"
    _rec_name = "company_id"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        ondelete="cascade",
        index=True,
    )

    setup_complete = fields.Boolean(default=False)

    primary_organizing_dimension = fields.Selection(
        [
            ("department", "Department"),
            ("branch", "Branch"),
            ("grade", "Grade / Level"),
            ("employment_type", "Employment Type"),
            ("work_location", "Location"),
            ("status", "Status"),
        ],
        string="Primary organizing dimension",
    )

    organizing_dimension_ids = fields.Char(
        string="Organizing dimensions (JSON list)",
        default="[]",
        help="Serialized list of dimension keys for multi-dimension views (EF-A8).",
    )

    sub_organizing_dimension = fields.Selection(
        [
            ("none", "None"),
            ("department", "Department"),
            ("branch", "Branch"),
            ("grade", "Grade / Level"),
            ("employment_type", "Employment Type"),
            ("work_location", "Location"),
            ("status", "Status"),
        ],
        default="none",
    )

    include_all_existing = fields.Boolean(
        string="Create files for all existing employees",
        default=True,
    )
    include_inactive = fields.Boolean(default=False)
    exclude_test_employees = fields.Boolean(default=True)
    collect_existing_documents = fields.Boolean(default=True)

    group_name_display = fields.Selection(
        [("name", "Full name"), ("code", "Code")],
        default="name",
    )
    show_inactive_groups = fields.Boolean(default=True)
    show_group_counts_on_cards = fields.Boolean(default=True)

    duplicate_detection_mode = fields.Selection(
        [
            ("warn", "Warn user"),
            ("prevent", "Prevent duplicate"),
            ("allow_confirm", "Allow with confirmation"),
        ],
        default="warn",
    )
    max_file_size_mb = fields.Integer(default=25)
    allowed_file_types = fields.Char(
        default="pdf,doc,docx,xls,xlsx,png,jpg,jpeg",
    )

    header_field_keys = fields.Char(
        default='["employee_id","name","department_id","job_id"]',
        help="JSON list of hr.employee field names for EF-F1 header.",
    )

    max_issue_retry_attempts = fields.Integer(default=3)
    error_escalation_user_id = fields.Many2one("res.users")

    enable_custom_groups = fields.Boolean(default=True)
    enable_esign = fields.Boolean(default=False)
    esign_provider = fields.Char()

    notification_routing_json = fields.Text(default="{}")
    integration_mapping_json = fields.Text(default="{}")
    category_action_matrix_json = fields.Text(default="{}")

    _sql_constraints = [
        (
            "company_uniq",
            "unique(company_id)",
            "Only one Employee Files configuration per company.",
        ),
    ]

    @api.model
    def get_for_company(self, company=None):
        company = company or self.env.company
        config = self.search([("company_id", "=", company.id)], limit=1)
        if not config:
            config = self.create({"company_id": company.id})
        return config

    def get_organizing_dimensions(self):
        self.ensure_one()
        import json

        try:
            dims = json.loads(self.organizing_dimension_ids or "[]")
        except (TypeError, ValueError):
            dims = []
        if not dims and self.primary_organizing_dimension:
            dims = [self.primary_organizing_dimension]
        return dims

    def set_organizing_dimensions(self, dimensions):
        self.ensure_one()
        import json

        dims = [d for d in (dimensions or []) if d]
        self.write(
            {
                "organizing_dimension_ids": json.dumps(dims),
                "primary_organizing_dimension": dims[0] if dims else False,
            }
        )

    def get_header_fields(self):
        self.ensure_one()
        import json

        raw = self.header_field_keys
        if not raw:
            return ["employee_id", "name", "department_id", "job_id"]
        try:
            keys = json.loads(raw)
        except (TypeError, ValueError):
            return ["employee_id", "name", "department_id", "job_id"]
        if not isinstance(keys, list):
            return ["employee_id", "name", "department_id", "job_id"]
        return [key for key in keys if isinstance(key, str) and key.strip()]

    def set_header_field_keys(self, keys):
        self.ensure_one()
        import json

        if isinstance(keys, str):
            try:
                keys = json.loads(keys)
            except (TypeError, ValueError):
                keys = []
        if not isinstance(keys, (list, tuple)):
            keys = []
        cleaned = [key for key in keys if isinstance(key, str) and key.strip()]
        self.write({"header_field_keys": json.dumps(cleaned)})

    def serialize_for_api(self):
        self.ensure_one()
        service = self.env["doc.employee.files.service"]
        return {
            "setup_complete": self.setup_complete,
            "primary_organizing_dimension": self.primary_organizing_dimension or "",
            "organizing_dimensions": self.get_organizing_dimensions(),
            "sub_organizing_dimension": self.sub_organizing_dimension or "none",
            "include_all_existing": self.include_all_existing,
            "include_inactive": self.include_inactive,
            "exclude_test_employees": self.exclude_test_employees,
            "collect_existing_documents": self.collect_existing_documents,
            "group_name_display": self.group_name_display,
            "show_inactive_groups": self.show_inactive_groups,
            "show_group_counts_on_cards": self.show_group_counts_on_cards,
            "duplicate_detection_mode": self.duplicate_detection_mode,
            "max_file_size_mb": self.max_file_size_mb,
            "allowed_file_types": self.allowed_file_types or "",
            "header_field_keys": self.get_header_fields(),
            "available_header_fields": service.get_header_field_catalog(),
            "max_issue_retry_attempts": self.max_issue_retry_attempts,
            "enable_custom_groups": self.enable_custom_groups,
            "enable_esign": self.enable_esign,
            "esign_provider": self.esign_provider or "",
            "notification_routing_json": self.notification_routing_json or "{}",
            "integration_mapping_json": self.integration_mapping_json or "{}",
            "category_action_matrix_json": self.category_action_matrix_json or "{}",
        }
