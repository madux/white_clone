from odoo import fields, models


class DocumentType(models.Model):
    _name = "doc.document.type"
    _description = "Document Category"
    _rec_name = "name"
    _order = "sequence, name"

    name = fields.Char(
        string="Category Name",
        required=True,
    )

    sequence = fields.Integer(
        default=10,
    )

    category = fields.Selection(
        [
            ("hr", "Human Resources"),
            ("finance", "Finance"),
            ("legal", "Legal"),
            ("identity", "Identity"),
            ("employment", "Employment"),
            ("medical", "Medical"),
            ("training", "Training"),
            ("other", "Other"),
        ],
        string="Category Group",
        default="other",
        required=True,
    )

    description = fields.Text()

    is_mandatory_default = fields.Boolean(
        string="Mandatory By Default",
        default=False,
    )

    default_retention_years = fields.Integer(
        default=7,
    )

    active = fields.Boolean(
        default=True,
    )

    folder_ids = fields.Many2many(
        "doc.folder",
        "doc_folder_document_type_rel",
        "document_type_id",
        "folder_id",
        string="Allowed Folders",
    )

    intelligence_scope = fields.Selection(
        [
            ("employee", "Employee"),
            ("organization", "Organization"),
        ],
        string="Intelligence Scope",
        default="employee",
    )
    classification_labels = fields.Text(
        string="Classification Labels",
        help="Example phrases used to classify this document type.",
    )
    default_profile_id = fields.Many2one(
        "doc.intelligence.profile",
        string="Default Extraction Profile",
        ondelete="set null",
    )
