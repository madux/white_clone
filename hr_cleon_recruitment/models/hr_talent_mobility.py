from odoo import api, fields, models
import re
from collections import defaultdict
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)

class HrTalentMobilityMatchSkill(models.Model):
    _name = "hr.mobility.match.skill"
    _description = "Talent Mobility Match Line"

    name = fields.Char()


class HrTalentMobilityJobMatch(models.Model):
    _name = "hr.talent.mobility.jobmatch"
    _description = "Talent Mobility JobMatch"
    _order = "id desc"

    job_id = fields.Many2one("hr.job", string="Ready For")
    mobility_id = fields.Many2one("hr.talent.mobility", string="Mobility")
    job_category = fields.Char(string="Job category")
    total_matching_mobility = fields.Float(string='Total matched Mobility', compute="compute_total_mobility")
    mobility_jobmatch_ids = fields.Many2many(
        "hr.talent.mobility.match", 
        "job_mobility_id", 
        string="Job Matches"
        )
    
    @api.depends("mobility_jobmatch_ids")
    def compute_total_mobility(self):
        for rec in self:
            if rec.mobility_jobmatch_ids:
                rec.total_matching_mobility = len(rec.mobility_jobmatch_ids)
            else:
                rec.total_matching_mobility = 0

    def show_mobility_matches(self):
        if self.mobility_id:
            self.mobility_id.match_line_display_ids = False
            self.mobility_id.match_line_display_ids = [(6, 0, self.mobility_jobmatch_ids.ids)]
    

class HrTalentMobilityMatch(models.Model):
    _name = "hr.talent.mobility.match"
    _description = "Talent Mobility Match Line"
    _order = "match_score desc"

    mobility_id = fields.Many2one("hr.talent.mobility", required=True, ondelete="cascade")
    job_mobility_id = fields.Many2one("hr.talent.mobility.jobmatch", ondelete="cascade")
    employee_id = fields.Many2one("hr.employee", required=True)
    job_id = fields.Many2one("hr.job", string="Ready For")
    match_score = fields.Float(string="Promotion Readiness (%)")
    match_reason = fields.Text(string="AI Reasoning")
    matched_skill_ids = fields.Many2many('hr.mobility.match.skill', string="Matched Skills")   # comma-separated for simplicity
    missing_skill_ids = fields.Char(string="Missing Skills")
    state = fields.Selection([
        ("new", "New"),
        ("discussed", "Discussed with HR"),
        ("dev_plan", "Development Plan Created"),
        ("pipeline", "Added to Pipeline"),
    ], default="new")

    def action_discuss_with_hr(self):
        self.state = "discussed"
        # trigger activity/notification to HR here

    def action_create_dev_plan(self):
        self.state = "dev_plan"
        # create related dev-plan record here

    def action_add_to_pipeline(self):
        self.state = "pipeline"
        # create hr.applicant or similar pipeline record here


