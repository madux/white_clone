# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import common, tagged
from odoo.exceptions import UserError
from datetime import timedelta


@tagged('post_install', '-at_install')
class TestGrievanceCase(common.TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.gtype = cls.env.ref('grievance_management.grievance_type_harassment')
        cls.stage_submitted = cls.env.ref('grievance_management.grievance_stage_submitted')
        cls.stage_resolved = cls.env.ref('grievance_management.grievance_stage_resolved')
        cls.stage_closed = cls.env.ref('grievance_management.grievance_stage_closed')
        cls.resolution = cls.env.ref('grievance_management.grievance_resolution_structured_settlement')

    def test_01_sequence_generated(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        self.assertTrue(case.name.startswith('GRV-'), "Case ID should use the GRV-YYYY-XXX sequence")
        self.assertNotEqual(case.name, 'New')

    def test_02_default_stage_is_first(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        self.assertEqual(case.stage_id, self.stage_submitted)
        self.assertFalse(case.is_closed)

    def test_03_days_open_computation(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'date_submitted': (fields.Date.today() - timedelta(days=10)),
        })
        self.assertEqual(case.days_open, 10)

    def test_04_closing_stage_sets_date_closed(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        case.write({'stage_id': self.stage_closed.id})
        self.assertTrue(case.date_closed)
        self.assertTrue(case.is_closed)

    def test_05_resolve_requires_resolution(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        with self.assertRaises(UserError):
            case.action_resolve()

    def test_06_resolve_requires_compensation_amount(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'resolution_id': self.resolution.id,
        })
        # Structured Settlement requires compensation_amount and follow_up_date
        with self.assertRaises(UserError):
            case.action_resolve()

    def test_07_resolve_success_moves_to_resolved_stage(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'resolution_id': self.resolution.id,
            'compensation_amount': 500.0,
            'follow_up_date': fields.Date.today(),
        })
        case.action_resolve()
        self.assertEqual(case.stage_id, self.stage_resolved)
        self.assertTrue(case.is_closed)

    def test_08_escalation_rule_deadline_exceeded(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'date_submitted': (fields.Date.today() - timedelta(days=30)),
        })
        rule = self.env.ref('grievance_management.grievance_escalation_rule_overdue')
        self.assertIn(case, rule._get_matching_cases())
        rule.action_run_now()
        self.assertTrue(case.escalated)
        self.assertEqual(case.escalation_rule_id, rule)

    def test_09_escalation_rule_severity_severe(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'severity': 'severe',
        })
        rule = self.env.ref('grievance_management.grievance_escalation_rule_severe')
        self.assertIn(case, rule._get_matching_cases())
        rule.action_run_now()
        self.assertTrue(case.escalated)

    def test_10_closed_case_not_rematched_by_deadline_rule(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
            'date_submitted': (fields.Date.today() - timedelta(days=30)),
        })
        case.write({'stage_id': self.stage_closed.id})
        rule = self.env.ref('grievance_management.grievance_escalation_rule_overdue')
        self.assertNotIn(case, rule._get_matching_cases(), "Closed cases must not be escalated")

    def test_11_type_active_case_count(self):
        before = self.gtype.active_case_count
        self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        self.gtype.invalidate_recordset()
        self.assertEqual(self.gtype.active_case_count, before + 1)

    def test_12_complainant_name_anonymous(self):
        case = self.env['grievance.case'].create({
            'grievance_type_id': self.gtype.id,
            'is_anonymous': True,
        })
        self.assertEqual(case.complainant_name, 'Anonymous')
