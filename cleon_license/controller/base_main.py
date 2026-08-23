import odoo.addons.web.controllers.home as main

class Home(main.Home):
    """
    1. User directs to home page - /landing
    2. When user clicks on login, it takes them to /erp
    3. 
    """
    def _login_redirect(self, uid, redirect=None):
        '''we did this so that every user will be directed to portal page'''
        return '/landing' # _get_login_redirect_url(uid, redirect)
