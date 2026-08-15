from odoo import api, fields, models
from odoo.exceptions import ValidationError


class HrClaimType(models.Model):
    _name = "hr.claim.type"
    _description = "Claim Type"
    _order = "category_id, sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    category_id = fields.Many2one(
        "hr.claim.category", required=True, ondelete="restrict", check_company=True
    )
    description = fields.Text(translate=True)
    internal_notes = fields.Text(groups="hr_claims.group_hr_claim_admin")
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    amount_type = fields.Selection(
        [("fixed", "Fixed Claim"), ("open", "Open Claim")],
        required=True,
        default="open",
    )
    fixed_amount = fields.Monetary(currency_field="currency_id")
    minimum_amount = fields.Monetary(currency_field="currency_id")
    maximum_amount = fields.Monetary(currency_field="currency_id")
    maximum_per_claim = fields.Monetary(currency_field="currency_id")
    currency_id = fields.Many2one(
        related="company_id.currency_id", store=True, readonly=True
    )

    reimbursable = fields.Boolean(default=True)
    payment_method = fields.Selection(
        [
            ("bank", "Bank Transfer"),
            ("payroll", "Via Payroll"),
            ("cheque", "Cheque"),
            ("card", "Expense Card Top-up"),
            ("cash", "Cash Payment"),
        ],
        default="bank",
        required=True,
    )
    eligibility = fields.Selection(
        [("all", "All Employees"), ("restricted", "Specific Employees/Departments")],
        required=True,
        default="all",
    )
    employee_ids = fields.Many2many(
        "hr.employee",
        "hr_claim_type_employee_rel",
        "claim_type_id",
        "employee_id",
        check_company=True,
    )
    department_ids = fields.Many2many(
        "hr.department",
        "hr_claim_type_department_rel",
        "claim_type_id",
        "department_id",
        check_company=True,
    )
    receipt_policy = fields.Selection(
        [
            ("required", "Always Required"),
            ("conditional", "Required Above Threshold"),
            ("optional", "Optional"),
            ("none", "Not Applicable"),
        ],
        required=True,
        default="optional",
    )
    receipt_threshold = fields.Monetary(
        currency_field="currency_id", default=10000.0
    )
    approval_type = fields.Selection(
        [
            ("single", "Single-Level Approval"),
            ("sequential", "Multi-Level Sequential"),
            ("parallel", "Multi-Level Parallel"),
            ("conditional", "Conditional/Amount-Based"),
        ],
        required=True,
        default="single",
    )
    gl_account_code = fields.Char(string="GL Account Code")
    submission_window_days = fields.Integer(default=30)
    window_ids = fields.Many2many(
        "hr.claim.window",
        "hr_claim_type_window_rel",
        "claim_type_id",
        "window_id",
        check_company=True,
    )

    _sql_constraints = [
        (
            "code_company_unique",
            "unique(code, company_id)",
            "The claim type code must be unique per company.",
        )
    ]

    @api.constrains(
        "fixed_amount",
        "minimum_amount",
        "maximum_amount",
        "maximum_per_claim",
        "receipt_threshold",
        "submission_window_days",
    )
    def _check_amounts(self):
        for claim_type in self:
            values = [
                claim_type.fixed_amount,
                claim_type.minimum_amount,
                claim_type.maximum_amount,
                claim_type.maximum_per_claim,
                claim_type.receipt_threshold,
            ]
            if any(value < 0 for value in values):
                raise ValidationError("Claim type amounts cannot be negative.")
            if claim_type.submission_window_days < 0:
                raise ValidationError("Submission window days cannot be negative.")
            if (
                claim_type.minimum_amount
                and claim_type.maximum_amount
                and claim_type.minimum_amount > claim_type.maximum_amount
            ):
                raise ValidationError("Minimum amount cannot exceed maximum amount.")
            if claim_type.amount_type == "fixed" and claim_type.fixed_amount <= 0:
                raise ValidationError("A fixed claim type requires a positive fixed amount.")

    def is_employee_eligible(self, employee):
        self.ensure_one()
        if self.eligibility == "all":
            return True
        return employee in self.employee_ids or employee.department_id in self.department_ids

