from odoo import fields
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
        dataset.action_delete()
        self.assertFalse(dataset.exists())
        self.assertFalse(job.exists())

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

    def test_pdf_native_text_is_extracted(self):
        import fitz

        pdf = fitz.open()
        page = pdf.new_page()
        page.insert_text((72, 72), "Employment Contract\nEmployee name: Ada Lovelace")
        raw = pdf.tobytes()
        pdf.close()
        folder = self.env["doc.folder"].create(
            {"folder_name": "PDF Org", "folder_type": "organizational"}
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "PDF Contract", "category": "employment"}
        )
        profile = self.env["doc.intelligence.profile"].create(
            {
                "name": "PDF Contract Profile",
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
                "name": "contract.pdf",
                "type": "binary",
                "mimetype": "application/pdf",
                "raw": raw,
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Ada contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "PDF run",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = dataset.action_run()
        record = job.record_ids
        self.assertEqual(record.text_source, "native")
        self.assertIn("Ada", record.extracted_text or "")
        extracted = record.field_ids.filtered(lambda field: field.key == "employee_name")
        self.assertIn("Ada", extracted.value or "")

    def test_review_requires_reason_and_blocks_on_issues(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Review Org",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Review Contract", "category": "employment"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "review.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Contract",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Review contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Review dataset",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = self.env["doc.intelligence.job"].create(
            {
                "dataset_id": dataset.id,
                "state": "done",
                "document_count": 1,
                "processed_count": 1,
                "progress": 100,
            }
        )
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": job.id,
                "document_id": document.id,
                "document_type_id": document_type.id,
                "review_status": "needs_review",
                "validation_status": "blocking",
                "document_confidence": 0.4,
            }
        )
        field = self.env["doc.intelligence.extracted.field"].create(
            {
                "record_id": record.id,
                "key": "employee_name",
                "name": "Employee name",
                "required": True,
                "value": "",
            }
        )
        issue = self.env["doc.intelligence.validation.issue"].create(
            {
                "record_id": record.id,
                "field_key": "employee_name",
                "severity": "blocking",
                "message": "Required field is missing.",
            }
        )
        with self.assertRaises(UserError):
            record.action_approve()
        with self.assertRaises(UserError):
            record.action_override("")
        with self.assertRaises(UserError):
            record.action_reject("")
        record.action_correct_field("employee_name", "Jane Doe", "Filled from contract")
        self.assertEqual(field.value, "Jane Doe")
        self.assertTrue(issue.resolved)
        record.action_approve("Looks correct")
        self.assertEqual(record.review_status, "approved")
        self.assertTrue(
            record.review_action_ids.filtered(lambda item: item.action == "correct")
        )
        self.assertTrue(
            record.review_action_ids.filtered(lambda item: item.action == "approve")
        )

    def test_override_requires_reason_and_clears_blocking(self):
        folder = self.env["doc.folder"].create(
            {"folder_name": "Override Org", "folder_type": "organizational"}
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Override Type", "category": "employment"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "override.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Contract",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Override doc",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Override dataset",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = self.env["doc.intelligence.job"].create(
            {"dataset_id": dataset.id, "state": "done"}
        )
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": job.id,
                "document_id": document.id,
                "review_status": "needs_review",
                "validation_status": "blocking",
            }
        )
        self.env["doc.intelligence.validation.issue"].create(
            {
                "record_id": record.id,
                "severity": "blocking",
                "message": "Low confidence",
            }
        )
        record.action_override("Human confirmed the scanned copy")
        self.assertEqual(record.review_status, "overridden")
        self.assertFalse(record._unresolved_blocking())

    def test_overview_metrics_and_attention_from_reviewed_records(self):
        folder = self.env["doc.folder"].create(
            {"folder_name": "Overview Org", "folder_type": "organizational"}
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Overview Contract", "category": "employment"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "overview.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Contract",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Overview contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Overview dataset",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["end_date"]',
            }
        )
        job = self.env["doc.intelligence.job"].create(
            {
                "dataset_id": dataset.id,
                "state": "failed",
                "error_message": "No source documents matched this dataset.",
            }
        )
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": job.id,
                "document_id": document.id,
                "review_status": "approved",
                "validation_status": "ok",
                "classification_confidence": 0.9,
            }
        )
        self.env["doc.intelligence.extracted.field"].create(
            {
                "record_id": record.id,
                "key": "end_date",
                "name": "End date",
                "value": "2099-01-15",
            }
        )
        with self.assertRaises(UserError):
            job.action_pause()
        overview = self.env["doc.intelligence.job"].overview_data()
        self.assertEqual(overview["metrics"]["extraction_source"], "reviewed")
        self.assertEqual(overview["metrics"]["extraction_accuracy"], 100.0)
        self.assertEqual(overview["metrics"]["classification_source"], "estimated")
        self.assertTrue(overview["attention"]["failed"])
        self.assertFalse(overview["attention"]["expiring"])
        job.state = "queued"
        job.action_pause()
        self.assertEqual(job.state, "paused")
        job.action_resume()
        self.assertEqual(job.state, "queued")

    def test_audit_event_logs_review_and_query_fields(self):
        event = self.env["doc.intelligence.audit.event"].log_event(
            "query",
            "asked",
            detail="Which contracts expire?",
            after="Insufficient evidence.",
        )
        self.assertEqual(event.user_id, self.env.user)
        self.assertEqual(event.to_api()["category"], "query")
        folder = self.env["doc.folder"].create(
            {"folder_name": "Audit Org", "folder_type": "organizational"}
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Audit Type", "category": "employment"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "audit.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Contract",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Audit contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Audit dataset",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["employee_name"]',
            }
        )
        job = self.env["doc.intelligence.job"].create(
            {"dataset_id": dataset.id, "state": "needs_review"}
        )
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": job.id,
                "document_id": document.id,
                "review_status": "needs_review",
            }
        )
        record.action_reject("Incorrect document")
        reviews = self.env["doc.intelligence.audit.event"].search(
            [("category", "=", "review"), ("action", "=", "reject")]
        )
        self.assertTrue(reviews)
        self.assertIn("Incorrect", reviews[0].detail)

    def test_structured_ask_uses_approved_fields(self):
        from datetime import timedelta

        from odoo.addons.cleon_document_management.models.intelligence_ask import (
            answer_structured,
            parse_intent,
        )

        self.assertEqual(
            parse_intent("Which contracts expire in the next 60 days?")["kind"],
            "expiring",
        )
        self.assertEqual(
            parse_intent("Show contracts with no notice period.")["kind"],
            "missing_field",
        )
        self.assertEqual(
            parse_intent("Which salaries fall outside the configured band?")["kind"],
            "unsupported",
        )
        folder = self.env["doc.folder"].create(
            {"folder_name": "Ask Org", "folder_type": "organizational"}
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Ask Contract", "category": "employment"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "ask.txt",
                "type": "binary",
                "mimetype": "text/plain",
                "raw": b"Contract",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "Ask contract",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
            }
        )
        dataset = self.env["doc.intelligence.dataset"].create(
            {
                "name": "Ask dataset",
                "source": "organizational",
                "document_type_ids": [(6, 0, [document_type.id])],
                "field_keys_json": '["end_date","notice_period"]',
            }
        )
        job = self.env["doc.intelligence.job"].create(
            {"dataset_id": dataset.id, "state": "completed"}
        )
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": job.id,
                "document_id": document.id,
                "review_status": "approved",
            }
        )
        soon = fields.Date.today() + timedelta(days=10)
        self.env["doc.intelligence.extracted.field"].create(
            [
                {
                    "record_id": record.id,
                    "key": "end_date",
                    "name": "End date",
                    "value": str(soon),
                },
                {
                    "record_id": record.id,
                    "key": "notice_period",
                    "name": "Notice period",
                    "value": "",
                },
            ]
        )
        expiring = answer_structured(
            self.env, "Which contracts expire in the next 60 days?"
        )
        self.assertTrue(expiring["fact_based"])
        self.assertFalse(expiring["insufficient_evidence"])
        self.assertIn("Ask contract", expiring["answer"])
        missing = answer_structured(
            self.env, "Show contracts with no notice period."
        )
        self.assertIn("Notice", missing["answer"])
        salary = answer_structured(
            self.env, "Which salaries fall outside the configured band?"
        )
        self.assertTrue(salary["insufficient_evidence"])
        self.assertIn("pay-band", salary["answer"])

    def test_conversation_stores_user_and_assistant_turns(self):
        conversation = self.env["doc.intelligence.conversation"].create(
            {"name": "New conversation"}
        )
        payload = conversation.action_ask(
            "Which salaries fall outside the configured band?"
        )
        self.assertEqual(len(payload["messages"]), 2)
        self.assertEqual(payload["messages"][0]["role"], "user")
        self.assertEqual(payload["messages"][1]["role"], "assistant")
        self.assertTrue(payload["messages"][1]["insufficient_evidence"])
        self.assertNotEqual(
            payload["name"],
            "Which salaries fall outside the configured band?",
        )
        self.assertLessEqual(len(payload["name"]), 48)
        conversation.action_delete()
        self.assertFalse(conversation.exists())

    def test_conversation_title_helpers_stay_short(self):
        from odoo.addons.cleon_document_management.models.intelligence_groq import (
            fallback_conversation_title,
            sanitize_conversation_title,
            strip_reference_sections,
        )

        question = "Which contracts expire in the next 90 days?"
        self.assertEqual(
            fallback_conversation_title(question),
            "Contracts expire days",
        )
        self.assertEqual(
            sanitize_conversation_title('"Contract expiries"', question),
            "Contract expiries",
        )
        self.assertFalse(sanitize_conversation_title(question, question))
        self.assertEqual(
            strip_reference_sections("Hello\n\nReferences:\n- Doc A"),
            "Hello",
        )
