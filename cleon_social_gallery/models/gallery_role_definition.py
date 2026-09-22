# -*- coding: utf-8 -*-
from odoo import api, fields, models


class GalleryRoleDefinition(models.Model):
    _name = "gallery.role.definition"
    _description = "Social Gallery role definition"
    _order = "sequence, role_key"

    role_key = fields.Selection(
        selection=[
            ("user", "User"),
            ("manager", "Manager"),
            ("admin", "Administrator"),
        ],
        required=True,
        index=True,
    )
    group_id = fields.Many2one("res.groups", required=True, ondelete="restrict")
    group_xml_id = fields.Char(required=True, index=True)
    label = fields.Char(required=True)
    description = fields.Text()
    capabilities = fields.Text()
    sequence = fields.Integer(default=10)
    assignable = fields.Boolean(default=False)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "gallery_role_definition_role_unique",
            "unique(role_key)",
            "Each role can only be defined once.",
        ),
    ]

    @api.model
    def _registry_rows(self):
        return [
            {
                "role_key": "user",
                "group_xml_id": "cleon_social_gallery.group_social_gallery_user",
                "label": "Gallery User",
                "description": "Browse the gallery and manage personal contributions.",
                "capabilities": "Browse gallery · personal contributions",
                "sequence": 10,
                "assignable": False,
            },
            {
                "role_key": "manager",
                "group_xml_id": "cleon_social_gallery.group_social_gallery_manager",
                "label": "Gallery Manager",
                "description": "Moderate content, review pending posts, and manage flagged media.",
                "capabilities": "Pending review · flagged content · recycle bin · audit",
                "sequence": 20,
                "assignable": True,
            },
            {
                "role_key": "admin",
                "group_xml_id": "cleon_social_gallery.group_social_gallery_admin",
                "label": "Gallery Administrator",
                "description": "Gallery settings and trusted user management.",
                "capabilities": "Gallery settings · trusted users",
                "sequence": 30,
                "assignable": True,
            },
        ]

    @api.model
    def sync_registry(self):
        for row in self._registry_rows():
            group = self.env.ref(row["group_xml_id"], raise_if_not_found=False)
            if not group:
                continue
            existing = self.search([("role_key", "=", row["role_key"])], limit=1)
            values = {
                "group_id": group.id,
                "group_xml_id": row["group_xml_id"],
                "label": row["label"],
                "description": row.get("description") or "",
                "capabilities": row.get("capabilities") or "",
                "sequence": row.get("sequence", 10),
                "assignable": row.get("assignable", False),
                "active": True,
            }
            if existing:
                existing.write(values)
            else:
                self.create({"role_key": row["role_key"], **values})
