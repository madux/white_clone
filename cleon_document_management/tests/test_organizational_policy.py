# -*- coding: utf-8 -*-
from odoo.exceptions import UserError
from odoo.tests import tagged
from odoo.tests.common import TransactionCase

from odoo.addons.cleon_document_management.controllers.organizational_files import (
    OrganizationalFilesController,
)


@tagged("post_install", "-at_install")
class TestOrganizationalPolicy(TransactionCase):
    def setUp(self):
        super().setUp()
        self.document_type = self.env["doc.document.type"].create(
            {"name": "Org policy type", "category": "other"}
        )
        self.library_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Policy library root",
                "folder_type": "organizational",
                "folder_kind": "folder",
            }
        )
        self.policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Existing policy folder",
                "folder_type": "organizational",
                "folder_kind": "policy",
            }
        )

    def _document(self, name, folder=None):
        attachment = self.env["ir.attachment"].create(
            {
                "name": name,
                "datas": b"UEs=",
                "mimetype": "application/pdf",
            }
        )
        return self.env["doc.document"].create(
            {
                "name": name,
                "folder_id": (folder or self.library_folder).id,
                "document_type_id": self.document_type.id,
                "attachment_id": attachment.id,
                "state": "approved",
            }
        )

    def test_eligible_for_policy_adoption(self):
        candidate = self._document("Remote work policy.pdf")
        blocked_in_policy_folder = self._document(
            "Inside policy folder.pdf", folder=self.policy_folder
        )
        stale_flag = self._document("02_White_Cleon_Information_Security_Policy.pdf")
        stale_flag.write({"is_policy": True})
        self.assertTrue(candidate._eligible_for_policy_adoption())
        self.assertFalse(blocked_in_policy_folder._eligible_for_policy_adoption())
        self.assertTrue(stale_flag._eligible_for_policy_adoption())

    def test_policy_registry_without_primary_document(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Empty policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
            }
        )
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Empty policy",
                "folder_id": folder.id,
                "lifecycle_status": "draft",
            }
        )
        self.assertFalse(policy.document_id)

    def test_create_policy_folder_registers_documents(self):
        first = self._document("Code of Conduct.pdf")
        second = self._document("Ethics policy addendum.pdf")
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Code of Conduct",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        documents = first | second
        documents.write(
            {
                "folder_id": folder.id,
                "is_policy": True,
                "policy_visibility": "employees",
            }
        )
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Code of Conduct",
                "folder_id": folder.id,
                "document_id": first.id,
                "lifecycle_status": "draft",
                "policy_visibility": "employees",
            }
        )
        self.assertEqual(policy.folder_id, folder)
        self.assertTrue(first.is_policy)
        self.assertTrue(second.is_policy)
        self.assertEqual(first.folder_id, folder)
        duplicate = self.env["doc.organizational.policy"].find_duplicate_by_name(
            "code   of conduct"
        )
        self.assertEqual(duplicate, policy)

    def test_duplicate_name_ignores_recycled_policy_folder(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Security Policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
            }
        )
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Security Policy",
                "folder_id": folder.id,
                "lifecycle_status": "draft",
            }
        )
        Policy = self.env["doc.organizational.policy"]
        self.assertTrue(Policy.find_duplicate_by_name("Security Policy"))
        folder.action_move_to_recycle_bin()
        self.assertFalse(Policy.find_duplicate_by_name("Security Policy"))

    def test_discovery_excludes_registered_and_policy_folder_docs(self):
        registered_doc = self._document("Registered policy.pdf")
        self.env["doc.organizational.policy"].create(
            {
                "name": "Registered policy",
                "folder_id": self.policy_folder.id,
                "document_id": registered_doc.id,
                "lifecycle_status": "draft",
            }
        )
        in_policy_folder = self._document(
            "Nested policy.pdf", folder=self.policy_folder
        )
        match = self._document("Vacation policy.pdf")
        security = self._document("Acme Security Policy.pdf")

        self.assertTrue(
            OrganizationalFilesController._document_matches_policy_name_query(
                security, "Security Policy"
            )
        )
        underscored = self._document("02_White_Cleon_Information_Security_Policy.pdf")
        self.assertTrue(
            OrganizationalFilesController._document_matches_policy_name_query(
                underscored, "Security Policy"
            )
        )
        self.assertTrue(
            OrganizationalFilesController._document_matches_policy_name_query(
                match, "Vacation policy"
            )
        )
        self.assertFalse(
            OrganizationalFilesController._document_matches_policy_name_query(
                match, "Security Policy"
            )
        )
        domain = OrganizationalFilesController._policy_suggestion_base_domain(
            registered_doc.ids, adopt_mode=False
        ) + OrganizationalFilesController._policy_suggestion_name_domain("policy")
        found = self.env["doc.document"].search(domain)
        self.assertIn(match, found)
        self.assertNotIn(registered_doc, found)
        self.assertNotIn(in_policy_folder, found)

    def test_upload_in_policy_folder_marks_document_as_policy(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "HR Policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        self.env["doc.organizational.policy"].create(
            {
                "name": "HR Policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "draft",
            }
        )
        doc = self._document("Handbook.pdf", folder=policy_folder)
        policy = self.env["doc.organizational.policy"].search(
            [("folder_id", "=", policy_folder.id)],
            limit=1,
        )
        self.assertTrue(doc.is_policy)
        self.assertEqual(policy.document_id, doc)
        self.assertEqual(doc.state, "draft")
        self.assertFalse(doc.active)
        self.assertEqual(doc.distribution_status, "deactivated")

    def test_policy_activation_required_before_document_activation(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Safety policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Safety policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "draft",
            }
        )
        doc = self._document("Safety handbook.pdf", folder=policy_folder)
        self.assertEqual(doc.state, "draft")
        with self.assertRaises(UserError):
            doc.action_restore()
        policy.write({"lifecycle_status": "active"})
        doc.action_restore()
        doc.invalidate_recordset()
        self.assertTrue(doc.active)
        self.assertEqual(doc.distribution_status, "active")
        doc.action_deactivate()
        doc.invalidate_recordset()
        self.assertFalse(doc.active)
        policy.write({"lifecycle_status": "draft"})
        doc.invalidate_recordset()
        self.assertEqual(doc.state, "draft")
        self.assertFalse(doc.active)

    def test_draft_policy_blocks_operational_document_actions(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Blocked policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        self.env["doc.organizational.policy"].create(
            {
                "name": "Blocked policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "draft",
            }
        )
        doc = self._document("Blocked handbook.pdf", folder=policy_folder)
        with self.assertRaises(UserError):
            doc.action_move_to_recycle_bin()
        with self.assertRaises(UserError):
            doc.action_archive()
        doc.action_toggle_favorite()
        doc.action_toggle_pin()

    def test_only_policy_documents_assignable_to_employees(self):
        library_doc = self._document("General handbook.pdf")
        policy_doc = self._document("Security policy.pdf")
        policy_doc.write({"is_policy": True})
        policy_doc.action_restore()
        self.assertFalse(library_doc._assignable_as_employee_policy())
        self.assertTrue(policy_doc._assignable_as_employee_policy())

    def test_browse_library_lists_unrelated_policy_name(self):
        handbook = self._document("Employee handbook.pdf")
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Vacation Policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        self.env["doc.organizational.policy"].create(
            {
                "name": "Vacation Policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "draft",
            }
        )
        documents = OrganizationalFilesController._search_policy_suggestion_documents(
            self.env,
            "",
            adopt_mode=True,
            adopt_folder_id=policy_folder.id,
            browse_library=True,
        )
        items = OrganizationalFilesController._build_policy_suggestion_items(
            self.env,
            documents,
            "",
            adopt_mode=True,
            user=self.env.user,
            max_items=200,
            require_name_match=False,
        )
        names = [item["name"] for item in items]
        self.assertIn(handbook.name, names)

    def test_adopt_mode_suggests_security_policy_filename(self):
        security_doc = self._document(
            "02_White_Cleon_Information_Security_Policy.pdf"
        )
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Security Policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "parent_id": self.library_folder.id,
            }
        )
        self.env["doc.organizational.policy"].create(
            {
                "name": "Security Policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "draft",
            }
        )
        documents = OrganizationalFilesController._search_policy_suggestion_documents(
            self.env,
            "Security Policy",
            adopt_mode=True,
            adopt_folder_id=policy_folder.id,
        )
        items = OrganizationalFilesController._build_policy_suggestion_items(
            self.env,
            documents,
            "Security Policy",
            adopt_mode=True,
            user=self.env.user,
        )
        names = [item["name"] for item in items]
        self.assertIn(security_doc.name, names)

    def test_policy_scratch_draft_links_editor_session(self):
        hr_document, editor_document = self.env["doc.document"].create_policy_scratch_draft(
            self.policy_folder,
            "Custom conduct policy",
            self.document_type.id,
        )
        self.assertTrue(hr_document.is_policy)
        self.assertEqual(hr_document.folder_id, self.policy_folder)
        self.assertEqual(hr_document.editor_source, "policy_scratch")
        self.assertEqual(hr_document.policy_editor_document_id, editor_document)
        self.assertEqual(editor_document.hr_document_id, hr_document)
        self.assertTrue(editor_document.document_json)

    def _library_user(self, login):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": f"Org library {login}",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        return self.env["res.users"].create(
            {
                "name": login,
                "login": login,
                "employee_files_role_ids": [(6, 0, role.ids)],
                "groups_id": [
                    (
                        6,
                        0,
                        [
                            self.env.ref("base.group_user").id,
                            self.env.ref(
                                "cleon_document_management.group_document_user"
                            ).id,
                        ],
                    )
                ],
            }
        )

    def test_hr_only_policy_hidden_from_library_user(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "HR confidential",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "access_scope": "all_staff",
            }
        )
        doc = self._document("Confidential handbook.pdf", folder=policy_folder)
        self.env["doc.organizational.policy"].create(
            {
                "name": "HR confidential",
                "folder_id": policy_folder.id,
                "document_id": doc.id,
                "lifecycle_status": "active",
                "policy_visibility": "hr_only",
            }
        )
        doc.write({"is_policy": True, "policy_visibility": "hr_only"})
        reader = self._library_user("org_hr_only_reader")
        self.assertFalse(doc.with_user(reader)._organizational_user_can_access(reader))
        self.assertTrue(
            doc.with_user(self.env.user)._organizational_user_can_access(self.env.user)
        )

    def test_policy_suggestions_exclude_documents_in_policy_folders(self):
        nested = self._document("Only in policy folder.pdf", folder=self.policy_folder)
        documents = OrganizationalFilesController._search_policy_suggestion_documents(
            self.env,
            "",
            adopt_mode=True,
            browse_library=True,
        )
        self.assertNotIn(nested, documents)

    def test_draft_policy_hidden_from_library_user(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Draft only policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "access_scope": "all_staff",
            }
        )
        doc = self._document("Draft policy file.pdf", folder=policy_folder)
        self.env["doc.organizational.policy"].create(
            {
                "name": "Draft only policy",
                "folder_id": policy_folder.id,
                "document_id": doc.id,
                "lifecycle_status": "draft",
                "policy_visibility": "employees",
            }
        )
        doc.write({"is_policy": True, "policy_visibility": "employees"})
        reader = self._library_user("org_draft_reader")
        self.assertFalse(policy_folder.with_user(reader)._user_can_access(reader))
        self.assertFalse(doc.with_user(reader)._organizational_user_can_access(reader))

    def test_activate_policy_visible_to_library_user(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Published policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
                "access_scope": "all_staff",
            }
        )
        doc = self._document("Published policy.pdf", folder=policy_folder)
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Published policy",
                "folder_id": policy_folder.id,
                "document_id": doc.id,
                "lifecycle_status": "active",
                "policy_visibility": "employees",
            }
        )
        doc.write({"is_policy": True, "policy_visibility": "employees"})
        reader = self._library_user("org_active_reader")
        self.assertTrue(policy_folder.with_user(reader)._user_can_access(reader))
        self.assertTrue(doc.with_user(reader)._organizational_user_can_access(reader))
        policy.write({"lifecycle_status": "draft"})
        self.assertFalse(doc.with_user(reader)._organizational_user_can_access(reader))

    def test_policy_registry_user_can_view_respects_hr_only(self):
        policy_folder = self.env["doc.folder"].create(
            {
                "folder_name": "Pay policy",
                "folder_type": "organizational",
                "folder_kind": "policy",
            }
        )
        policy = self.env["doc.organizational.policy"].create(
            {
                "name": "Pay policy",
                "folder_id": policy_folder.id,
                "lifecycle_status": "active",
                "policy_visibility": "hr_only",
            }
        )
        reader = self._library_user("org_policy_tab_reader")
        self.assertFalse(policy.with_user(reader).user_can_view(reader))
        self.assertTrue(policy.user_can_view(self.env.user))

    def test_policy_editor_pdf_sync_updates_attachment(self):
        hr_document, editor_document = self.env["doc.document"].create_policy_scratch_draft(
            self.policy_folder,
            "Sync test policy",
            self.document_type.id,
        )
        editor_document.action_autosave(
            editor_document.document_json or "{}",
            "Line one\nLine two",
        )
        synced = hr_document._sync_policy_editor_pdf("Line one\nLine two")
        self.assertTrue(synced)
        self.assertEqual(hr_document.attachment_id.mimetype, "application/pdf")
        self.assertTrue(hr_document.attachment_id.datas)
