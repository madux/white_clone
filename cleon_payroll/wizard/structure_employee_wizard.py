from odoo import api, fields, models, _
from odoo.exceptions import UserError


class CleonStructureEmployeeWizard(models.TransientModel):
    _name = "cleon.structure.employee.wizard"
    _description = "Add Employees to Payroll Structure Wizard"

    structure_id = fields.Many2one(
        "cleon.payroll.structure",
        string="Payroll Structure",
        required=True,
        readonly=True,
    )

    employee_ids = fields.Many2many(
        "hr.employee",
        string="Employees",
        required=True,
    )

    approver_user_id = fields.Many2one(
        "res.users",
        string="Send To for Approval",
        required=True,
        domain=[("share", "=", False)],
    )

    def remove_ineligible_employees(self):
        self.ensure_one()

        if self.structure_id.grade_ids:
            self.employee_ids = self.employee_ids.filtered(
                lambda employee: employee.grade_id
                and employee.grade_id in self.structure_id.grade_ids
            )
        return {
                "type": "ir.actions.act_window",
                "res_model": "cleon.structure.employee.wizard",
                "name": "Employee structure approval",
                "view_mode": "form",
                "target": "new",
                "res_id": self.id, 
                # "context": {
                #     "default_grade_id": self.grade_id.id,
                #     "default_amount": 0,
                #     "default_ai_prompt": prompt,
                #     "default_ai_response": formatted_text,
                # },
            }

    def action_send_for_approval(self):
        self.ensure_one()

        if not self.employee_ids:
            raise UserError(_("Please select at least one employee."))

        if not self.approver_user_id:
            raise UserError(_("Please select an approver."))

        if not self.approver_user_id.email:
            raise UserError(
                _("The selected approver does not have an email address.")
            )

        if self.structure_id.grade_ids:
            employee_not_in_grade = self.employee_ids.filtered(
                            lambda grade: grade.grade_id.id not in self.structure_id.grade_ids.ids
                        )
        
                
            # A missing contract prevents approval.
            if employee_not_in_grade:
                
                raise UserError(
                    _("The following employees are not in grades eligible for this structure. Kindly remove them first, or add them to the grades or remove the eligible grades lines to set it global:\n%s")
                    % "\n".join(employee_not_in_grade.mapped("name"))
                )

        approval = self.env["cleon.structure.approval"].create({
            "structure_id": self.structure_id.id,
            "employee_ids": [(6, 0, self.employee_ids.ids)],
            "approver_user_id": self.approver_user_id.id,
            "requested_by": self.env.user.id,
        })

        approval.message_post(
            body=_(
                "Approval request submitted by %s for %s employee(s)."
            ) % (
                self.env.user.name,
                len(self.employee_ids),
            ),
            message_type="comment",
            subtype_xmlid="mail.mt_note",
        )

        template = self.env.ref(
            "cleon_payroll.mail_template_structure_approval_request",
            raise_if_not_found=False,
        )

        if template:
            template.send_mail(approval.id, force_send=True)

        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Approval Request"),
                "message": _(
                    "The request has been sent to %s."
                ) % self.approver_user_id.name,
                "type": "success",
                "sticky": False,
                "next": {
                    "type": "ir.actions.act_window_close",
                },
            },
        }