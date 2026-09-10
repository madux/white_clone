# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
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

    def payload(self, name, employees, leave_type=None, state="active", policy_id=None):
        data = {
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
        if policy_id:
            data["id"] = policy_id
        return data

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
        second._write_lifecycle({"state": "active"})
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
        new._write_lifecycle({"state": "active"})
        new._sync_assignments("replace", effective_date=effective)
        self.assertEqual(old.assignment_ids.date_to, effective - timedelta(days=1))
        self.assertEqual(new.assignment_ids.date_from, effective)

    def test_delete_is_no_longer_exposed_and_archive_preserves_history(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Historic Policy", self.employee_a))["id"])
        result = self.Policy.archive_policy(policy.id)
        self.assertEqual(result, {"archived": True})
        reloaded = policy.with_context(active_test=False)
        self.assertFalse(reloaded.active)
        self.assertEqual(reloaded.state, "active")
        with self.assertRaises(UserError):
            policy.unlink()

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
        self.Policy.archive_policy(policy.id)
        with self.assertRaises(ValidationError):
            policy.with_context(active_test=False)._sync_assignments(employees=self.employee_b)

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

    def test_archived_policy_excluded_from_accrual_cron_governance(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Cron Policy", self.employee_a))["id"])
        self.Policy.archive_policy(policy.id)
        governed = self.env["hr.leave.policy.line"].sudo().search([
            ("active", "=", True), ("policy_id.state", "=", "active"), ("policy_id.active", "=", True),
        ]).leave_type_id
        self.assertNotIn(self.annual, governed)

    def test_restore_policy_conflict_detection(self):
        first = self.Policy.browse(self.Policy.save_policy(self.payload("First Pol", self.employee_a))["id"])
        self.Policy.archive_policy(first.id)
        # In the meantime, assign a second policy to the same employee & leave type
        second = self.Policy.browse(self.Policy.save_policy(self.payload("Second Pol", self.employee_a))["id"])
        # Restoring first restores it as inactive, avoiding immediate conflict
        res = self.Policy.restore_policy(first.id)
        self.assertEqual(res["state"], "inactive")
        self.assertTrue(first.active)
        self.assertEqual(first.state, "inactive")
        # Attempting to activate the restored policy detects the conflict with second
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(first.id, "active")

    def test_restore_draft_policy_preserves_draft(self):
        payload = self.payload("Draft Pol", self.employee_a)
        payload["state"] = "draft"
        draft = self.Policy.browse(self.Policy.save_policy(payload)["id"])
        self.assertEqual(draft.state, "draft")
        self.Policy.archive_policy(draft.id)
        res = self.Policy.restore_policy(draft.id)
        self.assertEqual(res["state"], "draft")
        self.assertEqual(draft.state, "draft")
        self.assertTrue(draft.active)

    def test_archived_policy_cannot_be_edited_or_status_changed(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Edit Guard", self.employee_a))["id"])
        self.Policy.archive_policy(policy.id)
        with self.assertRaises(UserError):
            self.Policy.save_policy(self.payload("Edit Guard Renamed", self.employee_a, policy_id=policy.id))
        with self.assertRaises(UserError):
            self.Policy.change_policy_status(policy.id, "inactive")
        with self.assertRaises(UserError):
            self.Policy.assign_policy(policy.id, self.employee_b.ids)

    def test_effective_dated_deactivate_and_reactivate(self):
        today = fields.Date.context_today(self.Policy)
        # 1. Create Policy A in draft and establish initial assignment from 60 days ago
        policy_a = self.Policy.browse(self.Policy.save_policy(self.payload("Timeline Policy A", self.employee_a, state="draft"))["id"])
        line_a = policy_a.line_ids.filtered(lambda l: l.leave_type_id == self.annual)
        assign_1 = self.env["hr.leave.policy.assignment"].create({
            "policy_id": policy_a.id, "policy_line_id": line_a.id, "leave_type_id": self.annual.id,
            "employee_id": self.employee_a.id, "date_from": today - timedelta(days=60),
        })
        policy_a._write_lifecycle({"state": "active"})
        self.assertEqual(self.annual._active_policy_line(self.employee_a, today), line_a)
        self.assertFalse(assign_1.date_to)

        # 2. Deactivate Policy A (closes past assignments as of today - 1)
        self.Policy.change_policy_status(policy_a.id, "inactive")
        self.assertEqual(policy_a.state, "inactive")
        self.assertEqual(assign_1.date_to, today - timedelta(days=1))
        self.assertFalse(self.annual._active_policy_line(self.employee_a, today))

        # 3. Reactivate Policy A (creates prospective assignment from today)
        self.Policy.change_policy_status(policy_a.id, "active")
        self.assertEqual(policy_a.state, "active")
        active_assigns = policy_a.assignment_ids.filtered(lambda a: a.employee_id == self.employee_a and not a.superseded)
        self.assertEqual(len(active_assigns), 2)
        assign_2 = active_assigns - assign_1
        self.assertEqual(assign_2.date_from, today)
        self.assertFalse(assign_2.date_to)

        # Verify historical resolution across distinct assignment periods and gap:
        # Simulate that deactivation ended assignment 1 on day -31
        assign_1.write({"date_to": today - timedelta(days=31)})

        # Query in Period 1 (day -45) -> governed by A
        self.assertEqual(self.annual._active_policy_line(self.employee_a, today - timedelta(days=45)), line_a)
        # Query in Gap between deactivation and reactivation (day -20) -> no A
        self.assertFalse(self.annual._active_policy_line(self.employee_a, today - timedelta(days=20)))
        # Query in Period 2 (today) -> governed by A
        self.assertEqual(self.annual._active_policy_line(self.employee_a, today), line_a)

    def test_lifecycle_transitions_strict_rules(self):
        # 1. Draft can only go to Active, not Inactive or back to Draft
        draft = self.Policy.browse(self.Policy.save_policy(self.payload("Draft Rule", self.employee_a, state="draft"))["id"])
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(draft.id, "inactive")
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(draft.id, "draft")

        # 2. Active can go to Inactive, but never to Draft
        self.Policy.change_policy_status(draft.id, "active")
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(draft.id, "draft")
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Draft Rule Renamed", self.employee_a, state="draft", policy_id=draft.id))

        # 3. Inactive can go to Active, but never to Draft
        self.Policy.change_policy_status(draft.id, "inactive")
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(draft.id, "draft")

    def test_archived_display_status(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Display Status Pol", self.employee_a))["id"])
        self.assertEqual(policy._row()["display_status"], "active")
        self.Policy.archive_policy(policy.id)
        reloaded = policy.with_context(active_test=False)
        self.assertEqual(reloaded.state, "active")  # internal state preserved
        self.assertFalse(reloaded.active)
        self.assertEqual(reloaded._row()["display_status"], "archived")  # display status shows archived

    def test_activation_conflict_resolution(self):
        # Create active Policy A for employee_a
        policy_a = self.Policy.browse(self.Policy.save_policy(self.payload("Active Pol A", self.employee_a))["id"])
        # Create draft Policy B for employee_a
        policy_b = self.Policy.browse(self.Policy.save_policy(self.payload("Draft Pol B", self.employee_a, state="draft"))["id"])

        # Activating Policy B with review detects conflict and raises ValidationError
        with self.assertRaises(ValidationError):
            self.Policy.change_policy_status(policy_b.id, "active", resolution="review")
        self.assertEqual(policy_b.state, "draft")

        # Activating Policy B with keep skips conflicting employee_a
        self.Policy.change_policy_status(policy_b.id, "active", resolution="keep")
        self.assertEqual(policy_b.state, "active")
        self.assertFalse(policy_b.assignment_ids.filtered(lambda a: a.employee_id == self.employee_a))

        # Create draft Policy C for employee_a
        policy_c = self.Policy.browse(self.Policy.save_policy(self.payload("Draft Pol C", self.employee_a, state="draft"))["id"])
        # Activating Policy C with replace succeeds and supersedes/ends Policy A's assignment
        self.Policy.change_policy_status(policy_c.id, "active", resolution="replace")
        self.assertEqual(policy_c.state, "active")
        self.assertTrue(policy_c.assignment_ids.filtered(lambda a: a.employee_id == self.employee_a))
        line_c = policy_c.line_ids.filtered(lambda l: l.leave_type_id == self.annual)
        today = fields.Date.context_today(self.Policy)
        self.assertEqual(self.annual._active_policy_line(self.employee_a, today), line_c)

    def test_draft_policy_line_unlink_and_assigned_guard(self):
        sick = self.env["hr.leave.type"].create({
            "name": "Line Sick", "leave_code": "LSK", "company_id": self.env.company.id,
            "policy_classification": "sick", "requires_allocation": "no",
        })
        payload = self.payload("Draft Line Test", self.employee_a, state="draft")
        payload["lines"].append({
            "leave_type_id": sick.id, "compensation": "paid", "unit": "days",
            "entitlement_type": "fixed", "accrual_period": "annually", "accrual_basis": "join_date",
            "accrual_amount": 10, "waiting_period_days": 0,
        })
        policy = self.Policy.browse(self.Policy.save_policy(payload)["id"])
        self.assertEqual(len(policy.line_ids), 2)
        # Unassigned draft line can be unlinked directly
        line_to_remove = policy.line_ids.filtered(lambda l: l.leave_type_id == sick)
        line_to_remove.unlink()
        self.assertEqual(len(policy.line_ids), 1)

        # Now activate the policy, which creates assignments for the remaining line
        self.Policy.change_policy_status(policy.id, "active")
        remaining_line = policy.line_ids
        self.assertTrue(remaining_line.assignment_ids)
        # Attempting to delete an assigned line raises ValidationError
        with self.assertRaises(ValidationError):
            remaining_line.unlink()

    def test_save_policy_cannot_bypass_lifecycle_transitions(self):
        # 1. Active policy cannot be transitioned to Inactive or Draft via save_policy
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Strict Transition Pol", self.employee_a))["id"])
        self.assertEqual(policy.state, "active")
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Transition Pol", self.employee_a, state="inactive", policy_id=policy.id))
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Transition Pol", self.employee_a, state="draft", policy_id=policy.id))

        # 2. Inactive policy cannot be transitioned to Active or Draft via save_policy
        self.Policy.change_policy_status(policy.id, "inactive")
        self.assertEqual(policy.state, "inactive")
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Transition Pol", self.employee_a, state="active", policy_id=policy.id))
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Transition Pol", self.employee_a, state="draft", policy_id=policy.id))

        # 3. Draft policy cannot be transitioned to Active or Inactive via save_policy
        draft = self.Policy.browse(self.Policy.save_policy(self.payload("Strict Draft Pol", self.employee_a, state="draft"))["id"])
        self.assertEqual(draft.state, "draft")
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Draft Pol", self.employee_a, state="active", policy_id=draft.id))
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Strict Draft Pol", self.employee_a, state="inactive", policy_id=draft.id))

    def test_direct_orm_write_on_lifecycle_fields_is_blocked(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Block Direct Write", self.employee_a))["id"])
        # Writing state directly unconditionally raises ValidationError, even if context is forged
        with self.assertRaises(ValidationError):
            policy.write({"state": "inactive"})
        with self.assertRaises(ValidationError):
            policy.write({"state": "draft"})
        with self.assertRaises(ValidationError):
            policy.with_context(allow_lifecycle_write=True).write({"state": "inactive"})
        with self.assertRaises(ValidationError):
            policy.with_context(allow_lifecycle_write=True).write({"state": "draft"})

        # Writing active directly unconditionally raises ValidationError, even if context is forged
        with self.assertRaises(ValidationError):
            policy.write({"active": False})
        with self.assertRaises(ValidationError):
            policy.with_context(allow_lifecycle_write=True).write({"active": False})

        # Internal Python helper _write_lifecycle bypasses public write override
        policy._write_lifecycle({"state": "inactive"})
        self.assertEqual(policy.state, "inactive")
        policy._write_lifecycle({"active": False})
        self.assertFalse(policy.active)

    def test_archive_already_archived_policy_raises_error(self):
        policy = self.Policy.browse(self.Policy.save_policy(self.payload("Double Archive Pol", self.employee_a))["id"])
        self.Policy.archive_policy(policy.id)
        with self.assertRaises(UserError):
            self.Policy.archive_policy(policy.id)

    def test_policy_line_unlink_rules(self):
        sick = self.env["hr.leave.type"].create({
            "name": "Unlink Rule Sick", "leave_code": "URS", "company_id": self.env.company.id,
            "policy_classification": "sick", "requires_allocation": "no",
        })
        # 1. Draft policy: unassigned line unlinking succeeds
        payload = self.payload("Unlink Rule Draft Pol", self.employee_a, state="draft")
        payload["lines"].append({
            "leave_type_id": sick.id, "compensation": "paid", "unit": "days",
            "entitlement_type": "fixed", "accrual_period": "annually", "accrual_basis": "join_date",
            "accrual_amount": 5, "waiting_period_days": 0,
        })
        draft_policy = self.Policy.browse(self.Policy.save_policy(payload)["id"])
        draft_line = draft_policy.line_ids.filtered(lambda l: l.leave_type_id == sick)
        draft_line.unlink()
        self.assertFalse(draft_line.exists())

        # 2. Active policy: unassigned line unlinking is blocked
        active_policy = self.Policy.browse(self.Policy.save_policy(self.payload("Unlink Rule Active Pol", self.employee_a))["id"])
        unassigned_line = self.env["hr.leave.policy.line"].create({
            "policy_id": active_policy.id, "leave_type_id": sick.id, "compensation": "paid",
            "unit": "days", "entitlement_type": "fixed", "accrual_period": "annually",
            "accrual_basis": "join_date", "accrual_amount": 5, "waiting_period_days": 0,
        })
        with self.assertRaises(ValidationError):
            unassigned_line.unlink()

        # 3. Inactive policy: unassigned line unlinking is blocked
        self.Policy.change_policy_status(active_policy.id, "inactive")
        with self.assertRaises(ValidationError):
            unassigned_line.unlink()

        # 4. Archived policy: line unlinking is blocked
        self.Policy.archive_policy(active_policy.id)
        with self.assertRaises(ValidationError):
            unassigned_line.unlink()

    def test_direct_orm_create_lifecycle_invariants(self):
        # 1. Direct ORM create with state='active' is rejected
        with self.assertRaises(ValidationError):
            self.Policy.create({
                "name": "Direct Active", "code": "DIRACT", "company_id": self.env.company.id,
                "state": "active",
            })

        # 2. Direct ORM create with state='inactive' is rejected
        with self.assertRaises(ValidationError):
            self.Policy.create({
                "name": "Direct Inactive", "code": "DIRINACT", "company_id": self.env.company.id,
                "state": "inactive",
            })

        # 3. Direct ORM create with active=False is rejected
        with self.assertRaises(ValidationError):
            self.Policy.create({
                "name": "Direct Archived", "code": "DIRARCH", "company_id": self.env.company.id,
                "active": False,
            })

        # 4. Normal Draft create succeeds (explicit state='draft' or omitted)
        draft_policy = self.Policy.create({
            "name": "Direct Draft", "code": "DIRDFT", "company_id": self.env.company.id,
            "state": "draft",
        })
        self.assertEqual(draft_policy.state, "draft")
        self.assertTrue(draft_policy.active)

        omitted_policy = self.Policy.create({
            "name": "Direct Default", "code": "DIRDEF", "company_id": self.env.company.id,
        })
        self.assertEqual(omitted_policy.state, "draft")
        self.assertTrue(omitted_policy.active)

    def test_save_policy_initial_creation_states(self):
        # 1. save_policy() with state='inactive' is rejected
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Initial Inactive", self.employee_a, state="inactive"))

        # 2. save_policy() with unsupported state is rejected
        with self.assertRaises(ValidationError):
            self.Policy.save_policy(self.payload("Initial Unknown", self.employee_a, state="unsupported"))

        # 3. save_policy() with state='draft' creates Draft policy without assignments
        draft_res = self.Policy.save_policy(self.payload("Initial Draft", self.employee_a, state="draft"))
        draft_policy = self.Policy.browse(draft_res["id"])
        self.assertEqual(draft_policy.state, "draft")
        self.assertTrue(draft_policy.active)
        self.assertFalse(draft_policy.assignment_ids)

        # 4. save_policy() with state='active' succeeds (creates Draft first, attaches lines, then activates)
        active_res = self.Policy.save_policy(self.payload("Initial Active", self.employee_a, state="active"))
        active_policy = self.Policy.browse(active_res["id"])
        self.assertEqual(active_policy.state, "active")
        self.assertTrue(active_policy.active)
        self.assertTrue(active_policy.assignment_ids)



