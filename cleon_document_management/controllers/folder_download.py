import base64
import io
import re
import zipfile

from odoo import http
from odoo.http import request


def safe_filename(value):
    value = value or "unnamed"
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value)
    return value.strip("._") or "unnamed"


class DocumentFolderDownloadController(http.Controller):

    @http.route(
        "/document-management/employee/<int:employee_id>/download",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def download_employee(self, employee_id):
        documents = request.env["doc.document"].search(
            [("employee_id", "=", employee_id), ("active", "=", True)]
        )
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for document in documents:
                attachment = document.attachment_id
                if attachment and attachment.datas:
                    archive.writestr(
                        safe_filename(document.name or attachment.name),
                        base64.b64decode(attachment.datas),
                    )
        output.seek(0)
        employee = request.env["hr.employee"].browse(employee_id).exists()
        filename = f"{safe_filename(employee.name if employee else 'employee')}.zip"
        return request.make_response(
            output.getvalue(),
            headers=[
                ("Content-Type", "application/zip"),
                ("Content-Disposition", f'attachment; filename="{filename}"'),
            ],
        )

    @http.route(
        "/document-management/folder/<int:folder_id>/download",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def download_folder(self, folder_id):
        folder = request.env["doc.folder"].browse(folder_id)

        if not folder.exists():
            return request.not_found()

        if not folder.check_access_rights(
            "read",
            raise_exception=False,
        ):
            return request.not_found()

        folder.check_access_rule("read")

        documents = request.env["doc.document"].search(
            [
                ("folder_id", "=", folder.id),
                ("active", "=", True),
            ]
        )

        output = io.BytesIO()

        with zipfile.ZipFile(
            output,
            "w",
            compression=zipfile.ZIP_DEFLATED,
        ) as archive:
            for document in documents:
                document.check_access_rule("read")

                attachment = document.attachment_id

                if not attachment or not attachment.check_access_rights(
                    "read", raise_exception=False
                ):
                    continue

                if not attachment or not attachment.datas:
                    continue

                employee_name = (
                    safe_filename(document.employee_id.name)
                    if document.employee_id
                    else "Organization"
                )

                document_name = safe_filename(document.name or attachment.name)

                archive.writestr(
                    f"{employee_name}/{document_name}",
                    base64.b64decode(attachment.datas),
                )

        output.seek(0)

        filename = f"{safe_filename(folder.folder_name)}.zip"

        return request.make_response(
            output.getvalue(),
            headers=[
                ("Content-Type", "application/zip"),
                (
                    "Content-Disposition",
                    f'attachment; filename="{filename}"',
                ),
            ],
        )
