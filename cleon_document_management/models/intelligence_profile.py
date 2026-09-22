from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError


FIELD_TYPES = [
    ("text", "Text"),
    ("long_text", "Long text"),
    ("integer", "Integer"),
    ("decimal", "Decimal"),
    ("currency", "Currency"),
    ("boolean", "Boolean"),
    ("date", "Date"),
    ("datetime", "Datetime"),
    ("email", "Email"),
    ("phone", "Phone"),
    ("enum", "Enum"),
    ("multi_enum", "Multi enum"),
    ("employee_reference", "Employee"),
    ("document_reference", "Document"),
]


class IntelligenceProfile(models.Model):
    _name = "doc.intelligence.profile"
    _description = "Document Intelligence Extraction Profile"
    _order = "name"

    name = fields.Char(required=True)
    document_type_id = fields.Many2one(
        "doc.document.type",
        required=True,
        ondelete="cascade",
    )
    is_system = fields.Boolean(default=False)
    active = fields.Boolean(default=True)
    current_version_id = fields.Many2one(
        "doc.intelligence.profile.version",
        string="Active Version",
        ondelete="set null",
    )
    version_ids = fields.One2many(
        "doc.intelligence.profile.version",
        "profile_id",
        string="Versions",
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
    )

    def action_archive(self):
        self.write({"active": False})

    def write(self, vals):
        result = super().write(vals)
        if "active" not in vals:
            return result
        for profile in self:
            document_type = profile.document_type_id
            if not document_type:
                continue
            default = document_type.with_context(active_test=False).default_profile_id
            if not profile.active:
                if default == profile:
                    replacement = self.search(
                        [
                            ("document_type_id", "=", document_type.id),
                            ("active", "=", True),
                            ("id", "!=", profile.id),
                        ],
                        limit=1,
                    )
                    document_type.default_profile_id = (
                        replacement.id if replacement else False
                    )
            elif not default:
                document_type.default_profile_id = profile.id
        return result

    def unlink(self):
        if self.env.context.get("allow_profile_unlink"):
            return super().unlink()
        raise UserError(
            _(
                "Profiles cannot be deleted. Archive them so historical "
                "datasets keep their version."
            )
        )

    @api.model_create_multi
    def create(self, vals_list):
        profiles = super().create(vals_list)
        if self.env.context.get("skip_default_version"):
            return profiles
        for profile in profiles:
            if not profile.current_version_id:
                version = self.env["doc.intelligence.profile.version"].create(
                    {
                        "profile_id": profile.id,
                        "version": 1,
                        "extraction_instructions": "",
                    }
                )
                profile.current_version_id = version.id
        return profiles

    @api.model
    def _seed_default_profiles(self):
        """No-op: document types and intelligence profiles are created in Settings."""
        return

    def action_new_version(self):
        self.ensure_one()
        current = self.current_version_id
        next_number = max(self.version_ids.mapped("version") or [0]) + 1
        version = self.env["doc.intelligence.profile.version"].create(
            {
                "profile_id": self.id,
                "version": next_number,
                "extraction_instructions": current.extraction_instructions
                if current
                else "",
                "examples": current.examples if current else "",
            }
        )
        if current:
            for field in current.field_ids:
                field.copy({"version_id": version.id})
        self.current_version_id = version.id
        return version


class IntelligenceProfileVersion(models.Model):
    _name = "doc.intelligence.profile.version"
    _description = "Extraction Profile Version"
    _order = "version desc"

    profile_id = fields.Many2one(
        "doc.intelligence.profile",
        required=True,
        ondelete="cascade",
    )
    version = fields.Integer(required=True, default=1)
    extraction_instructions = fields.Text()
    examples = fields.Text()
    field_ids = fields.One2many(
        "doc.intelligence.field",
        "version_id",
        string="Fields",
    )

    _sql_constraints = [
        (
            "profile_version_unique",
            "unique(profile_id, version)",
            "Profile version numbers must be unique.",
        )
    ]


class IntelligenceField(models.Model):
    _name = "doc.intelligence.field"
    _description = "Extraction Field Definition"
    _order = "sequence, id"

    version_id = fields.Many2one(
        "doc.intelligence.profile.version",
        required=True,
        ondelete="cascade",
    )
    sequence = fields.Integer(default=10)
    name = fields.Char(required=True)
    key = fields.Char(required=True)
    field_type = fields.Selection(FIELD_TYPES, required=True, default="text")
    required = fields.Boolean(default=False)
    description = fields.Text()
    example = fields.Char()
    validation_json = fields.Text(
        help="Optional JSON for enum values or extra checks.",
    )

    @api.constrains("key")
    def _check_key(self):
        for field in self:
            if not field.key or " " in field.key:
                raise ValidationError(_("Field keys must be a single token."))
