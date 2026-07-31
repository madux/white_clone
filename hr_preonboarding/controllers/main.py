# -*- coding: utf-8 -*-
import base64

from odoo import http
from odoo.http import request


class OfferDocumentController(http.Controller):

    def _get_document(self, document_id, access_token):
        """Fetch the offer.document record with sudo, validating the
        access token so this works for anonymous/public users without
        exposing other records.
        """
        document = request.env["offer.document"].sudo().browse(document_id)
        if not document.exists():
            return None
        if not access_token or document.access_token != access_token:
            return None
        return document

    @http.route(
        "/offer-document/<int:document_id>/view",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def offer_document_view(self, document_id, access_token=None, **kwargs):
        document = self._get_document(document_id, access_token)
        if not document:
            return request.render(
                "hr_preonboarding.offer_document_invalid_link", {}
            )
        return request.render(
            "hr_preonboarding.offer_document_upload_page",
            {
                "document": document,
                "access_token": access_token,
            },
        )

    @http.route(
        "/offer-document/<int:document_id>/submit",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=True,
    )
    def offer_document_submit(self, document_id, access_token=None, **post):
        document = self._get_document(document_id, access_token)
        if not document:
            return request.render(
                "hr_preonboarding.offer_document_invalid_link", {}
            )

        uploaded_file = request.httprequest.files.get("document")
        if not uploaded_file or not uploaded_file.filename:
            return request.render(
                "hr_preonboarding.offer_document_upload_page",
                {
                    "document": document,
                    "access_token": access_token,
                    "error": "Please choose a file before submitting.",
                },
            )

        file_content = uploaded_file.read()
        document.with_context(skip_auto_upload_state=True).action_mark_uploaded(
            file_data=base64.b64encode(file_content),
            filename=uploaded_file.filename,
            notify=True,
        )

        return request.render(
            "hr_preonboarding.offer_document_thank_you", {"document": document}
        )