class HrTalentMobility(models.Model):
    _name = "hr.talent.mobility"
    _description = "Talent Mobility"

    name = fields.Char(required=False, default="Talent Mobility")

    job_ids = fields.Many2many(
        "hr.job",
        string="Target Positions"
    )

    matching_candidate_ids = fields.Many2many(
        "hr.employee",
        string="Matching Employees"
    )
    match_line_ids = fields.Many2many(
        "hr.talent.mobility.match", 
        "mobility_id", 
        string="Matches"
        ) 
    match_line_display_ids = fields.Many2many(
        "hr.talent.mobility.match", 
        string="Matches"
        ) 
    job_match_line_ids = fields.One2many(
        "hr.talent.mobility.jobmatch", 
        "mobility_id",
        string="Job Matches"
        ) 
    total_match_count = fields.Integer(
        # compute="_compute_total_match_count",
        store=True
    )

    mobility_cost = fields.Float(
        string="Estimated Mobility Cost",
        # compute="_compute_costs",
        store=True
    )

    current_employee_cost = fields.Float(
        string="Current Employee Cost",
        # compute="_compute_costs",
        store=True
    )

    saved_mobility_cost = fields.Float(
        string="Projected Savings",
        # compute="_compute_costs",
        store=True
    )
    match_threshold = fields.Integer(
    default=4,
    help="Minimum number of matching skills required."
    ) 
    mobility_match_score = fields.Float()
    mobility_match_reason = fields.Text()

    def show_all_matches(self):
        self.ensure_one()
        employees = self._get_matching_employees()
        # return {
        #     'type': 'ir.actions.act_window',
        #     'name': 'Talent Mobility',
        #     'res_model': 'hr.talent.mobility',
        #     'view_mode': 'form',
        #     'res_id': self.id,
        #     'target': 'current',
        # }

    # @api.depends("matching_candidate_ids")
    def _compute_total_match_count(self):
        for rec in self:
            rec.total_match_count = len(rec.match_line_ids)
    
    # @api.depends(
    #     "job_ids",
    #     "job_ids.max_salary_band",
    #     "matching_candidate_ids",
    #     "matching_candidate_ids.wage",
    # )
    def _compute_costs(self):
        for rec in self:
            mobility_cost = sum(
                rec.job_ids.mapped("max_salary_band") or [0.0]
            )

            current_employee_cost = sum(
                rec.matching_candidate_ids.mapped("wage") or [0.0]
            )

            rec.mobility_cost = mobility_cost
            rec.current_employee_cost = current_employee_cost
            rec.saved_mobility_cost = mobility_cost - current_employee_cost

    @api.model
    def get_dashboard(self):
        record = self.search([], limit=1)
        if not record:
            record = super(HrTalentMobility, self).create({})
        employees = record._get_matching_employees()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Talent Mobility',
            'res_model': 'hr.talent.mobility',
            'view_mode': 'form',
            'res_id': record.id,
            'target': 'current',
        }

    def action_view_matching_mobility(self):
        self.ensure_one()

        # Clear existing matches
        # self.matching_candidate_ids = [(5, 0, 0)]
 
        return {
            "type": "ir.actions.act_window",
            "name": "Matching Employees",
            "res_model": "hr.employee",
            "view_mode": "kanban,list,form",
            "domain": [("id", "in", self.matching_candidate_ids.ids)],
            "target": "current",
        } 
    
    def organize_matching_data(self, data):
        '''{
            '4': [
                {
                    'employee_id': 55,
                    'skills': ['python', 'java', 'react']
                },
                {
                    'employee_id': 54,
                    'skills': ['python', 'java', 'php']
                }
            ]
        }'''
        result = {}
        for key, records in data.items():
            employees = defaultdict(set)

            for rec in records:
                employees[rec['employee_id']].update(rec['skills'])

            result[key] = [
                {
                    'employee_id': emp_id,
                    'skills': list(skills)
                }
                for emp_id, skills in employees.items()
            ]
        return result 

    def check_matching_with_regex(self, listA, matchingText):
        # listA = ['python']
        # text = 'my name is peter i am a python developer but i get php experience'
        # returns ['python']
        if not listA:
            return []
        pattern = re.compile(
            r'\b(?:' + '|'.join(map(re.escape, listA)) + r')\b',
            re.IGNORECASE
        )
        return pattern.findall(matchingText)

    def _create_or_update_matches(self, data):
        """
        data = {
            '<job_id>': [
                {'employee_id': 55, 'skills': ['python', 'java', 'react']},
                {'employee_id': 54, 'skills': ['python', 'java', 'php']},
            ],
            ...
        }
        """
        self.ensure_one()
        MobilityMatch = self.env['hr.talent.mobility.match']
        MobilityJobMatch = self.env['hr.talent.mobility.jobmatch']
        # Delete all hr.talent.mobility.jobmatch to rebuild        
        self.env['hr.talent.mobility.match'].search([]).unlink()

        mobilityItem = []
        for job_id_str, employee_entries in data.items():
            job_id = int(job_id_str)
            jobObj = self.env['hr.job'].browse([job_id])
            jobmatch = MobilityJobMatch.search([
                ('job_id', '=', job_id),
            ], limit=1)
            Jobvals = {
                'mobility_id': self.id,
                'job_id': job_id,
                'job_category': self.env['hr.job'].browse([job_id]).job_nature,
            }
            if jobmatch:
                jobmatch.mobility_jobmatch_ids = [(5, 0, 0)]
                jobmatch.write(Jobvals)
            else:
                jobmatch = MobilityJobMatch.create(Jobvals)
            for entry in employee_entries:
                employee_id = entry.get('employee_id')
                skills = entry.get('skills', [])
                unique_skills = [x.title() for i, x in enumerate(skills) if x not in skills[:i]]
                vals = {
                    'mobility_id': self.id,
                    'employee_id': employee_id,
                    'job_id': job_id,
                    'job_mobility_id': jobmatch.id,
                    'matched_skill_ids': [(0,0, {'name': ', '.join(unique_skills)})]
                }

                emp_mobility = MobilityMatch.search([
                    ('mobility_id', '=', self.id),
                    ('employee_id', '=', employee_id),
                    ('job_id', '=', job_id),
                ], limit=1)

                if emp_mobility:
                    emp_mobility.write(vals)
                else:
                    emp_mobility = MobilityMatch.create(vals)
                jobmatch.update({
                    'mobility_jobmatch_ids': [(4, emp_mobility.id)],
                    # 'total_matching_mobility': jobmatch.total_matching_mobility + 1, # updating manually to avoid compute issues
                })
                mobilityItem.append(emp_mobility.id)
                jobObj.update({'talent_mobility_ids': [(6, 0, [emp_mobility.id])], 
                            #    'total_matching_mobility': jobObj.total_matching_mobility + 1
                               })
                
            # update the job and talent mobility found in the job 
            self.job_ids = [(6, 0, [job_id])]
        self.match_line_display_ids = [(6, 0, mobilityItem)]

    def _get_matching_employees(self):
        self.ensure_one()
        keywords = self._get_job_keywords()

        if not keywords:
            return self.env["hr.employee"]

        threshold = self.match_threshold or 2
        employees = self.env["hr.employee"].search([("active", "=", True)])

        employee_matches = {}      # {job_id_str: [{'employee_id': .., 'skills': [...]}]}
        employee_scores = {}       # {employee_id: total_matched_skill_count}

        for employee in employees:
            employee_text = " ".join([
                employee.skills_text or "",
                employee.qualifications_text or "",
                employee.experience_text or "",
            ]).lower()

            total_score = 0

            for keyword in keywords:
                # keyword == {'wordings': ['java', 'python', 'react'], 'job_id': 4}
                job_id = keyword.get('job_id')
                items_to_match = keyword.get('wordings', [])

                matched_items = self.check_matching_with_regex(items_to_match, employee_text)
                if not matched_items:
                    continue

                total_score += len(matched_items)

                job_key = f'{job_id}'
                emp_data = {'employee_id': employee.id, 'skills': matched_items}
                employee_matches.setdefault(job_key, []).append(emp_data)

            if total_score >= threshold:
                employee_scores[employee.id] = total_score

        organized_data = self.organize_matching_data(employee_matches)
        self._create_or_update_matches(organized_data)

        # sort by score descending, return matching employees
        sorted_employee_ids = [
            emp_id for emp_id, score in
            sorted(employee_scores.items(), key=lambda x: x[1], reverse=True)
        ]
        self._compute_total_match_count()
        self._compute_costs()
        employee_ids = self.env["hr.employee"].browse(sorted_employee_ids)
        return employee_ids
    
    def _extract_keywords(self, text):
        if not text:
            return set()

        words = re.findall(r"\b[a-zA-Z0-9+#.]+\b", text.lower())

        stop_words = {
            "and", "the", "for", "with", "from",
            "that", "this", "are", "was", "will",
            "have", "has", "into", "your", "you",
            "our", "their", "they", "his", "her",
            "its", "job", "role", "required",
            "requirement", "experience", "skill",
            "skills", "knowledge"
        }
        words = [
            w.strip() for w in words if len(w) > 2 and w not in stop_words
            ]
        return {
            'wordings': words # {'wordings': ['jave', 'python', 'react']}
        }
        # return {
        #     'wordings': w.strip()
        #     for w in words
        #     if len(w) > 2 and w not in stop_words
        # }
    
    def _get_job_keywords(self):
        self.ensure_one()
        keyword_items = []
        job_ids = self.env['hr.job'].search([
            ('datetime_publish', '!=', False)])
        for job in job_ids:
            # if job.close_date <= job.opened_date:
            keywords = {} # set()
            text_parts = [
                getattr(job, "description", "") or "",
                getattr(job, "requirements", "") or "",
                job.name or "",
            ]
            _logger.info(f"WHAT THE HELL IS {text_parts}")

            keywords.update(
                self._extract_keywords(
                    " ".join(text_parts)
                )
            )
            keywords.update({'job_id': job.id})
            keyword_items.append(keywords)
            _logger.info(f"WHAT HELL IS {keyword_items}")
            # {'wordings': ['jave', 'python', 'react'], 'job_id': 3}
        return keyword_items