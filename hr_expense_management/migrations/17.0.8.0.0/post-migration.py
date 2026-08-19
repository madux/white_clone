from odoo import SUPERUSER_ID, api


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
        return value.get("en_US") or next(iter(value.values()), "Migrated Expense Entry")
    return value or "Migrated Expense Entry"


def migrate(cr, version):
    """Convert legacy expense journals to real Odoo account.move entries."""
    if not _table_exists(cr, "hr_expense_journal"):
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    cr.execute("SELECT old_id, new_id FROM hr_expense_legacy_account_map")
    account_map = dict(cr.fetchall())
    move_map = {}
    cr.execute(
        """
        SELECT id, date, description, source_model, source_id,
               source_reference, state, company_id
          FROM hr_expense_journal
         ORDER BY id
        """
    )
    for (
        old_id, entry_date, description, source_model, source_id,
        source_reference, state, company_id,
    ) in cr.fetchall():
        if state == "cancelled":
            continue
        company = env["res.company"].browse(company_id)
        journal = env["account.journal"].sudo().with_company(company).search([
            ("company_id", "=", company_id), ("type", "=", "general")
        ], order="sequence, id", limit=1)
        if not journal:
            journal = env["account.journal"].sudo().with_company(company).create({
                "name": "Expense Migration",
                "code": "EXPMG",
                "type": "general",
                "company_id": company_id,
            })
        cr.execute(
            """
            SELECT account_id, label, debit, credit, vendor_id
              FROM hr_expense_journal_line
             WHERE journal_id = %s
             ORDER BY id
            """,
            (old_id,),
        )
        lines = []
        for old_account_id, label, debit, credit, vendor_id in cr.fetchall():
            account_id = account_map.get(old_account_id)
            if account_id:
                lines.append((0, 0, {
                    "name": label or _plain_name(description),
                    "account_id": account_id,
                    "partner_id": vendor_id or False,
                    "debit": debit or 0.0,
                    "credit": credit or 0.0,
                }))
        if not lines:
            continue
        move = env["account.move"].sudo().with_company(company).with_context(
            check_move_validity=False
        ).create({
            "move_type": "entry",
            "journal_id": journal.id,
            "date": entry_date,
            "ref": _plain_name(description),
            "expense_source_model": source_model or "legacy.expense.journal",
            "expense_source_id": source_id or old_id,
            "expense_source_reference": source_reference or "Legacy expense entry %s" % old_id,
            "line_ids": lines,
        })
        if state == "posted":
            move.with_context(check_move_validity=True).action_post()
        move_map[old_id] = move.id

    for table, old_column, model, new_field in (
        ("hr_claim", "expense_journal_id", "hr.claim", "expense_move_id"),
        ("hr_claim_payment", "expense_journal_id", "hr.claim.payment", "expense_move_id"),
        ("hr_cash_advance", "expense_journal_id", "hr.cash.advance", "expense_move_id"),
        ("hr_petty_cash_transaction", "expense_journal_id", "hr.petty.cash.transaction", "expense_move_id"),
        ("hr_cash_advance_writeoff", "journal_id", "hr.cash.advance.writeoff", "expense_move_id"),
    ):
        if not (_table_exists(cr, table) and _column_exists(cr, table, old_column)):
            continue
        cr.execute(
            'SELECT id, "%s" FROM "%s" WHERE "%s" IS NOT NULL'
            % (old_column, table, old_column)
        )
        for record_id, old_journal_id in cr.fetchall():
            move_id = move_map.get(old_journal_id)
            if move_id:
                env[model].sudo().browse(record_id).write({new_field: move_id})

    cr.execute("DROP TABLE IF EXISTS hr_expense_journal_line CASCADE")
    cr.execute("DROP TABLE IF EXISTS hr_expense_journal CASCADE")
    cr.execute("DROP TABLE IF EXISTS hr_expense_account CASCADE")
    cr.execute("DROP TABLE IF EXISTS hr_expense_legacy_account_map")
