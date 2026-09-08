from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


DOCUMENTARY_MANAGER = "cleon_company_documentary.group_company_documentary_manager"
DOCUMENTARY_ADMIN = "cleon_company_documentary.group_company_documentary_admin"


class CompanyDocumentaryFolder(models.Model):
    _name = "company.documentary.folder"
    _description = "Company Documentary Folder"
    _parent_name = "parent_id"
    _parent_store = True
    _rec_name = "name"
    _order = "parent_path, name"

    name = fields.Char(required=True, index=True)
    description = fields.Text()
    parent_id = fields.Many2one(
        "company.documentary.folder", ondelete="restrict", index=True
    )
    parent_path = fields.Char(index=True)
    child_ids = fields.One2many("company.documentary.folder", "parent_id")
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    owner_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    editor_ids = fields.Many2many(
        "res.users",
        "company_documentary_folder_editor_rel",
        "folder_id",
        "user_id",
        string="Editors",
    )
    access_scope = fields.Selection(
        [
            ("company", "Everyone"),
            ("department", "Specific Departments"),
            ("grade", "Specific Grades"),
            ("employee", "Specific Employees"),
        ],
        required=True,
        default="company",
        index=True,
    )
    department_ids = fields.Many2many(
        "hr.department",
        "company_documentary_folder_department_rel",
        "folder_id",
        "department_id",
    )
    grade_ids = fields.Many2many(
        "hr.grade",
        "company_documentary_folder_grade_rel",
        "folder_id",
        "grade_id",
    )
    employee_ids = fields.Many2many(
        "hr.employee",
        "company_documentary_folder_employee_rel",
        "folder_id",
        "employee_id",
    )
    allow_download = fields.Boolean(
        string="Allow Downloads", default=False,
        help="Videos inherit this download policy unless a media item explicitly narrows it.",
    )
    archived = fields.Boolean(default=False, index=True)
    deleted_at = fields.Datetime(readonly=True, index=True)
    deleted_by = fields.Many2one("res.users", readonly=True)
    media_ids = fields.One2many("company.documentary.media", "folder_id")
    media_count = fields.Integer(compute="_compute_media_count", store=True)

    @api.depends("media_ids", "media_ids.active")
    def _compute_media_count(self):
        for folder in self:
            folder.media_count = len(folder.media_ids.filtered("active"))

    @api.constrains("access_scope", "department_ids", "grade_ids", "employee_ids")
    def _check_scope_targets(self):
        for folder in self:
            if folder.access_scope == "department" and not folder.department_ids:
                raise ValidationError(_("Select at least one department."))
            if folder.access_scope == "grade" and not folder.grade_ids:
                raise ValidationError(_("Select at least one grade."))
            if folder.access_scope == "employee" and not folder.employee_ids:
                raise ValidationError(_("Select at least one employee."))
            if folder.access_scope != "department" and folder.department_ids:
                raise ValidationError(_("Departments can only be selected for department access."))
            if folder.access_scope != "grade" and folder.grade_ids:
                raise ValidationError(_("Grades can only be selected for grade access."))
            if folder.access_scope != "employee" and folder.employee_ids:
                raise ValidationError(_("Employees can only be selected for employee access."))

    @api.constrains("parent_id", "company_id")
    def _check_parent_company(self):
        for folder in self:
            if folder.parent_id and folder.parent_id.company_id != folder.company_id:
                raise ValidationError(_("A folder must use the same company as its parent."))

    def _is_documentary_manager(self, user=None):
        user = user or self.env.user
        return user.has_group(DOCUMENTARY_MANAGER)

    def _is_documentary_admin(self, user=None):
        user = user or self.env.user
        return user.has_group(DOCUMENTARY_ADMIN)

    def _user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self.company_id != user.company_id or self.archived or self.deleted_at:
            return False
        ancestor = self.parent_id
        while ancestor:
            if not ancestor._user_can_view(user):
                return False
            ancestor = ancestor.parent_id
        if self._is_documentary_admin(user) or user in self.editor_ids or self.owner_id == user:
            return True
        if self.access_scope == "company":
            return True
        employee = user.employee_id
        if not employee:
            return False
        if self.access_scope == "department":
            return employee.department_id in self.department_ids
        if self.access_scope == "grade":
            return employee.grade_id in self.grade_ids
        return employee in self.employee_ids

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self._is_documentary_manager(user) or user in self.editor_ids or self.owner_id == user

    @api.model_create_multi
    def create(self, vals_list):
        if not self._is_documentary_manager():
            raise AccessError(_("Only Documentary Managers can create folders."))
        return super().create(vals_list)

    def write(self, vals):
        for folder in self:
            if not folder._user_can_edit():
                raise AccessError(_("You do not have permission to edit this documentary folder."))
        return super().write(vals)

    def action_archive(self):
        for folder in self:
            if not folder._user_can_edit():
                raise AccessError(_("You do not have permission to archive this folder."))
            folder.write({"archived": True})

    def action_restore(self):
        for folder in self:
            if not folder._user_can_edit():
                raise AccessError(_("You do not have permission to restore this folder."))
            folder.write({"archived": False, "deleted_at": False, "deleted_by": False})

    def action_move_to_recycle_bin(self):
        for folder in self:
            if not folder._user_can_edit():
                raise AccessError(_("You do not have permission to delete this folder."))
            folder.write({
                "archived": True,
                "deleted_at": fields.Datetime.now(),
                "deleted_by": self.env.user.id,
            })

    def unlink(self):
        if any(not folder._user_can_edit() for folder in self):
            raise AccessError(_("You do not have permission to delete this folder."))
        if any(folder.media_ids for folder in self):
            raise ValidationError(_("Move or delete the videos in a folder before deleting it."))
        return super().unlink()
