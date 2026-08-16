"""Central role checks for Expense Management business models and services."""

from odoo import _, api, models
from odoo.exceptions import AccessError


EXPENSE_ROLE_GROUPS = {
    "employee": "hr_expense_management.group_hr_expense_employee",
    "manager": "hr_expense_management.group_hr_expense_manager",
    "finance": "hr_expense_management.group_hr_expense_finance",
    "admin": "hr_expense_management.group_hr_expense_admin",
}


class HrExpenseSecurityMixin(models.AbstractModel):
    _name = "hr.expense.security.mixin"
    _description = "Expense Management Security Helpers"

    @api.model
    def _expense_has_role(self, *roles):
        """Return whether the current user has any requested expense role."""
        return self.env.su or any(
            self.env.user.has_group(EXPENSE_ROLE_GROUPS[role]) for role in roles
        )

    @api.model
    def _expense_check_role(self, *roles, message=None):
        if not self._expense_has_role(*roles):
            raise AccessError(message or _("You do not have access to this expense workspace."))
        return True

