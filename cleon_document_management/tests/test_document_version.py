# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestDocumentVersionUnlink(TransactionCase):
    def test_unlink_version_when_attachment_already_removed(self):
        folder = self.env["doc.folder"].create(
            {
                "folder_name": "Version unlink folder",
                "folder_type": "organizational",
            }
        )
        document_type = self.env["doc.document.type"].create(
            {"name": "Version unlink type", "category": "other"}
        )
        attachment = self.env["ir.attachment"].create(
            {
                "name": "policy.pdf",
                "datas": b"UEs=",
                "mimetype": "application/pdf",
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": "policy.pdf",
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
                "state": "approved",
            }
        )
        version_attachment = attachment.copy({"name": "policy-v1.pdf"})
        version = self.env["doc.document.version"].create(
            {
                "document_id": document.id,
                "version_number": 1,
                "file_attachment": version_attachment.id,
            }
        )
        version_attachment.write({"res_model": version._name, "res_id": version.id})
        version.unlink()
        self.assertFalse(version.exists())
        self.assertFalse(version_attachment.exists())
        self.assertTrue(document.exists())
        self.assertTrue(attachment.exists())
