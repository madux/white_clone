# -*- coding: utf-8 -*-
from odoo import api, fields, models

# Default document categories and types shipped with CleonHR Document Management.
DEFAULT_CATALOG = [
    {
        "code": "identification_documents",
        "name": "Identification Documents",
        "description": "Government IDs and personal identification.",
        "sequence": 10,
        "types": [
            {
                "name": "International Passport",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 90,
            },
            {
                "name": "National ID Card",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 60,
            },
            {
                "name": "Driver's Licence",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 60,
            },
            {"name": "Voter's Card", "expiry_applicable": False},
        ],
    },
    {
        "code": "employment_documents",
        "name": "Employment Documents",
        "description": "Documents relating to employee employment.",
        "sequence": 20,
        "types": [
            {"name": "Employment Contract", "expiry_applicable": False},
            {"name": "Offer Letter", "expiry_applicable": False},
            {
                "name": "Work Permit",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 60,
            },
            {
                "name": "Visa",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 90,
            },
            {"name": "Guarantor Form", "expiry_applicable": False},
        ],
    },
    {
        "code": "medical_documents",
        "name": "Medical Documents",
        "description": "Occupational health and medical records.",
        "sequence": 30,
        "types": [
            {
                "name": "Medical Fitness Certificate",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 30,
            },
            {
                "name": "Health Insurance Card",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 30,
            },
            {"name": "Medical Report", "expiry_applicable": False},
        ],
    },
    {
        "code": "legal_documents",
        "name": "Legal Documents",
        "description": "Legal agreements and court documents.",
        "sequence": 40,
        "types": [
            {"name": "Non-Disclosure Agreement", "expiry_applicable": False},
            {"name": "Court Order", "expiry_applicable": False},
            {
                "name": "Power of Attorney",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 30,
            },
        ],
    },
    {
        "code": "training_certifications",
        "name": "Training & Certifications",
        "description": "Professional, academic and training credentials.",
        "sequence": 50,
        "types": [
            {
                "name": "Professional Certificate",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 60,
            },
            {"name": "Academic Certificate", "expiry_applicable": False},
            {"name": "Training Certificate", "expiry_applicable": False},
            {
                "name": "Licence to Practise",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 60,
            },
        ],
    },
    {
        "code": "payroll_documents",
        "name": "Payroll Documents",
        "description": "Pay statements and payroll-related files.",
        "sequence": 60,
        "types": [
            {"name": "Payslip", "expiry_applicable": False},
            {"name": "Payroll Adjustment", "expiry_applicable": False},
            {"name": "Tax Withholding Form", "expiry_applicable": False},
            {"name": "Pension Schedule", "expiry_applicable": False},
        ],
    },
    {
        "code": "finance_documents",
        "name": "Finance Documents",
        "description": "Financial statements and banking records.",
        "sequence": 70,
        "types": [
            {"name": "Bank Statement", "expiry_applicable": False},
            {"name": "Expense Receipt", "expiry_applicable": False},
        ],
    },
    {
        "code": "tax_documents",
        "name": "Tax Documents",
        "description": "Tax filings and certificates.",
        "sequence": 80,
        "types": [
            {
                "name": "Tax Clearance Certificate",
                "expiry_applicable": True,
                "require_issue_date": True,
                "expiry_reminder_days": 90,
            },
            {"name": "Annual Tax Return", "expiry_applicable": False},
        ],
    },
    {
        "code": "benefits_documents",
        "name": "Benefits Documents",
        "description": "Employee benefits and insurance paperwork.",
        "sequence": 90,
        "types": [
            {"name": "Benefits Enrolment Form", "expiry_applicable": False},
            {"name": "Life Insurance Nomination", "expiry_applicable": False},
        ],
    },
    {
        "code": "performance_documents",
        "name": "Performance Documents",
        "description": "Reviews, goals and performance records.",
        "sequence": 100,
        "types": [
            {"name": "Performance Review", "expiry_applicable": False},
            {"name": "Performance Improvement Plan", "expiry_applicable": False},
        ],
    },
    {
        "code": "disciplinary_documents",
        "name": "Disciplinary Documents",
        "description": "Disciplinary and conduct records.",
        "sequence": 110,
        "types": [
            {"name": "Warning Letter", "expiry_applicable": False},
            {"name": "Disciplinary Hearing Record", "expiry_applicable": False},
        ],
    },
    {
        "code": "onboarding_documents",
        "name": "Onboarding Documents",
        "description": "Joining and exit paperwork.",
        "sequence": 120,
        "types": [
            {"name": "Onboarding Checklist", "expiry_applicable": False},
            {"name": "Exit Clearance Form", "expiry_applicable": False},
        ],
    },
    {
        "code": "other_documents",
        "name": "Other Documents",
        "description": "General documents that do not fit another category.",
        "sequence": 130,
        "types": [
            {"name": "General Document", "expiry_applicable": False},
        ],
    },
]

