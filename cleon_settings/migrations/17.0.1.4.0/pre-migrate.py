"""Clear stuck module state leftovers before install/upgrade."""

def migrate(cr, version):
    # Deactivate any leftover broken login/homepage view inherits
    cr.execute(
        """
        UPDATE ir_ui_view AS v
           SET active = false
          FROM ir_model_data AS d
         WHERE d.model = 'ir.ui.view'
           AND d.res_id = v.id
           AND d.module = 'cleon_settings'
           AND d.name IN (
                'cleonhr_login_layout',
                'cleonhr_login_layout_nowebsite',
                'cleonhr_hide_auth_signup_links',
                'cleonhr_login',
                'theme_frontend_footer'
           )
        """
    )
