from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class DocumentFolder(models.Model):
    _name = "doc.folder"
    _description = "Document Folder"
    _rec_name = "folder_name"
    _order = "folder_name"

    folder_name = fields.Char(
        string="Folder Name",
        required=True,
    )

    description = fields.Text(
        string="Description",
    )

    active = fields.Boolean(
        default=True,
    )

    folder_type = fields.Selection(
        [
            ("employee", "Employee Files"),
            ("organizational", "Organizational Files"),
        ],
        string="Folder Type",
        required=True,
        default="organizational",
    )

    owner_id = fields.Many2one(
        "res.users",
        string="Owner",
        required=True,
        default=lambda self: self.env.user,
        readonly=True,
    )

    parent_id = fields.Many2one(
        "doc.folder",
        string="Parent Folder",
        ondelete="restrict",
    )

    child_ids = fields.One2many(
        "doc.folder",
        "parent_id",
        string="Child Folders",
    )

    department_ids = fields.Many2many(
        "hr.department",
        "doc_folder_department_rel",
        "folder_id",
        "department_id",
        string="Departments",
    )

    company_id = fields.Many2one(
        "res.company",
        string="Company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    branch_ids = fields.Many2many(
        "multi.branch",
        "doc_folder_branch_rel",
        "folder_id",
        "branch_id",
        string="Business Units",
    )

    grade_ids = fields.Many2many(
        "hr.grade",
        "doc_folder_grade_rel",
        "folder_id",
        "grade_id",
        string="Grade Levels",
    )

    employment_type_ids = fields.Many2many(
        "hr.core_employment_type",
        "doc_folder_employment_type_rel",
        "folder_id",
        "employment_type_id",
        string="Employment Types",
    )

    role_group_ids = fields.Many2many(
        "res.groups",
        "doc_folder_role_group_rel",
        "folder_id",
        "group_id",
        string="Roles",
    )

    # location_ids = fields.Many2many(
    #     "hr.work.location",
    #     "doc_folder_location_rel",
    #     "folder_id",
    #     "location_id",
    #     string="Locations",
    # )

    employee_ids = fields.Many2many(
        "hr.employee",
        "doc_folder_employee_rel",
        "folder_id",
        "employee_id",
        string="Employees",
    )

    access_scope = fields.Selection(
        [
            ("all_staff", "All Staff"),
            ("department", "By Department"),
            ("business_unit", "By Business Unit"),
            ("grade", "By Grade Level"),
            ("role", "By Role"),
            ("employment_type", "By Employment Type"),
            ("location", "By Location"),
            ("individual", "Individual Employees"),
            ("admin_only", "Admin Only"),
        ],
        string="Access Permission",
        required=True,
        default="all_staff",
    )

    allowed_user_ids = fields.Many2many(
        "res.users",
        "doc_folder_allowed_user_rel",
        "folder_id",
        "user_id",
        string="Allowed Users",
    )

    allowed_document_type_ids = fields.Many2many(
        "doc.document.type",
        "doc_folder_document_type_rel",
        "folder_id",
        "document_type_id",
        string="Allowed Document Categories",
    )

    retention_period = fields.Selection(
        [
            ("1", "1 Year"),
            ("3", "3 Years"),
            ("5", "5 Years"),
            ("7", "7 Years"),
            ("10", "10 Years"),
            ("permanent", "Permanent"),
        ],
        string="Retention Period",
        required=True,
        default="7",
    )

    require_upload_approval = fields.Boolean(
        string="Require Upload Approval",
        default=False,
    )

    approval_flow = fields.Selection(
        [
            ("sequential", "Sequential"),
            ("random", "Random Order"),
            ("any", "Any Approver"),
        ],
        string="Approval Flow",
        default="any",
    )

    approver_ids = fields.Many2many(
        "res.users",
        "doc_folder_approver_rel",
        "folder_id",
        "user_id",
        string="Approvers",
    )

    color = fields.Integer(
        string="Color",
        default=0,
        help="Odoo color index from 0 to 11.",
    )

    color_hex = fields.Char(
        string="Custom Color",
    )

    favorite_user_ids = fields.Many2many(
        "res.users",
        "doc_folder_favorite_user_rel",
        "folder_id",
        "user_id",
        string="Favorite By",
    )

    pinned_user_ids = fields.Many2many(
        "res.users",
        "doc_folder_pinned_user_rel",
        "folder_id",
        "user_id",
        string="Pinned By",
    )

    is_locked = fields.Boolean(
        string="Locked",
        default=False,
    )

    locked_by = fields.Many2one(
        "res.users",
        string="Locked By",
        readonly=True,
    )

    document_ids = fields.One2many(
        "doc.document",
        "folder_id",
        string="Documents",
    )

    document_count = fields.Integer(
        compute="_compute_document_count",
        store=True,
    )

    @api.depends("document_ids")
    def _compute_document_count(self):
        for folder in self:
            folder.document_count = len(folder.document_ids)

    @api.constrains("require_upload_approval", "approver_ids")
    def _check_approval_configuration(self):
        for folder in self:
            if folder.require_upload_approval and not folder.approver_ids:
                raise ValidationError(
                    _("Select at least one approver when upload approval is enabled.")
                )
            if not folder.require_upload_approval and folder.approver_ids:
                raise ValidationError(
                    _("Approvers require upload approval to be enabled.")
                )

    @api.constrains("folder_type", "employee_ids")
    def _check_organization_employees(self):
        for folder in self:
            if folder.folder_type == "organizational" and folder.employee_ids:
                raise ValidationError(
                    _("Organizational folders cannot contain employee assignments.")
                )

    def action_toggle_favorite(self):
        for folder in self:
            command = (
                fields.Command.unlink(self.env.user.id)
                if self.env.user in folder.favorite_user_ids
                else fields.Command.link(self.env.user.id)
            )
            folder.write({"favorite_user_ids": [command]})

    def action_toggle_pin(self):
        for folder in self:
            command = (
                fields.Command.unlink(self.env.user.id)
                if self.env.user in folder.pinned_user_ids
                else fields.Command.link(self.env.user.id)
            )
            folder.write({"pinned_user_ids": [command]})

    def action_duplicate(self):
        self.ensure_one()

        return self.copy(
            default={
                "folder_name": _("%s (Copy)") % self.folder_name,
                "favorite_user_ids": [fields.Command.clear()],
                "pinned_user_ids": [fields.Command.clear()],
            }
        )

    def action_lock(self):
        self.write(
            {
                "is_locked": True,
                "locked_by": self.env.user.id,
            }
        )

    def action_unlock(self):
        self.write(
            {
                "is_locked": False,
                "locked_by": False,
            }
        )

    def action_archive(self):
        self.write({"active": False})

    def action_restore(self):
        self.write({"active": True})

    @api.model
    def get_or_create_department_folder(self, department):
        if not department:
            return self.browse()

        folder = self.search(
            [
                ("folder_type", "=", "employee"),
                ("department_id", "=", department.id),
            ],
            limit=1,
        )
        if not folder:
            folder = self.create(
                {
                    "folder_name": department.name,
                    "description": _("Employee files for %s") % department.name,
                    "folder_type": "employee",
                    "department_id": department.id,
                    "department_ids": [fields.Command.link(department.id)],
                }
            )
        return folder

    @api.model
    def link_employee_to_department_folder(self, employee):
        if not employee or not employee.department_id:
            return self.browse()

        folder = self.get_or_create_department_folder(employee.department_id)
        if employee not in folder.employee_ids:
            folder.write({"employee_ids": [fields.Command.link(employee.id)]})
        return folder
