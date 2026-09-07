from odoo import models, fields, api

class SdirEmployeeEvent(models.Model):
    _name = 'sdir.employee.event'
    _description = 'Staff Directory Employee Event'
    _order = 'event_date desc, id desc'

    employee_id = fields.Many2one('hr.employee', string="Employee", required=True, ondelete='cascade')
    event_date = fields.Date(string="Date", required=True, default=fields.Date.context_today)
    
    event_type = fields.Selection([
        ('hire', 'Hire'),
        ('promotion', 'Promotion'),
        ('transfer', 'Transfer'),
        ('performance_review', 'Performance Review'),
        ('anniversary', 'Work Anniversary'),
        ('other', 'Other')
    ], string="Event Type", required=True)
    
    title = fields.Char(string="Event Title", required=True)
    description = fields.Text(string="Description/Notes")
    
    # Specific to performance reviews
    score = fields.Integer(string="Score (0-100)")
    rating_badge = fields.Selection([
        ('exceptional', 'Exceptional'),
        ('exceeds', 'Exceeds Expectations'),
        ('meets', 'Meets Expectations'),
        ('needs_improvement', 'Needs Improvement')
    ], string="Rating")
