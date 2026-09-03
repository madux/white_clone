from odoo import fields, models, _
from odoo.exceptions import UserError


class DocumentApproval(models.Model):
    _name = "doc.document.approval"
    _description = "Document Approval"
    _order = "sequence, id"

    document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="cascade",
    )

    approver_id = fields.Many2one(
        "res.users",
        required=True,
    )

    sequence = fields.Integer(
        default=1,
    )

    state = fields.Selection(
        [
            ("waiting", "Waiting"),
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="waiting",
        required=True,
    )

    decision_date = fields.Datetime()

    comment = fields.Text()

    def action_approve(self):
        for approval in self:
            if approval.approver_id != self.env.user:
                raise UserError(_("You are not assigned to approve this document."))

            if approval.document_id.folder_id.approval_flow == "sequential":
                previous = self.search(
                    [
                        ("document_id", "=", approval.document_id.id),
                        ("sequence", "<", approval.sequence),
                        ("state", "!=", "approved"),
                    ],
                    limit=1,
                )
                if previous:
                    raise UserError(
                        _("Previous approval steps must be completed first.")
                    )

            approval.write(
                {
                    "state": "approved",
                    "decision_date": fields.Datetime.now(),
                }
            )

            approval.document_id._update_approval_state()

    def action_reject(self):
        for approval in self:
            if approval.approver_id != self.env.user:
                raise UserError(_("You are not assigned to reject this document."))

            approval.write(
                {
                    "state": "rejected",
                    "decision_date": fields.Datetime.now(),
                }
            )

            approval.document_id.write({"state": "rejected"})
