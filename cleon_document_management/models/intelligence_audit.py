from odoo import api, fields, models


class IntelligenceAuditEvent(models.Model):
    _name = "doc.intelligence.audit.event"
    _description = "Document Intelligence Audit Event"
    _order = "id desc"

    user_id = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        required=True,
        index=True,
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
        index=True,
    )
    category = fields.Selection(
        [
            ("dataset", "Dataset"),
            ("job", "Job"),
            ("classification", "Classification"),
            ("extraction", "Extraction"),
            ("validation", "Validation"),
            ("review", "Review"),
            ("profile", "Profile"),
            ("rule", "Rule"),
            ("knowledge", "Knowledge"),
            ("query", "Query"),
            ("permission", "Permission"),
            ("notification", "Notification"),
        ],
        required=True,
        index=True,
    )
    action = fields.Char(required=True, index=True)
    target_model = fields.Char()
    target_id = fields.Integer(index=True)
    target_name = fields.Char()
    detail = fields.Text()
    severity = fields.Selection(
        [
            ("info", "Info"),
            ("warning", "Warning"),
            ("error", "Error"),
        ],
        default="info",
        required=True,
        index=True,
    )
    correlation_id = fields.Char(index=True)
    before_value = fields.Text()
    after_value = fields.Text()

    @api.model
    def log_event(
        self,
        category,
        action,
        target=None,
        detail="",
        severity="info",
        before="",
        after="",
        correlation_id="",
    ):
        values = {
            "user_id": self.env.user.id,
            "company_id": self.env.company.id,
            "category": category,
            "action": action,
            "detail": (detail or "")[:4000],
            "severity": severity or "info",
            "before_value": (before or "")[:4000],
            "after_value": (after or "")[:4000],
            "correlation_id": correlation_id or "",
        }
        if target is not None:
            values["target_model"] = target._name
            values["target_id"] = target.id
            name = (
                target.display_name if hasattr(target, "display_name") else str(target.id)
            )
            values["target_name"] = (name or "")[:255]
        return self.sudo().create(values)

    @api.model
    def log_dataset(
        self,
        dataset,
        category,
        action,
        target=None,
        detail="",
        severity="info",
        before="",
        after="",
        correlation_id="",
    ):
        if dataset and not dataset.audit_logging:
            return self.browse()
        return self.log_event(
            category,
            action,
            target=target if target is not None else dataset,
            detail=detail,
            severity=severity,
            before=before,
            after=after,
            correlation_id=correlation_id,
        )

    def to_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "user": self.user_id.name,
            "company": self.company_id.name,
            "category": self.category,
            "action": self.action,
            "target_model": self.target_model or "",
            "target_id": self.target_id or 0,
            "target_name": self.target_name or "",
            "detail": self.detail or "",
            "severity": self.severity,
            "correlation_id": self.correlation_id or "",
            "before_value": self.before_value or "",
            "after_value": self.after_value or "",
            "create_date": str(self.create_date or ""),
        }
