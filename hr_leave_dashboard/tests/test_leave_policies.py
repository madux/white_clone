# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestLeavePolicies(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Policy = cls.env["hr.leave.policy"]
        cls.employee_a = cls.env["hr.employee"].create({"name": "Policy Employee A", "company_id": cls.env.company.id})
        cls.employee_b = cls.env["hr.employee"].create({"name": "Policy Employee B", "company_id": cls.env.company.id})
        cls.annual = cls.env["hr.leave.type"].create({
            "name": "Structured Annual", "leave_code": "SAN", "company_id": cls.env.company.id,
            "policy_classification": "annual", "requires_allocation": "no", "leave_validation_type": "manager",
        })

    def payload(self, name, employees, leave_type=None, state="active"):
        return {
            "name": name, "code": name.upper().replace(" ", "")[-8:], "mode": "simple", "state": state,
            "apply_to": "selected", "selected": {"employee_ids": employees.ids},
            "lines": [{
                "leave_type_id": (leave_type or self.annual).id, "compensation": "paid", "unit": "days",
                "entitlement_type": "fixed", "accrual_period": "annually", "accrual_basis": "join_date",
                "accrual_amount": 21, "waiting_period_days": 0,
            }],
            "carry": {"enabled": True, "maximum": 5, "expiry_value": 3, "expiry_unit": "months", "priority": "carried"},
            "approval": {"required": True, "workflow": "default"}, "rules": {"multiple": True, "withdrawal": True, "half_day": True},
        }

    def test_policy_type_relationship_is_many_to_many(self):
        first = self.Policy.save_policy(self.payload("First Policy", self.employee_a))
        second = self.Policy.save_policy(self.payload("Second Policy", self.employee_b))
        policies = self.Policy.browse([first["id"], second["id"]])
        self.assertEqual(policies.mapped("line_ids.leave_type_id"), self.annual)
        self.assertEqual(len(policies), 2)
        self.assertEqual(policies[0].line_ids.accrual_amount, 21)

    def test_custom_type_is_created_inline_with_structured_classification(self):
        payload = self.payload("Medical Policy", self.employee_a, state="draft")
        payload["lines"] = [{"new_leave_type_name": "Unplanned Wellness", "classification": "sick", "accrual_amount": 10}]
        policy = self.Policy.browse(self.Policy.save_policy(payload)["id"])
        self.assertEqual(policy.line_ids.leave_type_id.policy_classification, "sick")
        self.assertEqual(policy.line_ids.leave_type_id._effective_bradford_mode(), "short_notice")

    def test_conflict_review_blocks_and_keep_skips_only_conflict(self):
        first = self.Policy.browse(self.Policy.save_policy(self.payload("Conflict One", self.employee_a))["id"])
        second_payload = self.payload("Conflict Two", self.employee_a | self.employee_b, state="draft")
        second = self.Policy.browse(self.Policy.save_policy(second_payload)["id"])
        second.write({"state": "active"})
        with self.assertRaises(ValidationError):
            second._sync_assignments("review")
        result = second._sync_assignments("keep")
        self.assertEqual(result, {"assigned": 1, "conflicts": 1})
        self.assertEqual(second.assignment_ids.employee_id, self.employee_b)
        self.assertTrue(first.assignment_ids.active_on(fields.Date.context_today(self.Policy)))

    def test_replace_effective_dates_old_assignment(self):
        old = self.Policy.browse(self.Policy.save_policy(self.payload("Old Policy", self.employee_a))["id"])
        new_payload = self.payload("New Policy", self.employee_a, state="draft")
        new = self.Policy.browse(self.Policy.save_policy(new_payload)["id"])
        effective = fields.Date.context_today(self.Policy) + timedelta(days=5)
        new.write({"state": "active"})
        new._sync_assignments("replace", effective_date=effective)
        self.assertEqual(old.assignment_ids.date_to, effective - timedelta(days=1))
        self.assertEqual(new.assignment_ids.date_from, effective)

    def test_delete_with_assignment_archives(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Historic Policy", self.employee_a))["id"])
        result = self.Policy.delete_policy(policy.id)
        self.assertEqual(result, {"archived": True})
        self.assertEqual(policy.with_context(active_test=False).state, "archived")

    def test_structured_annual_classification_is_mandatory_exclusion(self):
        self.annual.write({"name": "Neutral Label", "leave_code": "NL"})
        self.assertEqual(self.annual._effective_bradford_mode(), "exclude")
        with self.assertRaises(ValidationError):
            self.annual.write({"bradford_count_mode": "all"})

    def _request(self, employee=None, state="draft"):
        day = fields.Date.today() + timedelta(days=30)
        while day.weekday() >= 5:
            day += timedelta(days=1)
        leave = self.env["hr.leave"].create({
            "employee_id": (employee or self.employee_a).id,
            "holiday_status_id": self.annual.id, "state": "draft",
            "request_date_from": day, "request_date_to": day,
        })
        if state != "draft":
            leave.action_confirm()
            if state == "validate" and leave.state != "validate":
                leave.action_validate()
        return leave

    def test_draft_is_not_a_submission(self):
        leave = self._request()
        self.assertFalse(leave.submitted_at)
        self.assertFalse(leave.governing_rule_snapshot)
        leave.write({"state": "confirm"})
        self.assertTrue(leave.submitted_at)
        self.assertTrue(leave.governing_rule_snapshot)

    def test_submitted_rules_survive_policy_edit_and_replacement(self):
        payload = self.payload("Snapshot Policy", self.employee_a)
        payload["approval"]["required"] = False
        policy = self.Policy.browse(self.Policy.save_policy(payload)["id"])
        old_assignment = policy.assignment_ids
        leave = self._request(state="validate")
        self.assertEqual(leave.governing_policy_id, policy)
        self.assertEqual(leave._policy_rule_line().accrual_amount, 21)
        edited = self.Policy.get_policy_details(policy.id)
        edited["lines"][0]["accrual_amount"] = 30
        self.Policy.save_policy(edited)
        self.assertTrue(old_assignment.superseded)
        self.assertEqual(old_assignment.rule_snapshot["line"]["accrual_amount"], 21)
        self.assertEqual(leave._policy_rule_line().accrual_amount, 21)
        self.assertEqual(leave._approval_resolve_chain(), "no_approval")
        with self.assertRaises(AccessError):
            leave.write({"governing_rule_snapshot": {"legacy": True}})

    def test_same_day_replacement_preserves_old_assignment(self):
        first = self.Policy.browse(self.Policy.save_policy(self.payload("Same Day Old", self.employee_a))["id"])
        old = first.assignment_ids
        payload = self.payload("Same Day New", self.employee_a)
        payload["conflict_resolution"] = "replace"
        self.Policy.save_policy(payload)
        self.assertTrue(old.exists())
        self.assertTrue(old.superseded)
        self.assertFalse(old.active_on(fields.Date.today()))

    def test_empty_explicit_assignment_does_not_assign_everyone(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Empty Assign", self.employee_a))["id"])
        before = policy.assignment_ids
        result = policy._sync_assignments(employees=self.env["hr.employee"])
        self.assertEqual(result["assigned"], 0)
        self.assertEqual(before, policy.assignment_ids)

    def test_archived_policy_cannot_be_assigned(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Archive Assign", self.employee_a))["id"])
        policy.write({"state": "archived"})
        with self.assertRaises(ValidationError):
            policy._sync_assignments(employees=self.employee_b)

    def test_conflict_preview_is_read_only(self):
        self.Policy.save_policy(self.payload("Preview Old", self.employee_a))
        before = self.Policy.search_count([])
        rows = self.Policy.preview_policy_conflicts(self.payload("Preview New", self.employee_a | self.employee_b))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["employee"], self.employee_a.name)
        self.assertEqual(rows[0]["entitlement"], 21)
        self.assertEqual(self.Policy.search_count([]), before)

    def test_policy_usage_does_not_double_count_shared_types(self):
        policies = self.Policy.browse()
        leaves = self.env["hr.leave"]
        for name, employee in (("Usage One", self.employee_a), ("Usage Two", self.employee_b)):
            payload = self.payload(name, employee)
            payload["approval"]["required"] = False
            policies |= self.Policy.browse(self.Policy.save_policy(payload)["id"])
            leaves |= self._request(employee, "validate")
        rows = self.env["hr.leave.report.service"]._policy_usage({
            "types": self.annual, "employees": self.employee_a | self.employee_b, "leaves": leaves,
        })
        counts = {row["id"]: row["requests"] for row in rows}
        self.assertEqual([counts[policy.id] for policy in policies], [1, 1])

    def test_dynamic_transfer_does_not_use_stale_assignment(self):
        department = self.env["hr.department"].create({"name": "Policy Finance"})
        self.employee_a.department_id = department
        payload = self.payload("Finance Condition", self.employee_a)
        payload.update({"mode": "advanced", "apply_to": "conditions", "selected": {"department_ids": department.ids}})
        self.Policy.save_policy(payload)
        self.assertTrue(self.annual._active_policy_line(self.employee_a))
        self.employee_a.department_id = False
        self.assertFalse(self.annual._active_policy_line(self.employee_a))

    def test_bradford_names_do_not_change_runtime_classification(self):
        leave_type = self.env["hr.leave.type"].create({"name": "Sick in name only", "policy_classification": "other", "requires_allocation": "no"})
        self.assertEqual(leave_type._effective_bradford_mode(), "exclude")
        leave_type.write({"policy_classification": "family", "bradford_count_mode": "all"})
        self.assertEqual(leave_type._effective_bradford_mode(), "all")
