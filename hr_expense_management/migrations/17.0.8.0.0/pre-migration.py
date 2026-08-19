import re

from odoo import SUPERUSER_ID, api


ACCOUNT_TYPES = {
    "asset": "asset_current",
    "liability": "liability_current",
    "equity": "equity",
    "revenue": "income",
    "expense": "expense",
}


def _table_exists(cr, table):
    cr.execute("SELECT to_regclass(%s)", ("public.%s" % table,))
    return bool(cr.fetchone()[0])


def _column_exists(cr, table, column):
    cr.execute(
        """
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        """,
        (table, column),
    )
    return bool(cr.fetchone())


def _plain_name(value):
    if isinstance(value, dict):
        return value.get("en_US") or next(iter(value.values()), "Migrated Expense Account")
    return value or "Migrated Expense Account"


def migrate(cr, version):
    """Move legacy account references before their foreign keys target account.account."""
    if not _table_exists(cr, "hr_expense_account"):
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    Account = env["account.account"].sudo()
    cr.execute(
        """
        CREATE TABLE IF NOT EXISTS hr_expense_legacy_account_map (
            old_id integer PRIMARY KEY,
            new_id integer NOT NULL
        )
        """
    )
    cr.execute(
        """
        SELECT id, name, code, account_type, active, company_id
          FROM hr_expense_account
         ORDER BY id
        """
    )
    for old_id, name, code, account_type, active, company_id in cr.fetchall():
        clean_code = re.sub(r"[^A-Za-z0-9.]", "", code or "") or "EXP%s" % old_id
        clean_code = clean_code[:64]
        account = Account.search([
            ("company_id", "=", company_id), ("code", "=", clean_code)
        ], limit=1)
        if not account:
            account = Account.with_company(env["res.company"].browse(company_id)).create({
                "name": _plain_name(name),
                "code": clean_code,
                "account_type": ACCOUNT_TYPES.get(account_type, "expense"),
                "deprecated": not active,
                "company_id": company_id,
            })
        cr.execute(
            """
            INSERT INTO hr_expense_legacy_account_map (old_id, new_id)
            VALUES (%s, %s)
            ON CONFLICT (old_id) DO UPDATE SET new_id = EXCLUDED.new_id
            """,
            (old_id, account.id),
        )

    # Remove FKs pointing to the retired account table before replacing IDs.
    cr.execute(
        """
        SELECT conrelid::regclass::text, conname
          FROM pg_constraint
         WHERE contype = 'f' AND confrelid = 'hr_expense_account'::regclass
        """
    )
    for table, constraint in cr.fetchall():
        if re.fullmatch(r"[A-Za-z0-9_]+", table) and re.fullmatch(r"[A-Za-z0-9_]+", constraint):
            cr.execute('ALTER TABLE "%s" DROP CONSTRAINT "%s"' % (table, constraint))

    for table, column in (
        ("hr_expense_gl_map", "debit_account_id"),
        ("hr_expense_gl_map", "credit_account_id"),
        ("hr_expense_vendor_category", "default_expense_account_id"),
        ("res_partner", "default_expense_account_id"),
        ("hr_expense_budget_line", "account_id"),
    ):
        if _table_exists(cr, table) and _column_exists(cr, table, column):
            cr.execute(
                'UPDATE "%s" target SET "%s" = mapping.new_id '
                'FROM hr_expense_legacy_account_map mapping '
                'WHERE target."%s" = mapping.old_id' % (table, column, column)
            )
