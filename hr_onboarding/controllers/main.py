# -*- coding: utf-8 -*-
from datetime import timedelta, date

from odoo import http, fields
from odoo.http import request

# System-access checklist items shown as checkboxes on the intake form.
# (name, required)
SYSTEM_ACCESS_ITEMS = [
    ("Corporate Email", True),
    ("Slack / Teams", True),
    ("HR Self-Service Portal", True),
    ("GitHub / GitLab", False),
    ("Jira / Linear", False),
    ("Confluence / Notion", False),
    ("Payroll System", False),
    ("Analytics Dashboard", False),
]


class HrOnboardingController(http.Controller):

    # ------------------------------------------------------------------
    # Dashboard — "All Onboarding" (image 1)
    # ------------------------------------------------------------------
    @http.route("/onboarding", type="http", auth="user", methods=["GET"])
    def onboarding_dashboard(self, status=None, department_id=None, **kwargs):
        Onboarding = request.env["hr.onboarding"]
        domain = []
        if status:
            domain.append(("state", "=", status))
        if department_id:
            domain.append(("department_id", "=", int(department_id)))

        records = Onboarding.search(domain)
        stats = Onboarding.get_dashboard_stats(domain)
        departments = request.env["hr.department"].search([])

        return request.render(
            "hr_onboarding.dashboard_template",
            {
                "records": records,
                "stats": stats,
                "departments": departments,
                "status": status,
                "department_id": int(department_id) if department_id else None,
                "categories": Onboarding.CATEGORIES,
                "today": fields.Date.context_today(Onboarding),
            },
        )

    # ------------------------------------------------------------------
    # Add New Employee (image 2)
    # ------------------------------------------------------------------
    @http.route("/onboarding/new", type="http", auth="user", methods=["GET"])
    def new_employee_form(self, **kwargs):
        env = request.env
        return request.render(
            "hr_onboarding.new_employee_template",
            {
                "departments": env["hr.department"].search([]),
                "jobs": env["hr.job"].search([]),
                "work_locations": env["hr.work.location"].search([]),
                "managers": env["hr.employee"].search([]),
                "system_access_items": SYSTEM_ACCESS_ITEMS,
                "error": kwargs.get("error"),
            },
        )

    @http.route("/onboarding/new", type="http", auth="user", methods=["POST"], csrf=True)
    def new_employee_submit(self, **post):
        env = request.env

        first_name = (post.get("first_name") or "").strip()
        last_name = (post.get("last_name") or "").strip()
        if not first_name or not last_name:
            return request.redirect("/onboarding/new?error=Name is required")

        department_id = post.get("department_id")
        job_id = post.get("job_id")
        employment_type = post.get("employment_type")
        start_date_str = post.get("start_date")
        if not (department_id and employment_type and start_date_str):
            return request.redirect(
                "/onboarding/new?error=Department, Employment Type and "
                "Start Date are required"
            )

        # --- private address partner (home address + TIN via vat) -----
        home_address = post.get("home_address")
        tax_id = post.get("tax_id")
        address_partner = False
        if home_address or tax_id:
            address_partner = env["res.partner"].sudo().create({
                "name": "%s %s" % (first_name, last_name),
                "street": home_address,
                "vat": tax_id,
                # "type": "private",
            })

        # --- employee -----------------------------------------------
        employee_vals = {
            "name": "%s %s" % (first_name, last_name),
            "work_email": post.get("email"),
            "mobile_phone": post.get("phone"),
            "birthday": post.get("date_of_birth") or False,
            "gender": post.get("gender") or False,
            "country_id": int(post["nationality_id"]) if post.get("nationality_id") else False,
            "department_id": int(department_id),
            "job_id": int(job_id) if job_id else False,
            "job_title": post.get("position") or False,
            "grade_level": post.get("grade_level") or False,
            "employee_type": employment_type,
            "work_location_id": int(post["work_location_id"]) if post.get("work_location_id") else False,
            "parent_id": int(post["reports_to_id"]) if post.get("reports_to_id") else False,
            "emergency_contact": post.get("emergency_name") or False,
            "emergency_phone": post.get("emergency_phone") or False,
            "pension_pin": post.get("pension_pin") or False,
        }
        if address_partner:
            employee_vals["address_id"] = address_partner.id

        employee = env["hr.employee"].sudo().create(employee_vals)

        # --- resume lines: Work Experience / Education (hr.resume.line) --
        ResumeLine = env["hr.resume.line"].sudo()
        # exp_type = env.ref("hr.resume_type_experience", raise_if_not_found=False)
        # edu_type = env.ref("hr.resume_type_education", raise_if_not_found=False)
        work_experience = request.env['hr.work_experience'].sudo()
        work_education = request.env['hr.work_education'].sudo()
        work_skills = request.env['hr.work_skills'].sudo()
        if post.get("exp_company"):
            ResumeLine.create({
                "employee_id": employee.id,
                "name": post.get("exp_company"),
                "description": post.get("exp_job_title") or "",
                "date_start": post.get("exp_from") or fields.Date.today(),
                "date_end": None if post.get("exp_current") else (post.get("exp_to") or None),
                # "line_type_id": exp_type.id if exp_type else False,
            })
            work_experience = work_experience.create({
                            "company_name": post.get("exp_company"),
                            "job_title": post.get("exp_job_title"),
                        })

            
        if post.get("edu_institution"):
            ResumeLine.create({
                "employee_id": employee.id,
                "name": post.get("edu_institution"),
                "description": "%s — %s" % (
                    post.get("edu_degree") or "",
                    post.get("edu_field") or "",
                ),
                "date_start": None,
                "date_end": None,
                # "line_type_id": edu_type.id if edu_type else False,
            })

            
            work_education = work_education.create({
                ''
            })
            work_skills = work_skills.create({
                ''
            })

        # --- bank account ---------------------------------------------
        if post.get("account_number") and address_partner:
            bank = False
            if post.get("bank_name"):
                bank = env["res.bank"].sudo().search(
                    [("name", "=", post["bank_name"])], limit=1
                ) or env["res.bank"].sudo().create({"name": post["bank_name"]})
            bank_account = env["res.partner.bank"].sudo().create({
                "acc_number": post["account_number"],
                "partner_id": address_partner.id,
                "bank_id": bank.id if bank else False,
            })
            employee.sudo().bank_account_id = bank_account.id

        # --- contract (also drives Probation Tracking) -----------------
        start_date = fields.Date.from_string(start_date_str)
        wage = float(post.get("base_salary") or 0)
        contract = env["hr.contract"].sudo().create({
            "name": "%s - Contract" % employee.name,
            "employee_id": employee.id,
            "date_start": start_date,
            "wage": wage,
            "trial_date_start": start_date,
            "trial_date_end": start_date + timedelta(days=180),
        })
        employee.sudo().contract_id = contract.id

        # --- onboarding record + seeded tasks ---------------------------
        Onboarding = env["hr.onboarding"].sudo()
        onboarding = Onboarding.create({
            "employee_id": employee.id,
            "contract_id": contract.id,
            "start_date": start_date,
            "duration_days": 30,
        })

        Task = env["hr.onboarding.task"].sudo()
        for name, category, offset in Onboarding.default_task_specs():
            Task.create({
                "onboarding_id": onboarding.id,
                "name": name,
                "category": category,
                "due_date": start_date + timedelta(days=offset),
            })

        # system-access checkboxes -> IT Access tasks
        for key, _required in SYSTEM_ACCESS_ITEMS:
            field_key = "system_%s" % key.lower().replace(" / ", "_").replace(" ", "_")
            if post.get(field_key):
                Task.create({
                    "onboarding_id": onboarding.id,
                    "name": "Grant access: %s" % key,
                    "category": "it_access",
                    "due_date": start_date - timedelta(days=2),
                })

        return request.redirect("/onboarding")

    # ------------------------------------------------------------------
    # Probation Tracking (image 4)
    # ------------------------------------------------------------------
    @http.route(
        ["/onboarding/probation", "/onboarding/probation/<int:contract_id>"],
        type="http", auth="user", methods=["GET"],
    )
    def probation_dashboard(self, contract_id=None, **kwargs):
        env = request.env
        today = fields.Date.context_today(env["hr.contract"])
        contracts = env["hr.contract"].sudo().search([
            ("trial_date_end", ">=", today),
            ("trial_date_start", "<=", today),
        ])

        selected = None
        if contract_id:
            selected = contracts.filtered(lambda c: c.id == contract_id)[:1]
        if not selected and contracts:
            selected = contracts[0]

        selected_onboarding = False
        if selected:
            selected_onboarding = env["hr.onboarding"].sudo().search(
                [("contract_id", "=", selected.id)], limit=1
            )

        return request.render(
            "hr_onboarding.probation_template",
            {
                "contracts": contracts,
                "selected": selected,
                "selected_onboarding": selected_onboarding,
                "today": today,
            },
        )

    @http.route(
        "/onboarding/probation/<int:contract_id>/confirm",
        type="http", auth="user", methods=["POST"], csrf=True,
    )
    def probation_confirm(self, contract_id, **post):
        contract = request.env["hr.contract"].sudo().browse(contract_id)
        if contract.exists():
            contract.trial_date_end = fields.Date.context_today(contract)
            contract.message_post(body="Probation confirmed early via Onboarding dashboard.")
        return request.redirect("/onboarding/probation")

    @http.route(
        "/onboarding/probation/<int:contract_id>/extend",
        type="http", auth="user", methods=["POST"], csrf=True,
    )
    def probation_extend(self, contract_id, days=30, **post):
        contract = request.env["hr.contract"].sudo().browse(contract_id)
        if contract.exists() and contract.trial_date_end:
            contract.trial_date_end = contract.trial_date_end + timedelta(days=int(days))
            contract.message_post(body="Probation extended by %s days." % days)
        return request.redirect("/onboarding/probation/%s" % contract_id)

    @http.route(
        "/onboarding/probation/<int:contract_id>/pip",
        type="http", auth="user", methods=["POST"], csrf=True,
    )
    def probation_pip(self, contract_id, **post):
        contract = request.env["hr.contract"].sudo().browse(contract_id)
        if contract.exists():
            contract.on_pip = True
            contract.message_post(body="Placed on Performance Improvement Plan (PIP).")
        return request.redirect("/onboarding/probation/%s" % contract_id)

    # ------------------------------------------------------------------
    # Task Checklist tab — NOT built. See chat response for why.
    # ------------------------------------------------------------------
    @http.route("/onboarding/tasks", type="http", auth="user", methods=["GET"])
    def tasks_placeholder(self, **kwargs):
        return request.render("hr_onboarding.tasks_placeholder_template", {})
