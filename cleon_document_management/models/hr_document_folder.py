from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


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

    is_pending_uploads = fields.Boolean(
        string="Pending Uploads Folder",
        default=False,
        help="System folder that holds employee documents awaiting review or folder assignment.",
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
            ("random", "All Reviewers"),
            ("any", "Single Approver"),
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

    approver_order = fields.Char(
        string="Approver Order",
        help="Comma-separated user IDs preserving the configured approval sequence.",
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

    distribution_status = fields.Selection(
        [("active", "Active"), ("archived", "Archived"), ("deactivated", "Deactivated")],
        default="active",
        required=True,
        index=True,
    )

    deleted_at = fields.Datetime(string="Moved to Recycle Bin", readonly=True, index=True)
    deleted_by = fields.Many2one("res.users", string="Deleted By", readonly=True)
    recycle_bin_until = fields.Datetime(
        string="Recycle Bin Retention Until", readonly=True, index=True
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
    )

    def _compute_document_count(self):
        for folder in self:
            folder.document_count = self.env["doc.document"].search_count([
                ("folder_id", "=", folder.id),
                ("active", "=", True),
            ])

    @api.constrains("require_upload_approval", "approver_ids", "approval_flow")
    def _check_approval_configuration(self):
        for folder in self:
            if folder.is_pending_uploads:
                continue
            if folder.require_upload_approval and not folder.approver_ids:
                raise ValidationError(
                    _("Select at least one approver when upload approval is enabled.")
                )
            if not folder.require_upload_approval and folder.approver_ids:
                raise ValidationError(
                    _("Approvers require upload approval to be enabled.")
                )
            if (
                folder.require_upload_approval
                and folder.approval_flow == "sequential"
                and not folder.approver_ids
            ):
                raise ValidationError(
                    _("Sequential approval requires at least one approver.")
                )

    @api.model
    def get_settings_approval_defaults(self):
        params = self.env["ir.config_parameter"].sudo()
        raw_approvers = params.get_param(
            "cleon_document_management.default_approver_ids", ""
        )
        return {
            "require_upload_approval": params.get_param(
                "cleon_document_management.default_require_upload_approval", "0"
            )
            == "1",
            "approval_flow": params.get_param(
                "cleon_document_management.default_approval_flow", "any"
            ),
            "approver_ids": [
                int(value) for value in raw_approvers.split(",") if value.isdigit()
            ],
        }

    @api.model
    def _prepare_approval_values(
        self,
        require_upload_approval=None,
        approval_flow=None,
        approver_ids=None,
        settings=None,
    ):
        settings = settings or self.get_settings_approval_defaults()
        require = (
            bool(require_upload_approval)
            if require_upload_approval is not None
            else settings["require_upload_approval"]
        )
        flow = approval_flow or settings["approval_flow"] or "any"
        if flow not in {"sequential", "random", "any"}:
            flow = "any"

        if approver_ids is not None:
            user_ids = [
                int(value)
                for value in approver_ids
                if str(value).isdigit() or isinstance(value, int)
            ]
        elif require:
            user_ids = list(settings["approver_ids"])
        else:
            user_ids = []

        users = self.env["res.users"].browse(user_ids).exists()
        if require and not users:
            raise ValidationError(
                _("Select at least one approver when upload approval is enabled.")
            )
        if require and flow == "sequential" and not users:
            raise ValidationError(
                _("Sequential approval requires at least one approver.")
            )

        if not require:
            return {
                "require_upload_approval": False,
                "approval_flow": flow,
                "approver_ids": [fields.Command.clear()],
                "approver_order": False,
            }

        ordered_users = users
        if user_ids:
            order_map = {user_id: index for index, user_id in enumerate(user_ids)}
            ordered_users = users.sorted(key=lambda user: order_map.get(user.id, 999))

        return {
            "require_upload_approval": True,
            "approval_flow": flow,
            "approver_ids": [fields.Command.set(ordered_users.ids)],
            "approver_order": ",".join(str(user.id) for user in ordered_users),
        }

    def _get_ordered_approvers(self):
        self.ensure_one()
        approvers = self.approver_ids
        if not self.approver_order:
            return approvers
        order = [
            int(value)
            for value in self.approver_order.split(",")
            if value.isdigit()
        ]
        if not order:
            return approvers
        order_map = {user_id: index for index, user_id in enumerate(order)}
        return approvers.sorted(key=lambda user: order_map.get(user.id, 999))

    @api.model
    def find_department_approval_folder(self, department):
        if not department:
            return self.browse()
        return self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("department_ids", "in", department.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("is_pending_uploads", "=", False),
            ],
            order="write_date desc, id desc",
            limit=1,
        )

    @api.model
    def get_department_approval_config(self, department):
        folder = self.find_department_approval_folder(department)
        if folder:
            return {
                "require_upload_approval": folder.require_upload_approval,
                "approval_flow": folder.approval_flow,
                "approvers": folder._get_ordered_approvers(),
                "approver_order": folder.approver_order or "",
                "source": "folder",
                "source_name": folder.folder_name,
            }

        settings = self.get_settings_approval_defaults()
        users = self.env["res.users"].browse(settings["approver_ids"]).exists()
        require = settings["require_upload_approval"] and bool(users)
        return {
            "require_upload_approval": require,
            "approval_flow": settings["approval_flow"] if require else "any",
            "approvers": users if require else self.env["res.users"],
            "approver_order": ",".join(str(user.id) for user in users) if require else "",
            "source": "settings",
            "source_name": _("Settings defaults"),
        }

    @api.constrains("folder_type", "access_scope", "employee_ids")
    def _check_organization_employees(self):
        for folder in self:
            if (
                folder.folder_type == "organizational"
                and folder.employee_ids
                and folder.access_scope != "individual"
            ):
                raise ValidationError(
                    _("Select Individual Employees when assigning an organizational folder to employees.")
                )
            if (
                folder.folder_type == "organizational"
                and folder.access_scope == "individual"
                and not folder.employee_ids
            ):
                raise ValidationError(
                    _("Select at least one employee for an individual-scoped folder.")
                )

    @api.constrains("folder_type", "access_scope", "department_ids", "grade_ids")
    def _check_access_scope_targets(self):
        for folder in self:
            if folder.folder_type != "organizational":
                continue
            if folder.access_scope == "department" and not folder.department_ids:
                raise ValidationError(
                    _("Select at least one department for a department-scoped folder.")
                )
            if folder.access_scope == "grade" and not folder.grade_ids:
                raise ValidationError(
                    _("Select at least one grade for a grade-scoped folder.")
                )

    def _is_document_manager(self):
        return self.env.user.has_group("cleon_document_management.group_document_manager")

    def _user_can_access(self, user=None):
        """Return whether a document user can access this folder.

        Record rules enforce reads, while this helper also protects controller and
        model create paths where no record exists yet for Odoo to evaluate.
        """
        self.ensure_one()
        user = user or self.env.user
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        if self.owner_id == user or user in self.allowed_user_ids:
            return True
        employee = user.employee_id
        if self.is_pending_uploads and self.folder_type == "employee":
            return bool(employee)
        if self.folder_type == "employee":
            return employee in self.employee_ids
        if self.access_scope == "admin_only":
            return False
        if self.access_scope == "all_staff":
            return True
        if not employee:
            return False
        if self.access_scope == "department":
            return employee.department_id in self.department_ids
        if self.access_scope == "grade":
            return employee.grade_id in self.grade_ids
        if self.access_scope == "employment_type":
            return employee.employee_type_id in self.employment_type_ids
        if self.access_scope == "role":
            return bool(self.role_group_ids & user.groups_id)
        if self.access_scope == "business_unit":
            return employee.branch_id in self.branch_ids
        if self.access_scope == "individual":
            return employee in self.employee_ids
        return False

    def _get_scope_employees(self):
        """Return employees who fall within this folder's organizational access scope."""
        self.ensure_one()
        Employee = self.env["hr.employee"]
        if self.folder_type != "organizational":
            return Employee
        domain = [("active", "=", True)]
        if self.access_scope == "admin_only":
            return Employee
        if self.access_scope == "all_staff":
            return Employee.search(domain)
        if self.access_scope == "department" and self.department_ids:
            return Employee.search(
                domain + [("department_id", "in", self.department_ids.ids)]
            )
        if self.access_scope == "grade" and self.grade_ids:
            return Employee.search(domain + [("grade_id", "in", self.grade_ids.ids)])
        if self.access_scope == "individual":
            return self.employee_ids.filtered("active")
        if self.access_scope == "employment_type" and self.employment_type_ids:
            return Employee.search(
                domain
                + [("employee_type_id", "in", self.employment_type_ids.ids)]
            )
        if self.access_scope == "business_unit" and self.branch_ids:
            return Employee.search(domain + [("branch_id", "in", self.branch_ids.ids)])
        if self.access_scope == "role" and self.role_group_ids:
            users = self.role_group_ids.mapped("users").filtered("active")
            return users.mapped("employee_id").filtered(lambda employee: employee.active)
        return Employee

    def _get_acknowledgement_audience_users(self):
        """Users in folder scope who can acknowledge organizational documents."""
        self.ensure_one()
        if self.folder_type != "organizational" or self.access_scope == "admin_only":
            return self.env["res.users"]
        employees = self._get_scope_employees()
        return employees.mapped("user_id").filtered(lambda user: user and user.active)

    @api.model
    def _prepare_organizational_scope_values(
        self,
        access_scope,
        department_ids=None,
        grade_ids=None,
        employee_ids=None,
    ):
        scope = access_scope or "all_staff"
        if scope not in {
            "all_staff",
            "department",
            "business_unit",
            "grade",
            "role",
            "employment_type",
            "location",
            "individual",
            "admin_only",
        }:
            scope = "all_staff"

        departments = self.env["hr.department"].browse(
            [int(value) for value in (department_ids or []) if str(value).isdigit()]
        ).exists()
        grades = self.env["hr.grade"].browse(
            [int(value) for value in (grade_ids or []) if str(value).isdigit()]
        ).exists()
        employees = self.env["hr.employee"].browse(
            [int(value) for value in (employee_ids or []) if str(value).isdigit()]
        ).exists()

        if scope == "department" and not departments:
            raise ValidationError(_("Select at least one department."))
        if scope == "grade" and not grades:
            raise ValidationError(_("Select at least one grade."))
        if scope == "individual" and not employees:
            raise ValidationError(_("Select at least one employee."))

        values = {"access_scope": scope}
        if scope == "department":
            values["department_ids"] = [fields.Command.set(departments.ids)]
            values["grade_ids"] = [fields.Command.clear()]
            values["employee_ids"] = [fields.Command.clear()]
        elif scope == "grade":
            values["grade_ids"] = [fields.Command.set(grades.ids)]
            values["department_ids"] = [fields.Command.clear()]
            values["employee_ids"] = [fields.Command.clear()]
        elif scope == "individual":
            values["employee_ids"] = [fields.Command.set(employees.ids)]
            values["department_ids"] = [fields.Command.clear()]
            values["grade_ids"] = [fields.Command.clear()]
        else:
            values["department_ids"] = [fields.Command.clear()]
            values["grade_ids"] = [fields.Command.clear()]
            values["employee_ids"] = [fields.Command.clear()]
        return values

    @api.model
    def _clear_approval_values(self):
        return {
            "require_upload_approval": False,
            "approval_flow": "any",
            "approver_ids": [fields.Command.clear()],
            "approver_order": False,
        }

    @api.model
    def _sanitize_organizational_vals(self, vals, folder_type=None):
        folder_type = folder_type or vals.get("folder_type")
        if folder_type != "organizational":
            return vals
        vals.update(self._clear_approval_values())
        return vals

    @api.model_create_multi
    def create(self, vals_list):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can create folders."))
        for vals in vals_list:
            self._sanitize_organizational_vals(vals)
        return super().create(vals_list)

    def write(self, vals):
        if not self._is_document_manager():
            allowed = {"favorite_user_ids", "pinned_user_ids"}
            if set(vals) - allowed:
                raise AccessError(_("You can only update your folder favorites and pins."))
        if self.filtered(lambda folder: folder.folder_type == "organizational") == self:
            vals = dict(vals)
            vals.update(self._clear_approval_values())
        return super().write(vals)

    def unlink(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        return super().unlink()

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
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can archive folders."))
        self.write({
            "active": False,
            "distribution_status": "archived",
            "deleted_at": False,
            "deleted_by": False,
            "recycle_bin_until": False,
        })

    def action_restore(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can restore folders."))
        for folder in self:
            folder._restore_rehomed_employee_documents()
        self.write({
            "active": True,
            "distribution_status": "active",
            "deleted_at": False,
            "deleted_by": False,
            "recycle_bin_until": False,
        })

    def _rehome_employee_documents_before_recycle(self):
        self.ensure_one()
        if self.folder_type != "employee" or self.is_pending_uploads:
            return
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        documents = self.env["doc.document"].sudo().search(
            [
                ("folder_id", "=", self.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("employee_id", "!=", False),
            ]
        )
        if documents:
            documents.write(
                {
                    "folder_id": pending_folder.id,
                    "recycle_origin_folder_id": self.id,
                }
            )

    def _restore_rehomed_employee_documents(self):
        self.ensure_one()
        if self.folder_type != "employee" or self.is_pending_uploads:
            return
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        documents = self.env["doc.document"].sudo().search(
            [
                ("recycle_origin_folder_id", "=", self.id),
                ("folder_id", "=", pending_folder.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        if documents:
            documents.write(
                {
                    "folder_id": self.id,
                    "recycle_origin_folder_id": False,
                }
            )

    def _employee_has_active_employee_folder(self, employee):
        if not employee:
            return False
        return bool(
            self.env["doc.folder"].sudo().search_count(
                [
                    ("folder_type", "=", "employee"),
                    ("employee_ids", "in", employee.id),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("is_pending_uploads", "=", False),
                ],
                limit=1,
            )
        )

    def _get_pending_orphans_for_recycled_folder(self):
        """Pending-upload docs whose employees belonged here and have no active folder."""
        self.ensure_one()
        Document = self.env["doc.document"].sudo()
        if (
            not self.deleted_at
            or self.folder_type != "employee"
            or self.is_pending_uploads
            or not self.employee_ids
        ):
            return Document.browse()
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        orphans = Document.search(
            [
                ("folder_id", "=", pending_folder.id),
                ("employee_id", "in", self.employee_ids.ids),
                ("recycle_origin_folder_id", "=", False),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        Folder = self.env["doc.folder"].sudo().with_context(active_test=False)

        def belongs_to_this_folder(employee):
            if employee not in self.employee_ids:
                return False
            if self._employee_has_active_employee_folder(employee):
                return False
            recycled = Folder.search(
                [
                    ("folder_type", "=", "employee"),
                    ("employee_ids", "in", employee.id),
                    ("deleted_at", "!=", False),
                    ("is_pending_uploads", "=", False),
                ],
                order="deleted_at desc, id desc",
                limit=1,
            )
            return recycled.id == self.id

        return orphans.filtered(lambda document: belongs_to_this_folder(document.employee_id))

    def _get_recycle_linked_documents(self):
        """Documents still in this folder or rehomed to pending uploads when it was recycled."""
        self.ensure_one()
        Document = self.env["doc.document"].sudo()
        in_folder = Document.search(
            [
                ("folder_id", "=", self.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        rehomed = Document.search(
            [
                ("recycle_origin_folder_id", "=", self.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        orphans = self._get_pending_orphans_for_recycled_folder()
        return in_folder | rehomed | orphans

    def action_move_recycle_linked_documents(self, destination_folder_id):
        self.ensure_one()
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can move documents."))
        destination = self.browse(int(destination_folder_id or 0)).exists()
        if not destination or not destination.active or destination.deleted_at:
            raise ValidationError(_("Destination folder not found or inactive."))
        if destination.is_pending_uploads:
            raise ValidationError(
                _(
                    "Choose an active employee folder instead. "
                    "Use keep in pending uploads if no folder is available yet."
                )
            )
        documents = self._get_recycle_linked_documents()
        if not documents:
            return 0
        if self.folder_type != destination.folder_type:
            raise ValidationError(
                _("Documents can only be moved to a folder of the same type.")
            )
        if self.folder_type == "employee":
            employee_documents = documents.filtered("employee_id")
            if len(employee_documents) != len(documents):
                raise ValidationError(
                    _("Only employee documents can be moved to another employee folder.")
                )
            for employee in employee_documents.mapped("employee_id"):
                if employee not in destination.employee_ids:
                    destination.sudo().write({"employee_ids": [(4, employee.id)]})
            employee_documents.write(
                {
                    "folder_id": destination.id,
                    "recycle_origin_folder_id": False,
                }
            )
            return len(employee_documents)
        documents.write({"folder_id": destination.id})
        return len(documents)

    def action_release_recycle_linked_documents(self):
        """Keep rehomed employee documents in pending uploads without restoring this folder."""
        self.ensure_one()
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can release documents."))
        if self.folder_type != "employee":
            raise ValidationError(
                _("Only employee folders support keeping documents in pending uploads.")
            )
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        documents = self._get_recycle_linked_documents()
        if not documents:
            return 0
        for document in documents:
            values = {"recycle_origin_folder_id": False}
            if document.folder_id != pending_folder:
                values["folder_id"] = pending_folder.id
            document.write(values)
        return len(documents)

    def action_move_to_recycle_bin(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        if any(folder.is_pending_uploads for folder in self):
            raise ValidationError(
                _("The pending uploads folder cannot be moved to the recycle bin.")
            )
        for folder in self:
            folder._rehome_employee_documents_before_recycle()
        now = fields.Datetime.now()
        try:
            retention_days = max(int(self.env["ir.config_parameter"].sudo().get_param(
                "cleon_document_management.recycle_bin_retention_days", "30"
            )), 1)
        except (TypeError, ValueError):
            retention_days = 30
        self.write({
            "active": False,
            "distribution_status": "deactivated",
            "deleted_at": now,
            "deleted_by": self.env.user.id,
            "recycle_bin_until": now + timedelta(days=retention_days),
        })

    def action_permanent_delete(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        for folder in self:
            if folder.is_pending_uploads:
                raise ValidationError(
                    _("The pending uploads folder cannot be permanently deleted.")
                )
            linked_documents = folder._get_recycle_linked_documents()
            if linked_documents:
                raise ValidationError(
                    _(
                        "This folder still has %(count)s linked document(s). "
                        "Move them to another folder or keep them in pending uploads "
                        "before permanently deleting it.",
                        count=len(linked_documents),
                    )
                )
            folder.document_ids.sudo().unlink()
            folder.sudo().unlink()

    def action_force_permanent_delete(self):
        """Permanently delete a recycled folder and every linked document."""
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        for folder in self:
            if folder.is_pending_uploads:
                raise ValidationError(
                    _("The pending uploads folder cannot be permanently deleted.")
                )
            linked_documents = folder._get_recycle_linked_documents()
            documents = (linked_documents | folder.document_ids.sudo()).exists()
            if documents:
                documents.sudo().unlink()
            folder.sudo().unlink()

    @api.model
    def backfill_recycle_origin_links(self):
        """Repair missing recycle_origin_folder_id on pending uploads after folder recycle."""
        Folder = self.sudo().with_context(active_test=False)
        recycled_folders = Folder.search(
            [
                ("folder_type", "=", "employee"),
                ("deleted_at", "!=", False),
                ("is_pending_uploads", "=", False),
            ],
            order="deleted_at desc, id desc",
        )
        if not recycled_folders:
            return 0
        pending_folder = self.get_pending_upload_folder()
        Document = self.env["doc.document"].sudo()
        linked_employees = set()
        repaired = 0
        for folder in recycled_folders:
            if not folder.employee_ids:
                continue
            documents = Document.search(
                [
                    ("folder_id", "=", pending_folder.id),
                    ("employee_id", "in", folder.employee_ids.ids),
                    ("recycle_origin_folder_id", "=", False),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                ]
            )
            for document in documents:
                employee = document.employee_id
                if not employee or employee.id in linked_employees:
                    continue
                if folder._employee_has_active_employee_folder(employee):
                    continue
                owner = Folder.search(
                    [
                        ("folder_type", "=", "employee"),
                        ("employee_ids", "in", employee.id),
                        ("deleted_at", "!=", False),
                        ("is_pending_uploads", "=", False),
                    ],
                    order="deleted_at desc, id desc",
                    limit=1,
                )
                if owner.id != folder.id:
                    continue
                document.write({"recycle_origin_folder_id": folder.id})
                linked_employees.add(employee.id)
                repaired += 1
        return repaired

    @api.model
    def _cron_empty_recycle_bin(self):
        expired = self.sudo().search([
            ("deleted_at", "!=", False),
            ("recycle_bin_until", "<=", fields.Datetime.now()),
        ])
        for folder in expired:
            folder._rehome_employee_documents_before_recycle()
            if folder._get_recycle_linked_documents():
                continue
            if folder.document_ids:
                folder.document_ids.sudo().unlink()
            folder.unlink()

    @api.model
    def get_or_create_department_folder(self, department):
        if not department:
            return self.browse()

        folder = self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("department_ids", "in", [department.id]),
            ],
            limit=1,
        )
        if not folder:
            folder = self.sudo().create(
                {
                    "folder_name": department.name,
                    "description": _("Employee files for %s") % department.name,
                    "folder_type": "employee",
                    "department_ids": [fields.Command.link(department.id)],
                    "access_scope": "department",
                }
            )
        return folder

    @api.model
    def get_pending_upload_folder(self):
        """Return the company holding folder for employee uploads awaiting assignment."""
        param = self.env["ir.config_parameter"].sudo()
        key = "cleon_document_management.pending_upload_folder_id"
        folder_id = param.get_param(key)
        folder = self.sudo().browse(int(folder_id)).exists() if folder_id else self.browse()
        if folder and folder.is_pending_uploads:
            return folder

        folder = self.sudo().create(
            {
                "folder_name": _("Pending Employee Uploads"),
                "description": _(
                    "System folder for employee documents awaiting HR review and folder assignment."
                ),
                "folder_type": "employee",
                "access_scope": "all_staff",
                "is_pending_uploads": True,
                "require_upload_approval": False,
            }
        )
        param.set_param(key, str(folder.id))
        return folder

    @api.model
    def find_department_employee_folder(self, employee):
        """Find an existing admin-created employee folder for the employee."""
        if not employee or not employee.department_id:
            return self.browse()

        membership_folder = self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("employee_ids", "in", [employee.id]),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("is_pending_uploads", "=", False),
            ],
            order="write_date desc, id desc",
            limit=1,
        )
        if membership_folder:
            return membership_folder

        folders = self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("is_pending_uploads", "=", False),
                ("department_ids", "in", [employee.department_id.id]),
            ]
        )
        if not folders:
            return self.browse()

        matching = folders.filtered(
            lambda folder: not folder.grade_ids
            or employee.grade_id in folder.grade_ids
        ).sorted(key=lambda folder: (folder.write_date, folder.id), reverse=True)
        if matching:
            return matching[0]
        return folders.sorted(key=lambda folder: (folder.write_date, folder.id), reverse=True)[0]

    @api.model
    def assign_employee_to_department_folder(self, employee):
        """Link an employee to an existing folder when one matches. Never creates folders."""
        if not employee or not employee.department_id:
            return self.browse()

        existing = self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("employee_ids", "in", [employee.id]),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("is_pending_uploads", "=", False),
            ],
            order="write_date desc, id desc",
            limit=1,
        )
        if existing:
            existing._assign_pending_approved_documents_for_employees(employee)
            return existing

        folder = self.find_department_employee_folder(employee)
        if folder:
            if employee not in folder.employee_ids:
                folder.sudo().write({"employee_ids": [fields.Command.link(employee.id)]})
            folder._assign_pending_approved_documents_for_employees(employee)
            return folder

        return self.browse()

    @api.model
    def resolve_manager_employee_upload_folder(self, employee):
        """Resolve a destination folder for manager-initiated employee uploads."""
        return self.assign_employee_to_department_folder(employee)

    def _assign_pending_approved_documents_for_employees(self, employees):
        self.ensure_one()
        if self.is_pending_uploads or self.folder_type != "employee" or not employees:
            return
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        documents = self.env["doc.document"].sudo().search(
            [
                ("employee_id", "in", employees.ids),
                ("folder_id", "=", pending_folder.id),
                ("active", "=", True),
                ("state", "!=", "rejected"),
                ("approval_state", "!=", "rejected"),
                "|",
                ("state", "=", "approved"),
                ("approval_state", "in", ["approved", "not_required"]),
            ]
        )
        if documents:
            documents = documents.filtered(lambda document: not document.recycle_origin_folder_id)
            for document in documents:
                document._finalize_assignment_to_folder(self)

    @api.model
    def reconcile_pending_uploads_for_folder(self, folder):
        """Re-evaluate pending uploads after an employee folder's approval settings change."""
        folder = folder.sudo().exists()
        if not folder or folder.folder_type != "employee" or folder.is_pending_uploads:
            return

        pending_folder = self.get_pending_upload_folder()
        employees = folder.employee_ids
        if folder.department_ids:
            employees |= self.env["hr.employee"].sudo().search(
                [("department_id", "in", folder.department_ids.ids)]
            )
        if not employees:
            return

        if not folder.require_upload_approval:
            stuck = self.env["doc.document"].sudo().search(
                [
                    ("folder_id", "=", pending_folder.id),
                    ("employee_id", "in", employees.ids),
                    ("active", "=", True),
                    ("state", "!=", "rejected"),
                    ("approval_state", "=", "pending"),
                ]
            )
            for document in stuck:
                document.approval_ids.unlink()
                document.sudo().write(
                    {"state": "draft", "approval_state": "not_required"}
                )
                document._assign_folder_after_approval()

        folder._assign_pending_approved_documents_for_employees(employees)
        self.sync_pending_upload_assignments()

    @api.model
    def sync_pending_upload_assignments(self):
        """Move approved pending-upload documents into department folders when available."""
        pending_folders = self.sudo().search([("is_pending_uploads", "=", True)])
        if not pending_folders:
            pending_folders = self.get_pending_upload_folder()
        documents = self.env["doc.document"].sudo().search(
            [
                ("folder_id", "in", pending_folders.ids),
                ("employee_id", "!=", False),
                ("active", "=", True),
                ("state", "!=", "rejected"),
                ("approval_state", "!=", "rejected"),
            ]
        )
        for document in documents:
            if document.recycle_origin_folder_id:
                continue
            if document.approval_state == "pending":
                continue
            if document.state == "processing":
                continue
            target = self.assign_employee_to_department_folder(document.employee_id)
            if target:
                document._finalize_assignment_to_folder(target)

    @api.model
    def link_employee_to_department_folder(self, employee):
        if not employee or not employee.department_id:
            return self.browse()

        # Reuse the employee folder already configured by an administrator.
        # Only fall back to the department workspace when the employee has not
        # been assigned to any active employee folder yet.
        folder = self.sudo().search(
            [
                ("folder_type", "=", "employee"),
                ("employee_ids", "in", [employee.id]),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("is_pending_uploads", "=", False),
            ],
            order="write_date desc, id desc",
            limit=1,
        )
        if folder:
            folder._assign_pending_approved_documents_for_employees(employee)
            return folder

        return self.assign_employee_to_department_folder(employee)
