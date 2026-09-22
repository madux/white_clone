# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


SETUP_STAGES = [
    ("connect_ems", "Connecting to EMS"),
    ("read_employees", "Reading employees"),
    ("create_files", "Creating Employee Files"),
    ("organize_groups", "Organizing groups"),
    ("collect_documents", "Collecting existing documents"),
    ("finalize", "Finalizing"),
]


class DocEmployeeSetupRun(models.Model):
    _name = "doc.employee.setup.run"
    _description = "Employee Files setup run (EF-A5)"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("running", "Running"),
            ("done", "Done"),
            ("failed", "Failed"),
        ],
        default="draft",
    )
    config_snapshot = fields.Text()
    employees_found = fields.Integer(default=0)
    files_initialized = fields.Integer(default=0)
    files_fully_loaded = fields.Integer(default=0)
    documents_collected = fields.Integer(default=0)
    need_attention = fields.Integer(default=0)
    stage_ids = fields.One2many("doc.employee.setup.stage", "run_id")

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "state": self.state,
            "employees_found": self.employees_found,
            "files_initialized": self.files_initialized,
            "files_fully_loaded": self.files_fully_loaded,
            "documents_collected": self.documents_collected,
            "need_attention": self.need_attention,
            "stages": [stage.serialize_for_api() for stage in self.stage_ids],
        }


class DocEmployeeSetupStage(models.Model):
    _name = "doc.employee.setup.stage"
    _description = "Employee Files setup stage progress"
    _order = "sequence, id"

    run_id = fields.Many2one(
        "doc.employee.setup.run",
        required=True,
        ondelete="cascade",
    )
    sequence = fields.Integer(default=10)
    stage_key = fields.Selection(SETUP_STAGES, required=True)
    label = fields.Char(required=True)
    total_count = fields.Integer(default=0)
    done_count = fields.Integer(default=0)
    status = fields.Selection(
        [
            ("pending", "Pending"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
            ("failed", "Failed"),
        ],
        default="pending",
    )

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "stage_key": self.stage_key,
            "label": self.label,
            "total_count": self.total_count,
            "done_count": self.done_count,
            "status": self.status,
        }
