def _sync_document_user_groups(env):
    base_user = env.ref("base.group_user")
    doc_user = env.ref("cleon_document_management.group_document_user")
    users = env["res.users"].search([("share", "=", False), ("active", "=", True)])
    missing = users.filtered(
        lambda user: base_user in user.groups_id and doc_user not in user.groups_id
    )
    if missing:
        missing.write({"groups_id": [(4, doc_user.id)]})


def post_init_hook(env):
    _sync_document_user_groups(env)
