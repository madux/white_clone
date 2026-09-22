from odoo import api, fields, models

class HrExperienceVideoWatch(models.Model):
    _name = 'hr.experience.video.watch'
    _description = 'HR Experience Video Watch'
    _order = 'watched_at desc'
    _rec_name = "video_id"

    video_id = fields.Many2one(
        'hr.experience.video',
        string='Video',
        required=True,
        ondelete='cascade',
    )

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        ondelete='cascade',
    )

    watched = fields.Boolean(
        string='Watched',
        default=False,
    )

    watched_at = fields.Datetime(
        string='Watched At',
    )

    progress = fields.Float(
        string='Progress (%)',
        default=0,
    )

    duration_watched = fields.Float(
        string='Duration Watched (Minutes)',
    )

    # _sql_constraints = [
    #     (
    #         'unique_video_employee',
    #         'unique(video_id, employee_id)',
    #         'An employee can only have one watch record per video.'
    #     )
    # ]

    @api.model
    def mark_as_watched(self, video_id):
        employee = self.env['hr.employee'].search(
            [('user_id', '=', self.env.uid)],
            limit=1
        )

        if not employee:
            return False

        watch = self.search([
            ('video_id', '=', video_id),
            ('employee_id', '=', employee.id),
        ], limit=1)

        if not watch:
            watch = self.create({
                'video_id': video_id,
                'employee_id': employee.id,
            })

        watch.write({
            'watched': True,
            'watched_at': fields.Datetime.now(),
            'progress': 100,
        })

        return True

class HrExperienceVideo(models.Model):
    _name = 'hr.experience.video'
    _description = 'HR Experience Video'
    _order = 'sequence, id desc'

    name = fields.Char(
        string='Video Title',
        required=True,
    )

    description = fields.Html(
        string='Description',
    )

    video_url = fields.Char(
        string='Video URL',
    )

    video_file = fields.Binary(
        string='Video File',
        attachment=True,
    )

    thumbnail = fields.Binary(
        string='Thumbnail',
        attachment=True,
    )

    sequence = fields.Integer(
        string='Sequence',
        default=10,
    )

    active = fields.Boolean(
        default=True,
    )

    published = fields.Boolean(
        string='Published',
        default=True,
    )

    duration = fields.Float(
        string='Duration (Minutes)',
    )

    category = fields.Selection([
        ('training', 'Training'),
        ('onboarding', 'Onboarding'),
        ('company', 'Company'),
        ('hr', 'HR'),
        ('other', 'Other'),
    ], string='Category')

    watch_ids = fields.One2many(
        'hr.experience.video.watch',
        'video_id',
        string='Watch History',
    )

    total_watches = fields.Integer(
        string='Total Watches',
        compute='_compute_total_watches',
    )

    @api.depends('watch_ids.watched')
    def _compute_total_watches(self):
        for video in self:
            video.total_watches = len(
                video.watch_ids.filtered(lambda x: x.watched)
            )

    