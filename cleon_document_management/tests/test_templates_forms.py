import json

from odoo.exceptions import UserError, ValidationError
from odoo.tests.common import TransactionCase

from odoo.addons.cleon_document_management.models.template import (
    extract_placeholders,
    validate_upload,
)


class TestTemplatesForms(TransactionCase):
    def _category(self):
        return self.env["doc.template.category"].search([], limit=1) or self.env[
            "doc.template.category"
        ].create({"name": "Legal Documents", "applies_to": "both"})

    def _template(self, kind="template", name="Offer Letter", text=None):
        text = text or "Hello {{Employee Name}} of {{Company Name}}. Date {{Letter Date}}."
        template = self.env["doc.template"].create(
            {
                "name": name,
                "kind": kind,
                "category_id": self._category().id,
                "description": "Test item",
                "status": "ready",
            }
        )
        version = self.env["doc.template.version"].create(
            {
                "template_id": template.id,
                "version_number": 1,
                "extracted_text": text,
                "merge_field_schema": json.dumps(extract_placeholders(text)),
                "extraction_status": "ready",
                "published": True,
            }
        )
        template.current_version_id = version.id
        return template

    def test_seed_categories_exist(self):
        names = self.env["doc.template.category"].search([]).mapped("name")
        self.assertIn("Employment Contracts", names)
        self.assertIn("Leave Forms", names)

    def test_library_search_sort_and_favourite(self):
        first = self._template(name="Alpha NDA")
        second = self._template(name="Leave Policy")
        Template = self.env["doc.template"]
        found = Template.search(Template.library_domain("template", {"q": "nda"}))
        self.assertEqual(found, first)
        second.action_toggle_favourite()
        fav = Template.search(Template.library_domain("template", {"favourite": True}))
        self.assertEqual(fav, second)
        order = Template.library_order("name", "desc")
        listed = Template.search(
            Template.library_domain("template", {}), order=order
        )
        self.assertEqual(listed[0].name, "Leave Policy")

    def test_upload_validation(self):
        validate_upload("offer.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 10)
        with self.assertRaises(ValidationError):
            validate_upload("malware.exe", "application/x-msdownload", 10)
        with self.assertRaises(ValidationError):
            validate_upload("huge.pdf", "application/pdf", 51 * 1024 * 1024)

    def test_generate_does_not_mutate_template(self):
        template = self._template()
        version = template.current_version_id
        original = version.extracted_text
        document = self.env["doc.template.document"].generate_from_template(
            template, extra={"manual.letter_date": "2026-09-08"}, client_token="g1"
        )
        self.assertEqual(version.extracted_text, original)
        self.assertIn("{{Letter Date}}", version.extracted_text)
        self.assertNotEqual(document.id, template.id)
        again = self.env["doc.template.document"].generate_from_template(
            template, extra={"manual.letter_date": "2026-09-08"}, client_token="g1"
        )
        self.assertEqual(document, again)
        self.assertTrue(document.unresolved_list())

    def test_published_version_is_immutable(self):
        template = self._template()
        with self.assertRaises(UserError):
            template.current_version_id.write({"extracted_text": "changed"})

    def test_archive_instead_of_delete_with_documents(self):
        template = self._template()
        self.env["doc.template.document"].generate_from_template(template)
        with self.assertRaises(UserError):
            template.unlink()
        template.action_archive()
        self.assertFalse(template.active)

    def test_assignment_requires_fields_then_confirms(self):
        template = self._template()
        employee = self.env["hr.employee"].search([], limit=1)
        if not employee:
            employee = self.env["hr.employee"].create({"name": "Ada Lovelace"})
        assignment = self.env["doc.template.assignment"].start_assignment(
            template, client_token="a1"
        )
        assignment.action_set_recipients([employee.id])
        with self.assertRaises(ValidationError):
            assignment.action_confirm()
        assignment.action_set_field_values({"manual.letter_date": "2026-09-08"})
        assignment.action_confirm()
        again = self.env["doc.template.assignment"].browse(assignment.id)
        again.action_confirm()
        self.assertEqual(again.status, "confirmed")
        self.assertTrue(again.recipient_ids.document_id)

    def test_form_submit_is_immutable(self):
        form = self._template(kind="form", name="Leave Request")
        submission = self.env["doc.template.submission"].start_or_get_draft(form)
        submission.action_save_draft('{"type":"doc"}', {"reason": "rest"})
        submission.action_submit()
        with self.assertRaises(UserError):
            submission.action_save_draft("{}", {})
        submission.action_review("rejected", "Need dates")
        submission.action_reopen()
        self.assertEqual(submission.status, "draft")
