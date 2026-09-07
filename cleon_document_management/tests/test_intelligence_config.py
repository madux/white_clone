from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestIntelligenceConfig(TransactionCase):
    def test_profile_creates_version_and_blocks_delete(self):
        document_type = self.env["doc.document.type"].create(
            {"name": "Test License", "category": "identity"}
        )
        profile = self.env["doc.intelligence.profile"].create(
            {
                "name": "Test License Profile",
                "document_type_id": document_type.id,
            }
        )
        self.assertTrue(profile.current_version_id)
        self.assertEqual(profile.current_version_id.version, 1)
        with self.assertRaises(UserError):
            profile.unlink()

    def test_new_version_copies_fields(self):
        document_type = self.env["doc.document.type"].create(
            {"name": "Test Passport", "category": "identity"}
        )
        profile = self.env["doc.intelligence.profile"].create(
            {
                "name": "Passport Profile",
                "document_type_id": document_type.id,
            }
        )
        self.env["doc.intelligence.field"].create(
            {
                "version_id": profile.current_version_id.id,
                "name": "Expiry date",
                "key": "expiry_date",
                "field_type": "date",
                "required": True,
            }
        )
        version = profile.action_new_version()
        self.assertEqual(version.version, 2)
        self.assertEqual(profile.current_version_id, version)
        self.assertEqual(version.field_ids.mapped("key"), ["expiry_date"])

    def test_dataset_run_requires_types_and_fields(self):
        document_type = self.env["doc.document.type"].create(
            {"name": "Run Type", "category": "employment"}
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Empty run",
                "source": "organizational",
            }
        )
        with self.assertRaises(ValidationError):
            dataset.action_run()
        dataset.write(
            {
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = dataset.action_run()
        job.state = "queued"
        dataset.state = "queued"
        second = dataset.action_run()
        self.assertEqual(job, second)

    def test_vertical_slice_extracts_contract_fields(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Org Contracts",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Slice Contract", "category": "employment"}
        )
        profile = self.env["doc.intelligence.profile"].create(
            {
                "name": "Slice Contract Profile",
                "document_type_id": document_type.id,
            }
        )
        self.env["doc.intelligence.field"].create(
            {
                "version_id": profile.current_version_id.id,
                "name": "Employee name",
                "key": "employee_name",
                "field_type": "text",
                "required": True,
            }
        )
        document_type.default_profile_id = profile.id
        attachment = self.env["ir.attachment"].create(
            {
                "name": "contract.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Employment Contract\nEmployee name: Jane Doe\nStart date: 2026-01-01",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Jane contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Slice run",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = dataset.action_run()
        self.assertTrue(job.record_ids)
        self.assertEqual(job.record_ids.document_id, document)
        extracted = job.record_ids.field_ids.filtered(
            lambda field: field.key == "employee_name"
        )
        self.assertTrue(extracted)
        self.assertIn("Jane", extracted.value or "")
