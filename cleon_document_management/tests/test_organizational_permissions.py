# -*- coding: utf-8 -*-
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestOrganizationalPermissions(TransactionCase):
    def setUp(self):
        super().setUp()
        self.perm = self.env["doc.organizational.files.permission"]
        self.user = self.env.ref("base.user_admin")

    def test_platform_admin_has_full_org_actions(self):
        payload = self.perm.serialize_user_permissions(self.user)
        self.assertTrue(payload["can_access_org_library"])
        self.assertTrue(payload["can_create_folder"])
        self.assertTrue(payload["actions"]["document_manage"])

    def test_role_org_create_folder_flag(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org creator test",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_create_folder": True,
                "org_access_library": True,
            }
        )
        user = self.env["res.users"].create(
            {
                "name": "Org Creator",
                "login": "org_creator_test",
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
        self.assertTrue(self.perm.user_can_create_folder(user))
        self.assertTrue(self.perm.user_can_access_org_library(user))

    def _document_user(self, login, role):
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

    def test_org_library_role_does_not_grant_employee_files(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org library only",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        user = self._document_user("org_library_only_test", role)
        ef_perm = self.env["doc.employee.files.permission"]
        self.assertTrue(self.perm.user_can_access_org_library(user))
        self.assertFalse(ef_perm.user_can_access_ef_home(user))
        self.assertFalse(self.perm.user_can_create_folder(user))

    def test_unassigned_document_user_cannot_access_org_library(self):
        user = self.env["res.users"].create(
            {
                "name": "No custom role",
                "login": "org_no_role_test",
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
        self.assertFalse(self.perm.user_can_access_org_library(user))

    def test_org_library_user_can_access_workspace_activity(self):
        from odoo.addons.cleon_document_management.controllers.access import (
            user_can_access_workspace_activity,
            user_is_document_manager,
        )

        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org library activity",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        user = self._document_user("org_library_activity_test", role)
        self.assertTrue(user_can_access_workspace_activity(user, self.env))
        self.assertFalse(user_is_document_manager(user, self.env))

    def test_workspace_activity_sort_accepts_mixed_timestamp_types(self):
        from datetime import datetime

        from odoo.addons.cleon_document_management.controllers.nextapp import (
            _activity_occurred_at_text,
        )

        items = [
            {"id": 1, "occurred_at": "2026-09-19 12:00:00"},
            {"id": 2, "occurred_at": datetime(2026, 9, 19, 13, 0, 0)},
            {"id": 3, "occurred_at": False},
        ]
        items.sort(
            key=lambda item: (
                _activity_occurred_at_text(item.get("occurred_at")),
                item.get("id") or 0,
            ),
            reverse=True,
        )
        self.assertEqual(len(items), 3)
        for item in items:
            self.assertIsInstance(
                _activity_occurred_at_text(item.get("occurred_at")), str
            )

    def test_library_only_cannot_suggest_folder_description(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org library no suggest",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        user = self._document_user("org_library_no_suggest", role)
        self.assertFalse(self.perm.user_can_suggest_folder_description(user))

    def test_library_only_cannot_upload_org_documents(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org library no upload",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        user = self._document_user("org_library_no_upload", role)
        self.assertTrue(self.perm.user_can_access_org_library(user))
        self.assertFalse(self.perm.user_can_upload_org(user))
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Library only org folder",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Library only type", "category": "other"}
        )
        with self.assertRaises(AccessError):
            self.env["doc.document"].with_user(user).create(
                {
                    "name": "Unauthorized upload",
                    "folder_id": folder.id,
                    "document_type_id": document_type.id,
                }
            )

    def test_org_upload_role_can_create_org_document(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org upload allowed",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
                "org_upload": True,
            }
        )
        user = self._document_user("org_upload_allowed", role)
        self.assertTrue(self.perm.user_can_upload_org(user))
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Upload allowed org folder",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Upload allowed type", "category": "other"}
        )
        document = self.env["doc.document"].with_user(user).create(
            {
                "name": "Authorized upload",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
            }
        )
        self.assertTrue(document.exists())

    def test_org_upload_skips_document_type_approval(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Org no-approval folder",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {
                "name": "Approved type still ack-only for org",
                "category": "other",
                "require_upload_approval": True,
                "approver_ids": [(6, 0, [self.user.id])],
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Org policy",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
            }
        )
        self.assertEqual(document.approval_state, "not_required")
        self.assertEqual(document.state, "approved")
        self.assertFalse(document.approval_ids)

    def test_employee_acknowledgement_appears_in_employee_file_activity(self):
        user = self.env["res.users"].create(
            {
                "name": "Ack Activity User",
                "login": "ack_activity_employee_test",
                "company_id": self.env.company.id,
                "groups_id": [(4, self.env.ref("base.group_user").id)],
            }
        )
        employee = self.env["hr.employee"].create(
            {
                "name": "Ack Activity Employee",
                "user_id": user.id,
                "company_id": self.env.company.id,
            }
        )
        employee_file = self.env["doc.employee.file"].create(
            {
                "employee_id": employee.id,
                "company_id": self.env.company.id,
            }
        )
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Ack activity folder",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Ack activity type", "category": "other"}
        )
        document = self.env["doc.document"].create(
            {
                "name": "Workplace Conduct Policy",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "state": "approved",
            }
        )
        self.env["doc.document.acknowledgement"].create(
            {
                "document_id": document.id,
                "user_id": user.id,
            }
        )
        events = self.env["doc.employee.files.service"].list_employee_file_activity(
            employee_file
        )
        ack_events = [event for event in events if event["kind"] == "acknowledgement"]
        self.assertTrue(ack_events)
        self.assertIn("Workplace Conduct Policy", ack_events[0]["message"])
        self.assertEqual(ack_events[0]["document_id"], document.id)
        self.assertEqual(ack_events[0]["employee_id"], employee.id)

    def test_create_folder_role_can_suggest_folder_description(self):
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org suggest description",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
                "org_create_folder": True,
            }
        )
        user = self._document_user("org_suggest_description", role)
        self.assertTrue(self.perm.user_can_suggest_folder_description(user))

    def _org_folder(self, name="Lock spec folder"):
        return self.env["doc.folder"].create(
            {
                "folder_name": name,
                "folder_type": "organizational",
            }
        )

    def test_lock_blocks_folder_modifications_and_uploads(self):
        folder = self._org_folder()
        folder.action_lock()
        self.assertTrue(folder.is_locked)
        with self.assertRaises(UserError):
            folder.write({"folder_name": "Renamed while locked"})
        with self.assertRaises(UserError):
            folder.write({"description": "New description"})
        with self.assertRaises(UserError):
            folder.write({"color_hex": "#ec4899"})
        with self.assertRaises(UserError):
            folder.write({"access_scope": "private"})
        document_type = self.env["doc.document.type"].create(
            {"name": "Lock upload type", "category": "other"}
        )
        with self.assertRaises(UserError):
            self.env["doc.document"].create(
                {
                    "name": "Should not upload",
                    "folder_id": folder.id,
                    "document_type_id": document_type.id,
                }
            )

    def test_lock_allows_view_search_favorite_and_archive(self):
        folder = self._org_folder("Searchable locked folder")
        folder.action_lock()
        found = self.env["doc.folder"].search(
            [("folder_name", "=", "Searchable locked folder")]
        )
        self.assertIn(folder, found)
        folder.action_toggle_favorite()
        self.assertIn(self.env.user, folder.favorite_user_ids)
        folder.action_archive()
        self.assertTrue(folder.is_locked)
        self.assertEqual(folder.distribution_status, "archived")
        self.assertFalse(folder.active)

    def test_lock_does_not_mark_documents_locked(self):
        folder = self._org_folder()
        document_type = self.env["doc.document.type"].create(
            {"name": "Existing lock type", "category": "other"}
        )
        document = self.env["doc.document"].create(
            {
                "name": "Already inside",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
            }
        )
        folder.action_lock()
        self.assertFalse(document.is_locked)
        self.assertTrue(document.active)

    def test_duplicate_with_documents_blocked_while_locked(self):
        folder = self._org_folder()
        document_type = self.env["doc.document.type"].create(
            {"name": "Dup lock type", "category": "other"}
        )
        self.env["doc.document"].create(
            {
                "name": "Source doc",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
            }
        )
        folder.action_lock()
        with self.assertRaises(UserError):
            folder.action_duplicate(include_documents=True)
        copy = folder.action_duplicate(include_documents=False)
        self.assertTrue(copy.exists())
        self.assertFalse(copy.is_locked)
        self.assertEqual(copy.document_count, 0)

    def test_lock_unlock_require_manage_folders_and_write_audit(self):
        folder = self._org_folder()
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org library lock deny",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        user = self._document_user("org_lock_denied", role)
        with self.assertRaises(AccessError):
            folder.with_user(user).action_lock()
        folder.action_lock()
        lock_audit = self.env["doc.folder.lock.audit"].search(
            [("folder_id", "=", folder.id), ("action", "=", "lock")]
        )
        self.assertEqual(len(lock_audit), 1)
        self.assertEqual(lock_audit.actor_id, self.env.user)
        self.assertTrue(lock_audit.occurred_at)
        folder.action_unlock()
        unlock_audit = self.env["doc.folder.lock.audit"].search(
            [("folder_id", "=", folder.id), ("action", "=", "unlock")]
        )
        self.assertEqual(len(unlock_audit), 1)
        self.assertEqual(unlock_audit.actor_id, self.env.user)
        self.assertNotEqual(lock_audit.id, unlock_audit.id)

    def test_manage_folders_role_can_lock_and_unlock(self):
        folder = self._org_folder()
        role = self.env["doc.employee.files.role"].create(
            {
                "name": "Org lock manager",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
                "org_manage_folders": True,
            }
        )
        user = self._document_user("org_lock_allowed", role)
        folder.with_user(user).action_lock()
        self.assertTrue(folder.is_locked)
        folder.with_user(user).action_unlock()
        self.assertFalse(folder.is_locked)

    def test_subfolder_cannot_exceed_parent_admin_only_scope(self):
        parent = self._org_folder("Admin only parent")
        parent.write({"access_scope": "admin_only"})
        child = self.env["doc.folder"].create(
            {
                "folder_name": "Nested admin folder",
                "folder_type": "organizational",
                "parent_id": parent.id,
                "access_scope": "admin_only",
            }
        )
        self.assertEqual(child.access_scope, "admin_only")
        with self.assertRaises(ValidationError):
            child.write({"access_scope": "all_staff"})
        grandchild = self.env["doc.folder"].create(
            {
                "folder_name": "Nested grandchild",
                "folder_type": "organizational",
                "parent_id": child.id,
                "access_scope": "admin_only",
            }
        )
        with self.assertRaises(ValidationError):
            grandchild.write({"access_scope": "all_staff"})

    def test_tightening_parent_scope_clamps_open_children(self):
        parent = self._org_folder("Open parent")
        child = self.env["doc.folder"].create(
            {
                "folder_name": "Open child",
                "folder_type": "organizational",
                "parent_id": parent.id,
                "access_scope": "all_staff",
            }
        )
        grandchild = self.env["doc.folder"].create(
            {
                "folder_name": "Open grandchild",
                "folder_type": "organizational",
                "parent_id": child.id,
                "access_scope": "all_staff",
            }
        )
        parent.write({"access_scope": "admin_only"})
        self.assertEqual(child.access_scope, "admin_only")
        self.assertEqual(grandchild.access_scope, "admin_only")

    def test_private_document_override_denies_other_users(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Public org folder",
                "folder_type": "organizational",
                "access_scope": "all_staff",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Org access type", "category": "other"}
        )
        owner = self._document_user(
            "private_doc_owner",
            self.env["doc.employee.files.role"].create(
                {
                    "name": "Org uploader",
                    "company_id": self.env.company.id,
                    "employee_scope": "all",
                    "org_access_library": True,
                    "org_upload": True,
                }
            ),
        )
        other = self._document_user(
            "private_doc_other",
            self.env["doc.employee.files.role"].create(
                {
                    "name": "Org viewer",
                    "company_id": self.env.company.id,
                    "employee_scope": "all",
                    "org_access_library": True,
                }
            ),
        )
        document = self.env["doc.document"].with_user(owner).create(
            {
                "name": "Secret.pdf",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "owner_id": owner.id,
            }
        )
        document.write(
            {
                "org_use_folder_access": False,
                "org_access_scope": "private",
            }
        )
        self.assertTrue(document.with_user(owner)._organizational_user_can_access(owner))
        self.assertFalse(
            document.with_user(other)._organizational_user_can_access(other)
        )
        visible = document.with_user(other).filter_for_organizational_access(other)
        self.assertFalse(visible)

    def test_document_access_change_creates_object_audit(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Audit access folder",
                "folder_type": "organizational",
                "access_scope": "all_staff",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Audit access type", "category": "other"}
        )
        document = self.env["doc.document"].create(
            {
                "name": "Audited.pdf",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
            }
        )
        previous = document._organizational_access_summary()
        document.write(
            {
                "org_use_folder_access": False,
                "org_access_scope": "private",
            }
        )
        document.action_record_organizational_access_audit(previous)
        audit = self.env["doc.object.audit"].search(
            [
                ("res_model", "=", "doc.document"),
                ("res_id", "=", document.id),
                ("action", "=", "access"),
            ]
        )
        self.assertEqual(len(audit), 1)
        self.assertIn("Private", audit.summary)

    def test_company_owned_folder_delegate_access(self):
        config = self.env["doc.employee.files.config"].get_for_company()
        uploader_role = self.env["doc.employee.files.role"].create(
            {
                "name": "Company owned uploader",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
                "org_create_folder": True,
            }
        )
        viewer_role = self.env["doc.employee.files.role"].create(
            {
                "name": "Company owned viewer",
                "company_id": self.env.company.id,
                "employee_scope": "all",
                "org_access_library": True,
            }
        )
        uploader = self._document_user("company_owned_uploader", uploader_role)
        delegate = self._document_user("company_owned_delegate", viewer_role)
        outsider = self._document_user("company_owned_outsider", viewer_role)
        config.write({"org_company_owned_user_ids": [(6, 0, delegate.ids)]})
        folder = (
            self.env["doc.folder"]
            .with_user(uploader)
            .create(
                {
                    "folder_name": "Company owned folder",
                    "folder_type": "organizational",
                    "access_scope": "company_owned",
                }
            )
        )
        self.assertTrue(folder.with_user(uploader)._user_can_access(uploader))
        self.assertTrue(folder.with_user(delegate)._user_can_access(delegate))
        self.assertFalse(folder.with_user(outsider)._user_can_access(outsider))


