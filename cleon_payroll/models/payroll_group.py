
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class ResCompany(models.Model):
    _inherit = "res.company"

    cleon_payroll_template_id = fields.Many2one(
            'cleon.payroll.template', 
            string='Payroll template'
        )

class CleonPayrollGroup(models.Model):
    _name = "cleon.payroll.group"
    _description = "Cleon Payroll Group"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "company_id, name"

    name = fields.Char(
        required=True,
        tracking=True,
    )
    code = fields.Char(
        required=True,
        tracking=True,
    )
    active = fields.Boolean(
        default=True,
        tracking=True,
    )

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
        tracking=True,
    )

    structure_id = fields.Many2one(
        "cleon.payroll.structure",
        string="Payroll Structure",
        required=True,
        domain="[('company_id', 'in', [False, company_id])]",
        tracking=True,
        ondelete="restrict",
    )

    schedule_pay = fields.Selection(
        related="structure_id.schedule_pay",
        string="Pay Frequency",
        store=True,
        readonly=True,
    )

    contract_ids = fields.One2many(
        "hr.contract",
        "payroll_group_id",
        string="Employment Contracts",
    )

    contract_count = fields.Integer(
        compute="_compute_contract_count",
    )
    show_payroll_link = fields.Boolean(
                    string="Payroll menu Link",
                    default=True,
                    help="Used to hold widget in form view"
                )

    note = fields.Text()

    _sql_constraints = [
        (
            "code_company_uniq",
            "unique(code, company_id)",
            "Payroll group code must be unique per company.",
        ),
    ]

    @api.depends("contract_ids")
    def _compute_contract_count(self):
        for group in self:
            group.contract_count = len(group.contract_ids)

    @api.constrains("company_id", "structure_id")
    def _check_structure_company(self):
        for group in self:
            if (
                group.structure_id.company_id
                and group.structure_id.company_id != group.company_id
            ):
                raise ValidationError(_(
                    "The payroll structure must belong to the "
                    "same company as the payroll group, or be shared."
                ))
