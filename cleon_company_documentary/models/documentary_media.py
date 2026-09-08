from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CompanyDocumentaryMedia(models.Model):
    _name = "company.documentary.media"
    _description = "Company Documentary Video"
    _inherit = ["mail.thread"]
    _order = "create_date desc"

    name = fields.Char(string="Title", required=True, index=True, tracking=True)
    description = fields.Html(sanitize=True)
    folder_id = fields.Many2one(
        "company.documentary.folder", required=True, ondelete="restrict", index=True
    )
    company_id = fields.Many2one(related="folder_id.company_id", store=True, index=True)
    owner_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    uploaded_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    tag_ids = fields.Many2many(
        "company.documentary.tag",
        "company_documentary_media_tag_rel",
        "media_id",
        "tag_id",
    )
    favorite_user_ids = fields.Many2many(
        "res.users",
        "company_documentary_media_favorite_rel",
        "media_id",
        "user_id",
        string="Favorites",
    )
    processing_state = fields.Selection(
        [
            ("uploading", "Uploading"),
            ("processing", "Processing"),
            ("ready", "Ready"),
            ("failed", "Failed"),
        ],
        default="uploading",
        required=True,
        index=True,
        tracking=True,
    )
    processing_error = fields.Text(readonly=True)
    active = fields.Boolean(default=True, index=True)
    deleted_at = fields.Datetime(readonly=True, index=True)
    deleted_by = fields.Many2one("res.users", readonly=True)
    original_filename = fields.Char(required=True)
    mime_type = fields.Char(required=True)
    file_size = fields.Integer(required=True)
    checksum = fields.Char(index=True)
    duration_seconds = fields.Float()
    storage_key = fields.Char(required=True, index=True, copy=False)
    variants = fields.Json(default=dict, copy=False)
    thumbnail_key = fields.Char(copy=False)
    thumbnail_source = fields.Selection(
        [("generated", "Generated"), ("custom", "Custom")],
        default="generated",
    )
    download_policy = fields.Selection(
        [("inherit", "Inherit folder policy"), ("allow", "Allow downloads"), ("deny", "Block downloads")],
        default="inherit",
        required=True,
    )
    mandatory = fields.Boolean(string="Mandatory Training", default=False)
    completion_threshold = fields.Float(default=85.0)
    comments_enabled = fields.Boolean(default=False)
    scope_mode = fields.Selection(
        [("inherited", "Inherit folder access"), ("override", "Use stricter media access")],
        default="inherited",
        required=True,
    )
    access_scope = fields.Selection(
        [("company", "Everyone"), ("department", "Specific Departments"),
         ("grade", "Specific Grades"), ("employee", "Specific Employees")],
        default="company",
    )
    department_ids = fields.Many2many(
        "hr.department", "company_documentary_media_department_rel", "media_id", "department_id"
    )
    grade_ids = fields.Many2many(
        "hr.grade", "company_documentary_media_grade_rel", "media_id", "grade_id"
    )
    employee_ids = fields.Many2many(
        "hr.employee", "company_documentary_media_employee_rel", "media_id", "employee_id"
    )
    subtitle_ids = fields.One2many("company.documentary.subtitle", "media_id")
    watch_progress_ids = fields.One2many("company.documentary.watch", "media_id")
    view_count = fields.Integer(compute="_compute_engagement", store=True)
    unique_viewer_count = fields.Integer(compute="_compute_engagement", store=True)

    @api.depends("watch_progress_ids", "watch_progress_ids.view_count", "watch_progress_ids.user_id")
    def _compute_engagement(self):
        for media in self:
            records = media.watch_progress_ids
            media.view_count = sum(records.mapped("view_count"))
            media.unique_viewer_count = len(records.mapped("user_id"))

    @api.constrains("file_size", "mime_type", "completion_threshold")
    def _check_media_values(self):
        allowed_types = {"video/mp4", "video/webm", "video/quicktime"}
        for media in self:
            if media.file_size <= 0 or media.file_size > 10 * 1024 * 1024 * 1024:
                raise ValidationError(_("Video files must be greater than 0 and no larger than 10 GB."))
            if media.mime_type not in allowed_types:
                raise ValidationError(_("Only MP4, WebM, and MOV videos are supported."))
            if not 1 <= media.completion_threshold <= 100:
                raise ValidationError(_("Completion threshold must be between 1 and 100."))

    @api.constrains("scope_mode", "access_scope", "department_ids", "grade_ids", "employee_ids")
    def _check_media_scope(self):
        for media in self:
            if media.scope_mode == "inherited":
                if media.department_ids or media.grade_ids or media.employee_ids:
                    raise ValidationError(_("Inherited media access cannot define separate targets."))
                continue
            if media.access_scope == "department" and not media.department_ids:
                raise ValidationError(_("Select at least one department for media access."))
            if media.access_scope == "grade" and not media.grade_ids:
                raise ValidationError(_("Select at least one grade for media access."))
            if media.access_scope == "employee" and not media.employee_ids:
                raise ValidationError(_("Select at least one employee for media access."))
            if media.access_scope == "company":
                raise ValidationError(_("Media overrides must be stricter than the folder."))
            if media.folder_id.access_scope == "employee" and media.access_scope != "employee":
                raise ValidationError(_("An employee-scoped folder can only use employee-scoped media overrides."))
            if media.folder_id.access_scope == "department" and media.access_scope == "department":
                if not set(media.department_ids.ids).issubset(set(media.folder_id.department_ids.ids)):
                    raise ValidationError(_("Media departments must be within the folder departments."))
            if media.folder_id.access_scope == "grade" and media.access_scope == "grade":
                if not set(media.grade_ids.ids).issubset(set(media.folder_id.grade_ids.ids)):
                    raise ValidationError(_("Media grades must be within the folder grades."))

    def _user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if not self.active or self.deleted_at or self.processing_state != "ready":
            return False
        if not self.folder_id._user_can_view(user):
            return False
        if self.scope_mode == "inherited" or self.folder_id._is_documentary_admin(user):
            return True
        employee = user.employee_id
        if self.access_scope == "department":
            return bool(employee and employee.department_id in self.department_ids)
        if self.access_scope == "grade":
            return bool(employee and employee.grade_id in self.grade_ids)
        return bool(employee and employee in self.employee_ids)

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self.folder_id._user_can_edit(user) or self.owner_id == user

    def _user_can_download(self, user=None):
        self.ensure_one()
        if not self._user_can_view(user):
            return False
        if self.download_policy == "allow":
            return True
        if self.download_policy == "deny":
            return False
        return self.folder_id.allow_download

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            folder = self.env["company.documentary.folder"].browse(vals.get("folder_id")).exists()
            if not folder or not folder._user_can_edit():
                raise AccessError(_("You do not have permission to add videos to this folder."))
        return super().create(vals_list)

    def write(self, vals):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to edit this video."))
        return super().write(vals)

    def action_archive(self):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to archive this video."))
            media.write({"active": False})

    def action_restore(self):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to restore this video."))
            media.write({"active": True, "deleted_at": False, "deleted_by": False})

    def action_move_to_recycle_bin(self):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to delete this video."))
            media.write({
                "active": False,
                "deleted_at": fields.Datetime.now(),
                "deleted_by": self.env.user.id,
            })

    def unlink(self):
        if any(not media._user_can_edit() for media in self):
            raise AccessError(_("You do not have permission to delete this video."))
        return super().unlink()
