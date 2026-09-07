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


def attachment_bytes(attachment):
    """Decode Odoo's base64 attachment storage before writing binary output."""
    return base64.b64decode(attachment.datas or b"")


class DocumentFolderDownloadController(http.Controller):

    @http.route(
        "/document-management/employee/<int:employee_id>/download",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def download_employee(self, employee_id):
        employee = request.env["hr.employee"].browse(employee_id).exists()
        if not employee:
            return request.not_found()
        user = request.env.user
        is_manager = user.has_group("cleon_document_management.group_document_manager")
        if not is_manager and employee.user_id != user:
            return request.not_found()
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
                        attachment_bytes(attachment),
                    )
        output.seek(0)
        filename = f"{safe_filename(employee.name)}.zip"
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
                    attachment_bytes(attachment),
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
