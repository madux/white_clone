from odoo import models, fields, api


class HrReportingStructure(models.Model):
    _name = "hr.reporting.structure"
    _description = "HR Reporting Structure"
    _rec_name = "job_id"

    job_id = fields.Many2one(
        "hr.job",
        string="Job Position",
        required=True,
        ondelete="cascade",
    )

    parent_job_id = fields.Many2one(
        "hr.job",
        string="Reports To",
    )

    # child_job_ids = fields.One2many(
    #     "hr.reporting.structure",
    #     "parent_job_id",
    #     string="Subordinates",
    # )

    department_id = fields.Many2one(
        "hr.department",
        string="Department",
        related="job_id.department_id",
        store=True,
        readonly=True,
    )

    level_id = fields.Many2one(
        "hr.level",
        string="Level",
    )
    # @api.onchange('job_id')
    # def onchange_job_id(self):
    #     self.ensure_one()
    #     for rec in self:
    #         if rec.job_id:
    #             rec.department_id = rec.job_id.department_id

    employee_ids = fields.Many2many(
        "hr.employee",
        string="Employees",
        compute="_compute_employees",
        store=True,
    )

    size = fields.Integer(
        string="Total Employees",
        compute="_compute_size",
        store=True,
    )

    level = fields.Integer(
        string="Hierarchy Level",
        # compute="_compute_level",
        store=True,
    )

    # ---------------------------
    # COMPUTES
    # ---------------------------

    @api.depends("job_id")
    def _compute_employees(self):
        for rec in self:
            rec.employee_ids = self.env["hr.employee"].search([
                ("job_id", "=", rec.job_id.id)
            ]) if rec.job_id else False

    @api.depends("employee_ids")
    def _compute_size(self):
        for rec in self:
            rec.size = len(rec.employee_ids)

    # @api.depends("parent_job_id")
    # def _compute_level(self):
    #     for rec in self:
    #         rec.level = rec._get_level()

    # def _get_level(self):
    #     """Recursive level calculation"""
    #     level = 0
    #     current = self.parent_job_id

    #     while current:
    #         level += 1
    #         parent = self.env["hr.reporting.structure"].search([
    #             ("job_id", "=", current.id)
    #         ], limit=1)

    #         current = parent.parent_job_id if parent else False
    #     return level