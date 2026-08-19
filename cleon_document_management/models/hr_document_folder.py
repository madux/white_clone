from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta


'''
{
Document folder [doc.folder]--> (has list of documents that can be arranged 
by department, employee, roles, company
), department, employee_ids, owner_id, 
active, template_ids--> hr_document_template ()

Audit control --> [cleon.audit.control]
complaince_checklist_ids --> [hr_document_checklist]
hr_document.storage_management
}
'''

class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

class DocumentTemplate(models.Model):
    _name = 'hr_document_template'
    
    name = fields.Char("Folder name", required=True, default="New")
    active = fields.Boolean(default=True)


class DocumentComplaince(models.Model):
    _name = 'hr_document_checklist'

    name = fields.Char("Folder name", required=True, default="New")
    active = fields.Boolean(default=True)
 

class Documentfolder(models.Model):
    _name = 'doc.folder' # model_doc.folder
    _rec_name = 'folder_name'
    _description = "HR DOCUMENT FOLDER"

    folder_name = fields.Char("Folder name", required=True, default="New")
    description = fields.Text(string="Short description", required=True, default="New")
    active = fields.Boolean(default=True)
    parent_id = fields.Many2one(
        'doc.folder',
        string="Department"
        )
    folder_type = fields.Selection([
        ('organizational', 'Organizational'), 
        ('employee', 'Employee'),
        ('system', 'Template'),
        ('system', 'System'),
        ('others', 'Others'),
        ])
    department_ids = fields.Many2many(
        'hr.department',
        string="Department", 
        help="Departments allowed to access this folder",

        )
    document_ids = fields.One2many(
        'doc.document',
        'folder_id',
        string="Documents", 
        )
    employee_id = fields.Many2one(
        'hr.employee',
        string="Employee"
        )
    locked_by = fields.Many2one(
        'res.users',
        string="Locked by", 
        readonly="1"
    )

    owner_id = fields.Many2one(
        'res.users',
        string="Owner",
        default=lambda self: self.env.user.id,
        )
    date_of_entry = fields.Date(
        string="Date of Entry"
        )
    date_of_submission = fields.Date(
        string="Submission Date"
        )
    
    number_of_views = fields.Integer(
        string="No of Views"
        )
    
    document_count = fields.Integer(
        string='Documents',
        compute='_compute_document_count',
        store=True
    )
    
    @api.depends('document_ids')
    def _compute_document_count(self):
        counts = self.env['doc.document'].read_group(
            [('folder_id', 'in', self.ids)],
            ['folder_id'],
            ['folder_id']
        )

        mapped_counts = {
            record['folder_id'][0]: record['folder_id_count']
            for record in counts
        }

        for folder in self:
            folder.document_count = mapped_counts.get(folder.id, 0)

    is_locked = fields.Boolean(
        string="is locked", 
        help="Prevents upload/delete/edit when true "
        )
    allowed_group_ids = fields.Many2many(
        'res.groups',
        string="Roles", help="Roles allowed to access"
        )
    complaince_checklist_ids = fields.Many2many(
        'hr_document_checklist',
        string="Roles"
        )
    template_ids = fields.Many2many(
        'hr_document_template',
        string="Roles"
        )
    state = fields.Selection([
        ('draft', 'Draft'), 
        ('Waiting Approved', 'Waiting Approval'),
        ('Approved', 'Approved'),
        ])
    
    def button_lock(self):
        self.is_locked = True 
        self.locked_by = self.env.user.id 

    def button_submit_for_approval(self):
        '''Once a user clicks, it moves to the next state -- hides when state != draft'''
        for record in self:
            record.state = 'Waiting Approved'

    def button_to_approve(self):
        '''Once a user clicks, it moves to the next state -- hides when state != Waiting Approved'''
        for record in self:
            record.state = 'Waiting Approved'

    def button_confirm_approved(self):
        '''Once a user clicks, it moves to the next state -- hides when state != Waiting Approved'''
        for record in self:
            record.state = 'Approved'

    def button_reject(self):
        '''Once a user clicks, it moves to the next state -- hides when state != Waiting Approved'''
        for record in self:
            if record.state in ['Waiting Approved']:
                record.state = 'draft'
            elif record.state in ['Approved']:
                record.state = 'Waiting Approved'
            else:
                record.state = 'draft'
    
    