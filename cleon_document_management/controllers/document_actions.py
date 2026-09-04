from odoo import http
from odoo.http import request


class DocumentActions(http.Controller):
    @http.route("/api/document-action", type="json", auth="user", methods=["POST"], csrf=False)
    def document_action(self, id=None, action=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if action == "favorite":
            document.action_toggle_favorite()
        elif action == "pin":
            document.action_toggle_pin()
        elif action == "delete":
            document.unlink()
            return {"success": True, "data": {"deleted": True}}
        else:
            return {"success": False, "message": "Unsupported document action."}
        return {"success": True, "data": {"id": document.id, "action": action}}