LEGACY_SELECTION_TO_CATEGORY_CODE = {
    "identity": "identification_documents",
    "employment": "employment_documents",
    "medical": "medical_documents",
    "legal": "legal_documents",
    "training": "training_certifications",
    "finance": "finance_documents",
    "hr": "onboarding_documents",
    "other": "other_documents",
}


class DocDocumentCatalogService(models.AbstractModel):
    _name = "doc.document.catalog.service"
    _description = "Default document category & type catalogue"

    @api.model
    def _company(self, company=None):
        return company or self.env.company

    @api.model
    def category_domain(self, company=None):
        company = self._company(company)
        return [("company_id", "=", company.id)]

    @api.model
    def ensure_default_catalog(self, company=None):
        """Ensure the default category and type catalogue exists for this company."""
        company = self._company(company)
        Category = self.env["doc.document.category"].sudo()
        Type = self.env["doc.document.type"].sudo()
        created_categories = 0
        created_types = 0
        for entry in DEFAULT_CATALOG:
            category = Category.search(
                [("company_id", "=", company.id), ("code", "=", entry["code"])],
                limit=1,
            )
            if not category:
                category = Category.create(
                    {
                        "name": entry["name"],
                        "code": entry["code"],
                        "description": entry.get("description") or "",
                        "sequence": entry.get("sequence", 10),
                        "is_catalog_default": True,
                        "company_id": company.id,
                        "active": True,
                    }
                )
                created_categories += 1
            for type_def in entry.get("types", []):
                existing = Type.search(
                    [
                        ("category_id", "=", category.id),
                        ("name", "=ilike", type_def["name"]),
                    ],
                    limit=1,
                )
                if existing:
                    continue
                Type.create(self._type_values(category, type_def))
                created_types += 1
        self._link_orphan_types(company)
        return {
            "categories_created": created_categories,
            "types_created": created_types,
        }

    @api.model
    def _type_values(self, category, type_def):
        expires = bool(type_def.get("expiry_applicable"))
        return {
            "name": type_def["name"],
            "category_id": category.id,
            "category": self._legacy_code_for_category(category.code),
            "description": type_def.get("description") or "",
            "active": True,
            "enable_versioning": True,
            "expiry_applicable": expires,
            "expires_rule": "yes" if expires else "no",
            "require_issue_date": bool(type_def.get("require_issue_date"))
            if expires
            else False,
            "expiry_reminder_days": int(type_def.get("expiry_reminder_days") or 60),
            "require_upload_approval": False,
        }

    @api.model
    def _legacy_code_for_category(self, category_code):
        for legacy, code in LEGACY_SELECTION_TO_CATEGORY_CODE.items():
            if code == category_code:
                return legacy
        return "other"

    @api.model
    def _link_orphan_types(self, company=None):
        company = self._company(company)
        Category = self.env["doc.document.category"].sudo()
        Type = self.env["doc.document.type"].sudo()
        categories_by_code = {
            item.code: item
            for item in Category.search([("company_id", "=", company.id)])
        }
        other = categories_by_code.get("other_documents")
        if not categories_by_code:
            return
        for document_type in Type.search([("category_id", "=", False)]):
            code = LEGACY_SELECTION_TO_CATEGORY_CODE.get(
                document_type.category or "other", "other_documents"
            )
            category = categories_by_code.get(code) or other
            if category:
                document_type.write({"category_id": category.id})

    @api.model
    def ensure_all_companies(self):
        totals = {"categories_created": 0, "types_created": 0}
        for company in self.env["res.company"].sudo().search([]):
            result = self.ensure_default_catalog(company)
            totals["categories_created"] += result["categories_created"]
            totals["types_created"] += result["types_created"]
        return totals

    @api.model
    def migrate_legacy_global_catalog_to_companies(self):
        """One-time: copy missing per-company rows when only company_id=False data exists."""
        Category = self.env["doc.document.category"].sudo()
        legacy = Category.search([("company_id", "=", False)])
        if not legacy:
            return {"migrated": False}
        for company in self.env["res.company"].sudo().search([]):
            has_company_catalog = Category.search_count(
                [("company_id", "=", company.id), ("is_catalog_default", "=", True)]
            )
            if has_company_catalog >= len(DEFAULT_CATALOG):
                continue
            self.ensure_default_catalog(company)
        return {"migrated": True}
