# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class DocEmployeeGroup(models.Model):
    _name = "doc.employee.group"
    _description = "Employee Files group (system-managed or custom)"
    _order = "name"

    name = fields.Char(required=True)
    description = fields.Text()
    icon = fields.Char()
    group_kind = fields.Selection(
        [
            ("system_managed", "System-Managed"),
            ("custom", "Custom"),
        ],
        required=True,
        default="custom",
        index=True,
    )
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    organizing_dimension = fields.Selection(
        [
            ("department", "Department"),
            ("branch", "Branch"),
            ("grade", "Grade / Level"),
            ("employment_type", "Employment Type"),
            ("work_location", "Location"),
            ("status", "Status"),
        ],
    )
    dimension_value_key = fields.Char(
        help="Stable key for EMS attribute value (e.g. department id).",
        index=True,
    )
    parent_group_id = fields.Many2one(
        "doc.employee.group",
        string="Parent group",
        ondelete="cascade",
    )
    child_ids = fields.One2many("doc.employee.group", "parent_group_id")
    member_ids = fields.Many2many(
        "doc.employee.file",
        "doc_employee_group_member_rel",
        "group_id",
        "employee_file_id",
        string="Member employee files",
    )
    employee_count = fields.Integer(compute="_compute_stats", store=True)
    document_count = fields.Integer(compute="_compute_stats", store=True)
    attention_count = fields.Integer(compute="_compute_stats", store=True)
    active = fields.Boolean(default=True)
    show_on_home = fields.Boolean(
        string="Show on Employee Files home",
        default=False,
        help="For custom groups only: when enabled, the group appears in the Employee Files folder list.",
    )

    @api.constrains(
        "company_id",
        "organizing_dimension",
        "dimension_value_key",
        "parent_group_id",
        "group_kind",
    )
    def _check_system_managed_unique(self):
        for group in self:
            if group.group_kind != "system_managed":
                continue
            if not group.dimension_value_key:
                raise ValidationError(
                    _("System-managed groups require a dimension value key.")
                )
            parent_id = group.parent_group_id.id if group.parent_group_id else False
            duplicate = self.search_count(
                [
                    ("id", "!=", group.id),
                    ("company_id", "=", group.company_id.id),
                    ("group_kind", "=", "system_managed"),
                    ("organizing_dimension", "=", group.organizing_dimension),
                    ("dimension_value_key", "=", group.dimension_value_key),
                    ("parent_group_id", "=", parent_id),
                ]
            )
            if duplicate:
                raise ValidationError(
                    _("A system-managed group already exists for this dimension value.")
                )

    @api.depends(
        "member_ids",
        "member_ids.document_count",
        "member_ids.attention_count",
        "child_ids",
        "child_ids.member_ids",
        "child_ids.member_ids.document_count",
        "child_ids.member_ids.attention_count",
    )
    def _compute_stats(self):
        for group in self:
            members = group.member_ids
            if group.child_ids:
                members = group.child_ids.mapped("member_ids")
            group.employee_count = len(members)
            group.document_count = sum(members.mapped("document_count"))
            group.attention_count = sum(members.mapped("attention_count"))

    def serialize_for_api(self, include_member_ids=True):
        self.ensure_one()
        payload = {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "icon": self.icon or "",
            "group_kind": self.group_kind,
            "organizing_dimension": self.organizing_dimension or "",
            "dimension_value_key": self.dimension_value_key or "",
            "parent_group_id": self.parent_group_id.id if self.parent_group_id else False,
            "parent_group_name": self.parent_group_id.name
            if self.parent_group_id
            else "",
            "employee_count": self.employee_count,
            "document_count": self.document_count,
            "attention_count": self.attention_count,
            "read_only_membership": self.group_kind == "system_managed",
            "show_on_home": bool(self.show_on_home)
            if self.group_kind == "custom"
            else False,
        }
        if include_member_ids:
            payload["member_employee_ids"] = self.member_ids.mapped("employee_id").ids
        else:
            payload["member_employee_ids"] = []
        return payload
