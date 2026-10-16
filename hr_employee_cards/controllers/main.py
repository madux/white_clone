from odoo import http
from odoo.http import request

PAGE_SIZE = 2


class HrEmployeeCards(http.Controller):

    @http.route("/hr-employee", type="http", auth="user", website=False, csrf=False)
    def hr_employee(self, search="", offset=0, **kw):
        """Single route, three response shapes depending on the request:

        1. Plain browser GET (no HX-Request header) -> full HTML page.
        2. htmx GET with offset == 0 (search box changed)  -> just the
           #employee-grid fragment (cards + load-more control), swapped
           into the page with hx-swap="innerHTML".
        3. htmx GET with offset > 0 ("Load more" clicked) -> just the new
           batch of cards, appended with hx-swap="beforeend", plus an
           out-of-band update to the load-more button itself.
        """
        try:
            offset = int(offset)
        except (TypeError, ValueError):
            offset = 0

        domain = []
        if search:
            domain = [
                "|", "|", "|",
                ("name", "ilike", search),
                ("job_title", "ilike", search),
                ("department_id.name", "ilike", search),
                ("work_email", "ilike", search),
            ]

        Employee = request.env["hr.employee"].sudo()
        employees = Employee.search(domain, offset=offset, limit=PAGE_SIZE, order="name asc")
        total = Employee.search_count(domain)
        next_offset = offset + PAGE_SIZE
        has_more = next_offset < total

        values = {
            "employees": employees,
            "search": search,
            "offset": offset,
            "next_offset": next_offset,
            "has_more": has_more,
            "total": total,
        }

        is_htmx = request.httprequest.headers.get("HX-Request") == "true"

        if is_htmx and offset > 0:
            return request.render("hr_employee_cards.employee_cards_batch", values)
        if is_htmx:
            return request.render("hr_employee_cards.employee_grid", values)
        return request.render("hr_employee_cards.employee_page", values)
