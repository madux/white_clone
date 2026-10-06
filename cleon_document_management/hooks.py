def _sync_document_user_groups(env):
    base_user = env.ref("base.group_user")
    doc_user = env.ref("cleon_document_management.group_document_user")
    users = env["res.users"].search([("share", "=", False), ("active", "=", True)])
    missing = users.filtered(
        lambda user: base_user in user.groups_id and doc_user not in user.groups_id
    )
    if missing:
        missing.write({"groups_id": [(4, doc_user.id)]})


def _migrate_compliance_policy_types(env):
    retention_type = env.ref(
        "cleon_document_management.policy_type_retention",
        raise_if_not_found=False,
    )
    if retention_type and retention_type.code == "retention":
        retention_type.write(
            {
                "name": "Retention",
                "description": "Ensure employee documents follow organisation retention settings.",
            }
        )
    Policy = env["doc.compliance.policy"].sudo()
    review_type = env.ref(
        "cleon_document_management.policy_type_review_schedule",
        raise_if_not_found=False,
    )
    if not review_type:
        return
    param = env["ir.config_parameter"].sudo()
    if param.get_param("cleon_document_management.compliance_type_migrated"):
        return
    legacy = Policy.search(
        [
            ("policy_type_id.code", "=", "retention"),
            "|",
            ("assigned_auditor_id", "!=", False),
            ("sample_pct", "<", 100),
        ]
    )
    if legacy:
        legacy.write({"policy_type_id": review_type.id})
    param.set_param("cleon_document_management.compliance_type_migrated", "1")
    legacy_modes = Policy.search(
        [
            ("policy_type_id.code", "=", "retention"),
            ("retention_action_mode", "in", ["archive", "delete"]),
        ]
    )
    if legacy_modes:
        legacy_modes.write({"retention_action_mode": "automatic"})
    RetentionPolicy = env["doc.retention.policy"].sudo()
    for rule in RetentionPolicy.search([]):
        updates = {}
        if rule.retention_value and not rule.archive_after_value:
            updates["archive_after_value"] = rule.retention_value
            updates["archive_after_unit"] = rule.retention_unit or "years"
        if rule.retention_value and not rule.delete_after_value:
            updates["delete_after_value"] = rule.retention_value
            updates["delete_after_unit"] = rule.retention_unit or "years"
        if rule.trigger_event and not rule.clock_start:
            updates["clock_start"] = RetentionPolicy._map_trigger_to_clock(
                rule.trigger_event
            )
        if updates:
            rule.write(updates)


def post_init_hook(env):
    _sync_document_user_groups(env)
    _migrate_compliance_policy_types(env)
    if "doc.role.definition" in env:
        env["doc.role.definition"].sync_registry()
    if "doc.employee.files.role.service" in env:
        for company in env["res.company"].search([]):
            env["doc.employee.files.role.service"].with_company(company).migrate_legacy_document_managers()
    if "doc.org.role.template.service" in env:
        for company in env["res.company"].search([]):
            env["doc.org.role.template.service"].with_company(
                company
            ).ensure_canonical_org_roles(company)
    if "doc.employee.files.role.service" in env:
        env["doc.employee.files.role.service"].ensure_odoo_admin_super_admin_bindings()
