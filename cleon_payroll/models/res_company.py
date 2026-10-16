from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    is_government_organization = fields.Boolean(
        string="Government Organization",
        help="Use Nigerian public-sector payroll configuration."
    )
    show_payroll_link = fields.Boolean(
                    string="Payroll menu Link",
                    default=True,
                    help="Used to hold widget in form view"
                )
    # cleon_payroll_template_id = fields.Many2one(
    #     'cleon.payroll.template', 
    #     string='Payroll template'
    # )

    def action_configure_payroll_type(self):
        for company in self:
            structures = self.env["cleon.payroll.structure"].sudo().search([
                ("company_id", "=", company.id),
            ])

            if company.is_government_organization:
                government_structures = structures.filtered(
                    lambda s: s.is_government_structure
                )
                other_structures = structures - government_structures

                government_structures.write({"active": True})
                other_structures.write({"active": False})

                government_rules = self.env["cleon.payroll.rule"].sudo().search([
                    ("company_id", "=", company.id),
                    ("is_government_rule", "=", True),
                ])
                government_rules.write({"active": True})

                other_rules = self.env["cleon.payroll.rule"].sudo().search([
                    ("company_id", "=", company.id),
                    ("is_government_rule", "=", False),
                ])
                other_rules.write({"active": False})

            else:
                government_structures = structures.filtered(
                    lambda s: s.is_government_structure
                )
                government_structures.write({"active": False})

                other_structures = structures - government_structures
                other_structures.write({"active": True})

                self.env["cleon.payroll.rule"].sudo().search([
                    ("company_id", "=", company.id),
                    ("is_government_rule", "=", True),
                ]).write({"active": False})
