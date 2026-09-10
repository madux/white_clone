"""Disable recursive homepage override before view loading."""

def migrate(cr, version):
    # Old homepage override: website.homepage -> login_layout -> website.layout
    # can hang QWeb compilation during install.
    cr.execute(
        """
        UPDATE ir_ui_view AS v
           SET active = false
          FROM ir_model_data AS d
         WHERE d.model = 'ir.ui.view'
           AND d.res_id = v.id
           AND d.module = 'cleon_settings'
           AND (
                d.name IN (
                    'cleonhr_login_layout',
                    'cleonhr_login_layout_nowebsite',
                    'cleonhr_hide_auth_signup_links',
                    'cleonhr_login',
                    'theme_frontend_footer',
                    'cleon_website_homepage'
                )
                OR v.key = 'website.homepage'
                OR v.name = 'Apps'
           )
        """
    )
    # Also deactivate any view still keying website.homepage from this module
    cr.execute(
        """
        UPDATE ir_ui_view AS v
           SET active = false
          FROM ir_model_data AS d
         WHERE d.model = 'ir.ui.view'
           AND d.res_id = v.id
           AND d.module = 'cleon_settings'
           AND v.key = 'website.homepage'
        """
    )
