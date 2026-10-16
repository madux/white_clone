from odoo import api, fields, models, _
from odoo.exceptions import UserError


class CleonStructureApproval(models.Model):
    _name = "cleon.structure.approval"
    _description = "Payroll Structure Approval"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "id desc"

    name = fields.Char(
        string="Reference",
        required=True,
        copy=False,
        readonly=True,
        default="New",
        tracking=True,
    )

    structure_id = fields.Many2one(
        "cleon.payroll.structure",
        string="Payroll Structure",
        required=True,
        readonly=True,
        tracking=True,
    )

    employee_ids = fields.Many2many(
        "hr.employee",
        string="Requested Employees",
        readonly=True,
        copy=False,
    )

    approver_user_id = fields.Many2one(
        "res.users",
        string="Approver",
        required=True,
        readonly=True,
        tracking=True,
    )

    requested_by = fields.Many2one(
        "res.users",
        string="Requested By",
        required=True,
        readonly=True,
        default=lambda self: self.env.user,
    )
    show_payroll_link = fields.Boolean(
                        string="Payroll menu Link",
                        default=True,
                        help="Used to hold widget in form view"
                    )

    state = fields.Selection(
        [
            ("pending", "Pending Approval"),
            ("approved", "Approved"),
            ("refused", "Refused"),
        ],
        string="Status",
        default="pending",
        required=True,
        tracking=True,
        copy=False,
    )

    refusal_reason = fields.Text(
        string="Reason for Refusal",
        tracking=True,
    )

    warning_message = fields.Text(
        string="Validation Warnings",
        readonly=True,
        copy=False,
    )

    contract_ids = fields.Many2many(
        "hr.contract",
        string="Employee Contracts",
        readonly=True,
        copy=False,
    )

    def action_approve(self):
        self.ensure_one()

        if self.env.user != self.approver_user_id and not self.env.user.has_group("base.group_system"):
            raise UserError(
                _("Only the assigned approver or a system administrator can approve this request.")
            )

        if self.state != "pending":
            raise UserError(_("This request has already been processed."))

        if not self.employee_ids:
            raise UserError(_("There are no employees to approve."))

        Employee = self.env["hr.employee"]
        Contract = self.env["hr.contract"]

        # Find contracts belonging to the selected employees.
        contracts = Contract.search([
            ("employee_id", "in", self.employee_ids.ids),
        ])
        # if you want opened contracts
        # contracts = Contract.search([
        #     ("employee_id", "in", self.employee_ids.ids),
        #     ("state", "=", "open"),
        # ])

        contracted_employee_ids = set(contracts.mapped("employee_id").ids)

        missing_employees = self.employee_ids.filtered(
            lambda employee: employee.id not in contracted_employee_ids
        )

        # A missing contract prevents approval.
        if missing_employees:
            raise UserError(
                _("The following employees do not have a contract:\n%s")
                % "\n".join(missing_employees.mapped("name"))
            )

        # Check whether any employee is already assigned to another structure.
        other_structures = self.env["cleon.payroll.structure"].search([
            ("id", "!=", self.structure_id.id),
            ("hr_employees_ids", "in", self.employee_ids.ids),
        ])

        warnings = []

        for employee in self.employee_ids:
            conflicting_structures = other_structures.filtered(
                lambda structure: employee in structure.hr_employees_ids
            )

            if conflicting_structures:
                warnings.append(
                    _("%s is already assigned to: %s")
                    % (
                        employee.name,
                        ", ".join(conflicting_structures.mapped("name")),
                    )
                )

        warning_text = "\n".join(warnings)

        # Append the selected employees to existing assignments.
        combined_employee_ids = (
            self.structure_id.hr_employees_ids | self.employee_ids
        )

        combined_contract_ids = (
            self.structure_id.contract_ids | contracts
        )

        self.structure_id.write({
            "hr_employees_ids": [
                (6, 0, combined_employee_ids.ids)
            ],
            "contract_ids": [
                (6, 0, combined_contract_ids.ids)
            ],
        })

        for rec in self.structure_id.hr_employees_ids:
            '''updated all the employee contract structure'''
            rec.contract_id.cleon_structure_id = self.structure_id.id

        # Approve the request and retain any warnings.
        self.write({
            "state": "approved",
            "contract_ids": [(6, 0, contracts.ids)],
            "warning_message": warning_text,
        })

        self.message_post(
            body=_("Approval completed successfully."),
            message_type="comment",
            subtype_xmlid="mail.mt_note",
        )

        if warning_text:
            self.message_post(
                body=_(
                    "<p><strong>Warning: Existing payroll structure assignments</strong></p><pre>%s</pre>"
                ) % warning_text,
                message_type="comment",
                subtype_xmlid="mail.mt_note",
            )

        self._notify_requester()

        if warning_text:
            return {
                "type": "ir.actions.client",
                "tag": "display_notification",
                "params": {
                    "title": _("Approved with Warnings"),
                    "message": _(
                        "The request was approved, but some employees "
                        "already belong to another payroll structure. "
                        "Review the chatter for details."
                    ),
                    "type": "warning",
                    "sticky": True,
                },
            }

        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Approved"),
                "message": _("Employees and contracts have been assigned."),
                "type": "success",
                "sticky": False,
            },
        }

    def action_refuse(self):
        self.ensure_one()

        if self.env.user != self.approver_user_id and not self.env.user.has_group(
            "base.group_system"
        ):
            raise UserError(
                _("Only the assigned approver or a system administrator can refuse this request.")
            )

        if self.state != "pending":
            raise UserError(_("This request has already been processed."))

        self.write({
            "state": "refused",
        })

        self.message_post(
            body=_("The approval request was refused by %s.") % self.env.user.name,
            message_type="comment",
            subtype_xmlid="mail.mt_note",
        )

        self._notify_requester()

        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Request Refused"),
                "message": _("The requester has been notified."),
                "type": "warning",
                "sticky": False,
            },
        }

    def _notify_requester(self):
        self.ensure_one()

        template = self.env.ref(
            "cleon_payroll.mail_template_structure_approval_result",
            raise_if_not_found=False,
        )

        if template and self.requested_by.email:
            template.send_mail(self.id, force_send=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = (
                    self.env["ir.sequence"].next_by_code(
                        "cleon.structure.approval"
                    ) or "New"
                )
        return super().create(vals_list)