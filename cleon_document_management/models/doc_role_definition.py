# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocRoleDefinition(models.Model):
    _name = "doc.role.definition"
    _description = "Document Management role definition"
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
    assignable = fields.Boolean(
        default=False,
        help="Only manager and administrator roles can be assigned from the UI.",
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "doc_role_definition_role_unique",
            "unique(role_key)",
            "Each role can only be defined once.",
        ),
    ]

    @api.model
    def _registry_rows(self):
        return [
            {
                "role_key": "user",
                "group_xml_id": "cleon_document_management.group_document_user",
                "label": "Document User",
                "description": "Personal workspace, own documents, and assigned folder access.",
                "capabilities": "My Documents · Quick Access · own profile documents",
                "sequence": 10,
                "assignable": False,
            },
            {
                "role_key": "manager",
                "group_xml_id": "cleon_document_management.group_document_manager",
                "label": "Document Manager",
                "description": "Manage employee and organizational folders, approvals, and compliance.",
                "capabilities": "Employee/org folders · Pending uploads · Compliance · Activity",
                "sequence": 20,
                "assignable": True,
            },
            {
                "role_key": "admin",
                "group_xml_id": "cleon_document_management.group_document_admin",
                "label": "Document Administrator",
                "description": "Full document management configuration and intelligence settings.",
                "capabilities": "Settings · Document Intelligence · global admin actions",
                "sequence": 30,
                "assignable": True,
            },
        ]

    @api.model
    def _registry_role_keys(self):
        return [row["role_key"] for row in self._registry_rows()]

    @api.model
    def _document_management_definitions(self):
        self.sync_registry()
        return self.search(
            [
                ("active", "=", True),
                ("role_key", "in", self._registry_role_keys()),
                ("group_xml_id", "like", "cleon_document_management.%"),
            ],
            order="sequence, role_key",
        )

    @api.model
    def sync_registry(self):
        valid_keys = set(self._registry_role_keys())
        valid_xml_ids = {row["group_xml_id"] for row in self._registry_rows()}

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

        stale = self.search(
            [
                "|",
                ("role_key", "not in", list(valid_keys)),
                ("group_xml_id", "not in", list(valid_xml_ids)),
            ]
        )
        if stale:
            stale.write({"active": False})
