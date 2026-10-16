from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError
from datetime import datetime


class HrPayrollTemplate(models.Model):
    _name = "cleon.payroll.template"
    _description = "Payroll Template"

    @api.constrains('payroll_structure_ids')
    def _check_payroll_structure_template(self):
        for template in self:
            if not template.payroll_structure_ids:
                continue

            other_templates = self.search([
                ('id', '!=', template.id),
                ('payroll_structure_ids', 'in',
                 template.payroll_structure_ids.ids),
            ])

            if len(other_templates.ids) > 1:
                conflicting_structures = (
                    template.payroll_structure_ids
                    & other_templates.mapped('payroll_structure_ids')
                )

                raise ValidationError(_(
                    "The following payroll structures already belong "
                    "to another payroll template:\n%s"
                ) % '\n'.join(conflicting_structures.mapped('name')))
            

    name = fields.Char(required=True)
    state = fields.Char()
    show_payroll_link = fields.Boolean(
        string="Payroll menu Link",
        default=True,
        help="Used to hold widget in form view"
    )

    payroll_structure_ids = fields.Many2many(
        "cleon.payroll.structure",
        required=False,
    )
    payroll_group_ids = fields.Many2many(
            "cleon.payroll.group",
            required=False,
        )
    active = fields.Boolean(default=True)
    code = fields.Char()
    company_id = fields.Many2one(
            "res.company", default=lambda self: self.env.company)
    country_id = fields.Many2one(
                "res.country")
    is_government_structure = fields.Boolean(
            string="Government Payroll Structure",
            default=False,
            help="""Identifies Nigerian public-sector payroll structures. \
        Updates the template with the country government structures"""
        )

    paygroup_count = fields.Integer(
        string="Pay Groups",
        compute="_compute_paygroup_count",
    )

    paygroup_employee_count = fields.Integer(
        string="Employees",
        compute="_compute_paygroup_count",
    )

    paygroup_structure_count = fields.Integer(
            string="Structures",
            compute="_compute_paygroup_count",
        )
    


    @api.depends(
        "payroll_group_ids",
        "payroll_structure_ids", 
        "payroll_group_ids.contract_ids",
        "payroll_group_ids.contract_ids.employee_id",
    )
    def _compute_paygroup_count(self):
        for record in self:
            groups = record.payroll_group_ids
            structures = record.payroll_structure_ids

            record.paygroup_count = len(groups)
            record.paygroup_structure_count = len(structures)

            employees = groups.mapped("contract_ids.employee_id")
            record.paygroup_employee_count = len(employees)

    def action_cancel_setup(self):
        pass
    def action_next_members(self):
        pass
 


    def update_government_structures(self):
        """Update the template with government payroll structures."""
        self.ensure_one()

        if not self.is_government_structure:
            raise ValidationError(
                _("Ensure that Is Government Structure is checked.")
            )

        if not self.country_id:
            raise ValidationError(_("Please select a country first."))

        # Find government payroll structures for the selected country.
        structures = self.env['cleon.payroll.structure'].search([
            ('is_government_structure', '=', True),
            ('country_id', '=', self.country_id.id),
        ])

        if not structures:
            raise ValidationError(
                _(
                    "No government payroll structures were found for %s."
                ) % self.country_id.name
            )

        # Replace the template's Many2many records.
        self.write({
            'payroll_structure_ids': [(6, 0, structures.ids)],
        })

        # Verify the records were assigned.
        self.invalidate_recordset(['payroll_structure_ids'])

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Government Payroll Structures Updated'),
                'message': _(
                    '%s payroll structures assigned for %s.'
                ) % (
                    len(self.payroll_structure_ids),
                    self.country_id.name,
                ),
                'type': 'success',
                'sticky': False,
            },
        }


    def button_activate_government_structures(self):
        self.ensure_one()
        return self.update_government_structures()
    
     