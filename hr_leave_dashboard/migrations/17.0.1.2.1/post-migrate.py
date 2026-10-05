from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    # Drafts are not submissions. Historical times are compatibility estimates,
    # never refreshed by registry startup or a normal record read.
    cr.execute("UPDATE hr_leave SET submitted_at = NULL WHERE state = 'draft'")
    cr.execute("""
        UPDATE hr_leave SET submitted_at = create_date
        WHERE submitted_at IS NULL AND state != 'draft'
    """)
    # We cannot reconstruct historical policy ownership from a shared type.
    # Preserve the compatibility route and explicitly mark unknown provenance.
    cr.execute("""
        UPDATE hr_leave SET governing_rule_snapshot =
            '{"legacy": true, "historical_provenance_unknown": true}'::jsonb
        WHERE state != 'draft' AND governing_rule_snapshot IS NULL
    """)
    for assignment in env["hr.leave.policy.assignment"].search([("rule_snapshot", "=", False)]):
        snapshot = assignment.policy_id._rule_snapshot(assignment.policy_line_id)
        # Private SQL migration only; normal ORM writes forbid changing history.
        from psycopg2.extras import Json
        cr.execute("UPDATE hr_leave_policy_assignment SET rule_snapshot = %s WHERE id = %s", [Json(snapshot), assignment.id])
    for leave_type in env["hr.leave.type"].with_context(active_test=False).search([]):
        label = leave_type._bradford_label(leave_type.name, leave_type.leave_code)
        values = {}
        if leave_type.policy_classification == "other":
            if leave_type._bradford_is_sickness(label):
                values["policy_classification"] = "sick"
            elif leave_type._bradford_is_protected(label):
                values["policy_classification"] = "family" if any(word in label.lower() for word in ("maternity", "paternity", "parental")) else "annual"
        if any(word in label.lower() for word in ("maternity", "paternity", "parental")):
            values["bradford_protected"] = True
        if values:
            leave_type.with_context(skip_bradford_refresh=True).write(values)
