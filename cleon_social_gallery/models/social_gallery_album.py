import uuid

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"


def _comodel_available(env, field):
    comodel = getattr(field, "comodel_name", None)
    return bool(comodel and comodel in env)


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
            ("unit", "Units"),
            ("grade", "Grade Levels"),
            ("employee", "Employees"),
            ("custom_group", "Custom Group"),
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
    unit_ids = fields.Many2many(
        "hr.unit", "social_gallery_album_unit_rel", "album_id", "unit_id"
    )
    grade_ids = fields.Many2many(
        "hr.grade", "social_gallery_album_grade_rel", "album_id", "grade_id"
    )
    custom_group_ids = fields.Many2many(
        "social.gallery.custom.group",
        "social_gallery_album_custom_group_rel",
        "album_id",
        "group_id",
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
    deleted_at = fields.Datetime(index=True)
    deleted_by = fields.Many2one("res.users", readonly=True)
    rejection_reason = fields.Text()
    resubmitted_at = fields.Datetime()
    legal_hold = fields.Boolean(default=False, index=True)
    legal_hold_reason = fields.Char()

    def _safe_m2m_ids(self, field_name):
        """Read M2M ids without crashing when the comodel is missing from the registry."""
        self.ensure_one()
        field = self._fields.get(field_name)
        if not field or field.type != "many2many" or not _comodel_available(self.env, field):
            return []
        try:
            return self[field_name].ids
        except ValueError:
            return []

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

    @api.constrains(
        "access_scope", "department_ids", "branch_ids", "employee_ids",
        "unit_ids", "grade_ids", "custom_group_ids",
    )
    def _check_access_scope(self):
        for album in self:
            if album.access_scope == "department" and not album.department_ids:
                raise ValidationError(_("Select at least one department."))
            if album.access_scope == "branch" and not album.branch_ids:
                raise ValidationError(_("Select at least one branch."))
            if album.access_scope == "employee" and not album.employee_ids:
                raise ValidationError(_("Select at least one employee."))
            if album.access_scope == "unit":
                if not _comodel_available(album.env, album._fields.get("unit_ids")):
                    raise ValidationError(_("Unit scope requires the Core HR module (hr.unit). Upgrade hr_employee and Social Gallery."))
                if not album._safe_m2m_ids("unit_ids"):
                    raise ValidationError(_("Select at least one unit."))
            if album.access_scope == "grade":
                if not _comodel_available(album.env, album._fields.get("grade_ids")):
                    raise ValidationError(_("Grade scope requires the Core HR module (hr.grade). Upgrade hr_employee and Social Gallery."))
                if not album._safe_m2m_ids("grade_ids"):
                    raise ValidationError(_("Select at least one grade level."))
            if album.access_scope == "custom_group" and not album.custom_group_ids:
                raise ValidationError(_("Select at least one custom group."))

    def _employee_matches_scope(self, employee):
        self.ensure_one()
        if self.access_scope == "company":
            return True
        if not employee:
            return False
        if self.access_scope == "department":
            return bool(employee.department_id in self.department_ids)
        if self.access_scope == "branch":
            branch = getattr(employee, "branch_id", False)
            return bool(branch and branch in self.branch_ids)
        if self.access_scope == "unit":
            if not _comodel_available(self.env, self._fields.get("unit_ids")):
                return False
            unit = getattr(employee, "unit_id", False)
            return bool(unit and unit.id in self._safe_m2m_ids("unit_ids"))
        if self.access_scope == "grade":
            if not _comodel_available(self.env, self._fields.get("grade_ids")):
                return False
            grade = getattr(employee, "grade_id", False)
            return bool(grade and grade.id in self._safe_m2m_ids("grade_ids"))
        if self.access_scope == "custom_group":
            return bool(self.custom_group_ids.filtered(lambda g: employee in g.employee_ids))
        return employee in self.employee_ids

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
        if self.deleted_at:
            return self._is_gallery_manager(user)
        is_creator = self.created_by == user
        if self._is_gallery_admin(user):
            return True
        if self._is_gallery_manager(user):
            return self.status == "approved" or is_creator
        if self.status != "approved":
            return is_creator
        if self.visibility == "private":
            return is_creator
        employee = user.sudo().employee_id
        if self.access_scope == "company":
            return True
        return self._employee_matches_scope(employee)

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self._is_gallery_admin(user):
            return True
        return self.created_by == user and self._is_gallery_manager(user)

    def _is_trusted_creator(self, user=None):
        user = user or self.env.user
        return bool(self.env["social.gallery.trusted.user"].sudo().search_count([
            ("company_id", "=", self.company_id.id),
            ("user_id", "=", user.id),
        ]))

    @api.model
    def create(self, vals):
        user = self.env.user
        if user.has_group(ADMIN_GROUP) or user.has_group("base.group_system"):
            vals.setdefault("status", "approved")
        elif user.has_group(MANAGER_GROUP):
            company = self.env["res.company"].browse(vals.get("company_id") or self.env.company.id)
            trusted = self.env["social.gallery.trusted.user"].sudo().search_count([
                ("company_id", "=", company.id),
                ("user_id", "=", user.id),
            ])
            if trusted and company.sg_auto_approve_trusted:
                vals.setdefault("status", "approved")
            else:
                vals["status"] = "pending"
        else:
            raise AccessError(_("Only supervisors and administrators can create albums."))
        return super().create(vals)

    def action_soft_delete(self):
        now = fields.Datetime.now()
        user = self.env.user
        for album in self:
            pending = album.media_ids.filtered(
                lambda m: m.approval_status == "pending" and not m.deleted_at
            )
            pending.write({"album_id": False})
            media = album.media_ids.filtered(lambda m: not m.deleted_at)
            media.write({
                "deleted_at": now,
                "deleted_by": user.id,
                "deleted_with_album_id": album.id,
            })
            album.write({
                "deleted_at": now,
                "deleted_by": user.id,
                "active": False,
            })

    def action_restore(self):
        for album in self:
            album.write({"deleted_at": False, "deleted_by": False, "active": True})
            linked = self.env["social.gallery.media"].search([
                ("deleted_with_album_id", "=", album.id),
                ("deleted_at", "!=", False),
            ])
            linked.write({
                "deleted_at": False,
                "deleted_by": False,
                "deleted_with_album_id": False,
            })

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
