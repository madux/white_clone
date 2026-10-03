from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


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
            ("intelligence", "Intelligence uploads"),
        ],
        string="Folder Type",
        required=True,
        default="organizational",
    )

    folder_kind = fields.Selection(
        [
            ("folder", "Folder"),
            ("project", "Project"),
            ("vendor", "Vendor"),
            ("policy", "Policy"),
        ],
        string="Organizational kind",
        default="folder",
    )
    collection_code = fields.Char(string="Collection ID", copy=False, index=True)
    organize_by = fields.Selection(
        [
            ("none", "None"),
            ("department", "Department"),
            ("grade", "Grade"),
            ("location", "Location"),
            ("employment_type", "Employment type"),
        ],
        default="none",
        string="Organize by",
    )

    is_employee_file_v3 = fields.Boolean(
        string="Employee File v3 storage",
        default=False,
        help="Hidden storage folder for a single Employee File record.",
    )

    legacy_employee_folder = fields.Boolean(
        string="Legacy employee folder",
        default=False,
        help="Pre-v3 manual employee folder; hidden after Employee Files setup.",
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
            ("private", "Private (creator and administrators)"),
            ("company_owned", "Company owned"),
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
        copy=False,
        help="Blocks folder modifications and uploads. Does not hide the folder or change read access.",
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
        copy=False,
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

    ORGANIZATIONAL_SCOPE_RANK = {
        "all_staff": 0,
        "department": 1,
        "business_unit": 1,
        "grade": 1,
        "role": 1,
        "employment_type": 1,
        "location": 1,
        "individual": 2,
        "private": 3,
        "company_owned": 3,
        "admin_only": 4,
    }
    ORGANIZATIONAL_SCOPE_FIELDS = frozenset(
        {
            "parent_id",
            "access_scope",
            "department_ids",
            "grade_ids",
            "employee_ids",
            "employment_type_ids",
            "branch_ids",
            "role_group_ids",
        }
    )
    CHILD_SCOPE_EXCEEDS_PARENT = _(
        "A subfolder cannot be more open than its parent folder."
    )

    def _organizational_scope_vals(self):
        self.ensure_one()
        return {
            "access_scope": self.access_scope,
            "department_ids": [fields.Command.set(self.department_ids.ids)],
            "grade_ids": [fields.Command.set(self.grade_ids.ids)],
            "employee_ids": [fields.Command.set(self.employee_ids.ids)],
            "employment_type_ids": [fields.Command.set(self.employment_type_ids.ids)],
            "branch_ids": [fields.Command.set(self.branch_ids.ids)],
            "role_group_ids": [fields.Command.set(self.role_group_ids.ids)],
        }

    def _organizational_scope_exceeds(self, parent):
        """Return True if this folder's audience is wider than the parent folder."""
        self.ensure_one()
        if (
            not parent
            or parent.folder_type != "organizational"
            or self.folder_type != "organizational"
        ):
            return False
        parent_rank = self.ORGANIZATIONAL_SCOPE_RANK.get(parent.access_scope, 0)
        child_rank = self.ORGANIZATIONAL_SCOPE_RANK.get(self.access_scope, 0)
        if child_rank < parent_rank:
            return True
        if parent.access_scope == "admin_only":
            return self.access_scope != "admin_only"
        if parent.access_scope == "private":
            return self.access_scope not in ("private", "company_owned", "admin_only")
        if parent.access_scope == "company_owned":
            return self.access_scope not in ("private", "company_owned", "admin_only")
        if parent.access_scope == "all_staff":
            return False
        if self.access_scope in ("admin_only", "private", "company_owned"):
            return False
        parent_employees = parent._get_scope_employees()
        child_employees = self._get_scope_employees()
        return bool(child_employees - parent_employees)

    @api.constrains(
        "parent_id",
        "folder_type",
        "access_scope",
        "department_ids",
        "grade_ids",
        "employee_ids",
        "employment_type_ids",
        "branch_ids",
        "role_group_ids",
    )
    def _check_child_scope_within_parent(self):
        for folder in self:
            if folder._organizational_scope_exceeds(folder.parent_id):
                raise ValidationError(self.CHILD_SCOPE_EXCEEDS_PARENT)

    def _clamp_children_to_parent_scope(self):
        for folder in self:
            if folder.folder_type != "organizational":
                continue
            children = folder.child_ids.filtered(
                lambda child: child.folder_type == "organizational"
            )
            for child in children:
                if child._organizational_scope_exceeds(folder):
                    child.with_context(
                        doc_skip_lock_for_scope_clamp=True
                    ).write(folder._organizational_scope_vals())

    LOCKED_FOLDER_ERROR = _(
        "This folder is locked. Unlock it before making changes."
    )
    LOCKED_UPLOAD_ERROR = _(
        "This folder is locked and cannot accept document uploads."
    )
    LOCKED_DUPLICATE_DOCS_ERROR = _(
        "This folder is locked. Unlock it before duplicating with documents."
    )
    FOLDER_LOCK_FIELDS = frozenset({"is_locked", "locked_by"})
    FOLDER_LIFECYCLE_FIELDS = frozenset(
        {
            "active",
            "distribution_status",
            "deleted_at",
            "deleted_by",
            "recycle_bin_until",
        }
    )
    FOLDER_PERSONAL_FIELDS = frozenset({"favorite_user_ids", "pinned_user_ids"})
    FOLDER_MODIFICATION_FIELDS = frozenset(
        {
            "folder_name",
            "description",
            "color",
            "color_hex",
            "parent_id",
            "access_scope",
            "department_ids",
            "branch_ids",
            "grade_ids",
            "employment_type_ids",
            "role_group_ids",
            "allowed_user_ids",
            "allowed_document_type_ids",
            "employee_ids",
            "retention_period",
            "require_upload_approval",
            "approval_flow",
            "approver_ids",
        }
    )

    def _is_document_manager(self):
        return self.env.user.has_group("cleon_document_management.group_document_manager")

    def _user_can_lock(self, user=None):
        user = user or self.env.user
        perm = self.env["doc.organizational.files.permission"]
        for folder in self:
            if folder.folder_type == "organizational":
                if not perm.user_can_manage_folders(user):
                    return False
            elif not user.has_group("cleon_document_management.group_document_manager"):
                return False
        return True

    def _check_lock_permission(self):
        if not self._user_can_lock():
            raise AccessError(
                _("You do not have permission to lock or unlock this folder.")
            )

    def assert_unlocked(self, *, for_upload=False, for_documents_copy=False):
        locked = self.filtered("is_locked")
        if not locked:
            return
        if for_upload:
            raise UserError(self.LOCKED_UPLOAD_ERROR)
        if for_documents_copy:
            raise UserError(self.LOCKED_DUPLICATE_DOCS_ERROR)
        raise UserError(self.LOCKED_FOLDER_ERROR)

    def _assert_unlocked_for_write(self, vals):
        if self.env.context.get("doc_skip_lock_for_scope_clamp"):
            return
        pending = set(vals)
        if not pending & self.FOLDER_MODIFICATION_FIELDS:
            return
        self.assert_unlocked()

    def _create_lock_audit(self, action):
        Audit = self.env["doc.folder.lock.audit"].sudo()
        now = fields.Datetime.now()
        Audit.create(
            [
                {
                    "folder_id": folder.id,
                    "action": action,
                    "actor_id": self.env.user.id,
                    "occurred_at": now,
                }
                for folder in self
            ]
        )

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
        if (
            self.folder_type == "organizational"
            and (self.folder_kind or "folder") == "policy"
        ):
            policy = self.env["doc.organizational.policy"].for_folder(self)
            if policy and policy.lifecycle_status == "draft":
                perm = self.env["doc.organizational.files.permission"]
                if not perm.user_can_manage_org_policy_lifecycle(user):
                    return False
        if self.access_scope == "admin_only":
            perm = self.env["doc.organizational.files.permission"]
            return (
                user.has_group("cleon_document_management.group_document_admin")
                or perm.user_is_platform_admin(user)
                or perm.user_has_legacy_manager(user)
            )
        if self.access_scope == "private":
            perm = self.env["doc.organizational.files.permission"]
            if user == self.create_uid:
                return True
            return (
                user.has_group("cleon_document_management.group_document_admin")
                or perm.user_is_platform_admin(user)
                or perm.user_has_legacy_manager(user)
            )
        if self.access_scope == "company_owned":
            config = self.env["doc.employee.files.config"].get_for_company(
                self.company_id
            )
            return config.user_can_access_company_owned(user, self.create_uid)
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
            "private",
            "company_owned",
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
        if not self.env.context.get("intelligence_upload_folder") and not self._is_document_manager():
            raise AccessError(_("Only document managers can create folders."))
        for vals in vals_list:
            self._sanitize_organizational_vals(vals)
        records = super().create(vals_list)
        records._assign_collection_codes()
        return records

    def _assign_collection_codes(self):
        prefixes = {
            "project": "PRJ",
            "vendor": "VND",
            "policy": "POL",
            "folder": "COL",
        }
        for folder in self:
            if folder.folder_type != "organizational" or folder.collection_code:
                continue
            prefix = prefixes.get(folder.folder_kind or "folder", "COL")
            folder.collection_code = f"{prefix}-{folder.id:05d}"

    def _breadcrumb_labels(self):
        self.ensure_one()
        names = []
        current = self
        seen = set()
        while current and current.id not in seen:
            seen.add(current.id)
            names.append({"id": current.id, "name": current.folder_name})
            current = current.parent_id
        names.reverse()
        return names

    def _lifecycle_location_label(self):
        self.ensure_one()
        if self.folder_type == "employee":
            library = _("Employee Files")
        elif self.folder_type == "organizational":
            library = _("Organizational Files")
        else:
            library = _("Documents")
        kind_labels = {
            "project": _("Project"),
            "vendor": _("Vendor"),
            "policy": _("Policy"),
            "folder": _("Folder"),
        }
        kind_label = kind_labels.get(self.folder_kind or "folder", _("Folder"))
        segments = [library, kind_label]
        if self.parent_id:
            ancestors = []
            current = self.parent_id
            seen = set()
            while current and current.id not in seen:
                seen.add(current.id)
                ancestors.append(current.folder_name)
                current = current.parent_id
            ancestors.reverse()
            if ancestors:
                segments.append(" / ".join(ancestors))
        return " · ".join(segments)

    def _descendant_ids(self):
        self.ensure_one()
        found = set()
        stack = list(self.child_ids)
        while stack:
            child = stack.pop()
            if child.id in found:
                continue
            found.add(child.id)
            stack.extend(child.child_ids)
        return found

    def _folder_tree_depth(self):
        self.ensure_one()
        depth = 0
        current = self.parent_id
        seen = set()
        while current and current.id not in seen:
            seen.add(current.id)
            depth += 1
            current = current.parent_id
        return depth

    def _expand_with_descendants(self):
        all_ids = set(self.ids)
        for folder in self:
            all_ids |= folder._descendant_ids()
        return self.browse(list(all_ids))

    def action_move_folder(self, parent_folder):
        self.ensure_one()
        self.assert_unlocked()
        new_parent = parent_folder if parent_folder else self.env["doc.folder"]
        if new_parent:
            if new_parent.folder_type != "organizational":
                raise UserError(_("Folders can only be moved inside Organizational Files."))
            if new_parent.id == self.id or new_parent.id in self._descendant_ids():
                raise UserError(
                    _("A folder cannot be moved under itself or one of its descendants.")
                )
            new_parent.assert_unlocked()
        vals = {"parent_id": new_parent.id if new_parent else False}
        if new_parent and self._organizational_scope_exceeds(new_parent):
            vals.update(new_parent._organizational_scope_vals())
        self.write(vals)
        return True

    def write(self, vals):
        vals = dict(vals)
        pending = set(vals)
        only_lock = pending <= self.FOLDER_LOCK_FIELDS and bool(
            pending & self.FOLDER_LOCK_FIELDS
        )
        if only_lock:
            self._check_lock_permission()
            previous = {folder.id: folder.is_locked for folder in self}
            result = super().write(vals)
            changed_lock = self.filtered(
                lambda folder: not previous.get(folder.id) and folder.is_locked
            )
            changed_unlock = self.filtered(
                lambda folder: previous.get(folder.id) and not folder.is_locked
            )
            if changed_lock:
                changed_lock._create_lock_audit("lock")
            if changed_unlock:
                changed_unlock._create_lock_audit("unlock")
            return result

        if not self._is_document_manager():
            allowed = set(self.FOLDER_PERSONAL_FIELDS)
            org_only = (
                self.filtered(lambda folder: folder.folder_type == "organizational")
                == self
            )
            perm = self.env["doc.organizational.files.permission"]
            if org_only and perm.user_can_manage_folders(self.env.user):
                allowed |= self.FOLDER_MODIFICATION_FIELDS
            if org_only and perm.user_can_folder_archive(self.env.user):
                allowed |= self.FOLDER_LIFECYCLE_FIELDS
            if pending - allowed:
                raise AccessError(
                    _("You can only update your folder favorites and pins.")
                )
        self._assert_unlocked_for_write(vals)
        if self.filtered(lambda folder: folder.folder_type == "organizational") == self:
            vals.update(self._clear_approval_values())
        result = super().write(vals)
        if {"deleted_at", "active", "distribution_status"} & set(vals):
            dead = self.filtered(
                lambda folder: folder.deleted_at
                or not folder.active
                or folder.distribution_status != "active"
            )
            if dead:
                dead.mapped("document_ids")._drop_ask_index()
            live = self - dead
            if live:
                live.mapped("document_ids").with_context(ask_indexing=True).write(
                    {"ask_index_stamp": False}
                )
        if pending & self.ORGANIZATIONAL_SCOPE_FIELDS:
            self._clamp_children_to_parent_scope()
        return result

    def unlink(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        self.env["doc.organizational.policy"].unlink_for_folders(self)
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

    def action_duplicate(self, include_documents=False):
        self.ensure_one()
        if include_documents:
            self.assert_unlocked(for_documents_copy=True)
        new_folder = self.with_context(include_documents=include_documents).copy(
            default={
                "folder_name": _("%s (Copy)") % self.folder_name,
                "favorite_user_ids": [fields.Command.clear()],
                "pinned_user_ids": [fields.Command.clear()],
                "is_locked": False,
                "locked_by": False,
            }
        )
        if include_documents:
            Document = self.env["doc.document"]
            for document in self.document_ids.filtered(
                lambda item: item.active and not item.deleted_at
            ):
                document.with_context(org_document_copy=True).copy(
                    default={
                        "folder_id": new_folder.id,
                        "name": document.name,
                    }
                )
        return new_folder

    def action_lock(self):
        self._check_lock_permission()
        to_lock = self.filtered(lambda folder: not folder.is_locked)
        if to_lock:
            to_lock.write(
                {
                    "is_locked": True,
                    "locked_by": self.env.user.id,
                }
            )

    def action_unlock(self):
        self._check_lock_permission()
        to_unlock = self.filtered("is_locked")
        if to_unlock:
            to_unlock.write(
                {
                    "is_locked": False,
                    "locked_by": False,
                }
            )

    def action_archive(self):
        perm = self.env["doc.organizational.files.permission"]
        if self.folder_type == "organizational":
            if not perm.user_can_folder_archive(self.env.user):
                raise AccessError(_("You do not have permission to archive this folder."))
        elif not self._is_document_manager():
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
        self._disambiguate_restored_folder_names()
        self.env["doc.organizational.policy"].restore_for_recycled_folders(self)

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
        self.env["doc.organizational.policy"].archive_for_recycled_folders(self)

    def _organizational_sibling_name_taken(self, name, folder):
        domain = [
            ("folder_type", "=", folder.folder_type),
            ("folder_name", "=", name),
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("id", "!=", folder.id),
        ]
        if folder.parent_id:
            domain.append(("parent_id", "=", folder.parent_id.id))
        else:
            domain.append(("parent_id", "=", False))
        return bool(self.search(domain, limit=1))

    def _disambiguate_restored_folder_names(self):
        Policy = self.env["doc.organizational.policy"]
        for folder in self:
            base_name = (folder.folder_name or "").strip()
            if not base_name or not self._organizational_sibling_name_taken(
                base_name, folder
            ):
                continue
            suffix = 2
            while suffix < 1000:
                candidate = f"{base_name} ({suffix})"
                if not self._organizational_sibling_name_taken(candidate, folder):
                    folder.folder_name = candidate
                    policy = Policy.search([("folder_id", "=", folder.id)], limit=1)
                    if policy:
                        policy.name = candidate
                    break
                suffix += 1

    def action_permanent_delete(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        subtree = self._expand_with_descendants()
        for folder in subtree:
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
        ordered = subtree.sorted(key=lambda folder: folder._folder_tree_depth(), reverse=True)
        Policy = self.env["doc.organizational.policy"]
        Policy.unlink_for_folders(ordered)
        for folder in ordered:
            folder.document_ids.sudo().unlink()
            folder.sudo().unlink()

    def action_force_permanent_delete(self):
        """Permanently delete a recycled folder and every linked document."""
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete folders."))
        subtree = self._expand_with_descendants()
        if any(folder.is_pending_uploads for folder in subtree):
            raise ValidationError(
                _("The pending uploads folder cannot be permanently deleted.")
            )
        ordered = subtree.sorted(key=lambda folder: folder._folder_tree_depth(), reverse=True)
        Policy = self.env["doc.organizational.policy"]
        Policy.unlink_for_folders(ordered)
        for folder in ordered:
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
