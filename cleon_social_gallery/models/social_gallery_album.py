import uuid

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"


class SocialGalleryAlbum(models.Model):
    _name = "social.gallery.album"
    _description = "Social Gallery Album"
    _inherit = ["mail.thread"]
    _order = "create_date desc"

    name = fields.Char(required=True, index=True, tracking=True)
    description = fields.Text()
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    created_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    cover_storage_key = fields.Char(copy=False)
    visibility = fields.Selection(
        [("public", "Public"), ("private", "Private")],
        default="public",
        required=True,
    )
    access_scope = fields.Selection(
        [
            ("company", "Everyone"),
            ("department", "Departments"),
            ("branch", "Branches"),
            ("employee", "Employees"),
        ],
        default="company",
        required=True,
    )
    department_ids = fields.Many2many(
        "hr.department", "social_gallery_album_department_rel", "album_id", "department_id"
    )
    branch_ids = fields.Many2many(
        "multi.branch", "social_gallery_album_branch_rel", "album_id", "branch_id"
    )
    employee_ids = fields.Many2many(
        "hr.employee", "social_gallery_album_employee_rel", "album_id", "employee_id"
    )
    status = fields.Selection(
        [
            ("draft", "Draft"),
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("archived", "Archived"),
        ],
        default="approved",
        required=True,
        index=True,
    )
    is_pinned = fields.Boolean(default=False)
    pinned_user_ids = fields.Many2many(
        "res.users", "social_gallery_album_pin_rel", "album_id", "user_id"
    )
    event_name = fields.Char()
    media_ids = fields.One2many("social.gallery.media", "album_id")
    media_count = fields.Integer(compute="_compute_counts", store=True)
    photo_count = fields.Integer(compute="_compute_counts", store=True)
    video_count = fields.Integer(compute="_compute_counts", store=True)
    total_size = fields.Integer(compute="_compute_counts", store=True)
    active = fields.Boolean(default=True)

    @api.depends("media_ids", "media_ids.file_size", "media_ids.media_type", "media_ids.deleted_at", "media_ids.approval_status")
    def _compute_counts(self):
        for album in self:
            media = album.media_ids.filtered(
                lambda m: not m.deleted_at and m.approval_status == "approved"
            )
            album.media_count = len(media)
            album.photo_count = len(media.filtered(lambda m: m.media_type == "image"))
            album.video_count = len(media.filtered(lambda m: m.media_type == "video"))
            album.total_size = sum(media.mapped("file_size"))

    @api.constrains("access_scope", "department_ids", "branch_ids", "employee_ids")
    def _check_access_scope(self):
        for album in self:
            if album.access_scope == "department" and not album.department_ids:
                raise ValidationError(_("Select at least one department."))
            if album.access_scope == "branch" and not album.branch_ids:
                raise ValidationError(_("Select at least one branch."))
            if album.access_scope == "employee" and not album.employee_ids:
                raise ValidationError(_("Select at least one employee."))

    def _is_gallery_admin(self, user=None):
        user = user or self.env.user
        return user.has_group(ADMIN_GROUP) or user.has_group("base.group_system")

    def _is_gallery_manager(self, user=None):
        user = user or self.env.user
        return self._is_gallery_admin(user) or user.has_group(MANAGER_GROUP)

    def _user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self.company_id != user.company_id:
            return False
        if self._is_gallery_manager(user):
            return True
        if self.visibility == "private" and self.created_by != user:
            return False
        if self.status not in ("approved",) and self.created_by != user:
            return False
        employee = user.employee_id
        if self.access_scope == "company":
            return True
        if self.access_scope == "department":
            return bool(employee and employee.department_id in self.department_ids)
        if self.access_scope == "branch":
            branch = getattr(employee, "branch_id", False)
            return bool(branch and branch in self.branch_ids)
        return bool(employee and employee in self.employee_ids)

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self._is_gallery_manager(user) or self.created_by == user

    @api.model
    def create(self, vals):
        if not self.env.user.has_group(MANAGER_GROUP) and not self.env.user.has_group(ADMIN_GROUP):
            if vals.get("visibility") != "private":
                vals["status"] = "pending"
        return super().create(vals)

    @api.model
    def _cron_create_monthly_album(self):
        for company in self.env["res.company"].search([("sg_auto_create_monthly_album", "=", True)]):
            month_label = fields.Date.today().strftime("Gallery — %B %Y")
            existing = self.search([
                ("company_id", "=", company.id),
                ("name", "=", month_label),
            ], limit=1)
            if existing:
                continue
            admin = self.env["res.users"].search([
                ("company_id", "=", company.id),
                ("groups_id", "in", self.env.ref(ADMIN_GROUP).id),
            ], limit=1)
            self.create({
                "name": month_label,
                "company_id": company.id,
                "created_by": admin.id if admin else self.env.user.id,
                "visibility": company.sg_default_visibility,
                "status": "approved",
            })
