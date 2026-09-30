# -*- coding: utf-8 -*-
from odoo import _, fields, models


class DocFolderLockAudit(models.Model):
    _name = "doc.folder.lock.audit"
    _description = "Folder lock and unlock audit"
    _order = "occurred_at desc, id desc"

    folder_id = fields.Many2one(
        "doc.folder",
        required=True,
        ondelete="cascade",
        index=True,
    )
    action = fields.Selection(
        [("lock", "Lock"), ("unlock", "Unlock")],
        required=True,
        index=True,
    )
    actor_id = fields.Many2one(
        "res.users",
        required=True,
        default=lambda self: self.env.user,
        index=True,
    )
    occurred_at = fields.Datetime(
        required=True,
        default=fields.Datetime.now,
        index=True,
    )

    def serialize_for_activity(self):
        self.ensure_one()
        folder = self.folder_id
        locked = self.action == "lock"
        return {
            "id": self.id,
            "kind": "folder_lock" if locked else "folder_unlock",
            "message": (
                _("%(actor)s locked %(folder)s")
                if locked
                else _("%(actor)s unlocked %(folder)s")
            )
            % {
                "actor": self.actor_id.name or _("Someone"),
                "folder": folder.folder_name,
            },
            "document_id": 0,
            "document_name": "",
            "folder_id": folder.id,
            "folder_name": folder.folder_name,
            "folder_type": folder.folder_type,
            "employee_id": False,
            "actor_name": self.actor_id.name or _("Someone"),
            "occurred_at": fields.Datetime.to_string(self.occurred_at),
        }
