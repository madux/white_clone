import importlib.util
import unittest

from odoo.tests import HttpCase, tagged


@tagged("post_install", "-at_install", "expense_browser")
@unittest.skipUnless(
    importlib.util.find_spec("websocket"),
    "websocket-client module is required for Odoo browser_js tests",
)
class TestExpenseOwlBrowser(HttpCase):
    def test_all_figma_navigation_pages_render(self):
        action = self.env.ref("hr_expense_management.action_hr_claim_dashboard")
        code = r"""
            (async () => {
                const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                const waitFor = async (predicate, message, timeout = 15000) => {
                    const started = Date.now();
                    while (!predicate()) {
                        if (Date.now() - started > timeout) throw new Error(message);
                        await delay(50);
                    }
                };
                await waitFor(() => document.querySelector('.o_expense_app'), 'Expense OWL app did not mount');
                const moduleButtons = [...document.querySelectorAll('.o_expense_module_btn')];
                if (moduleButtons.length !== 16) throw new Error(`Expected 16 modules, found ${moduleButtons.length}`);
                for (const moduleButton of moduleButtons) {
                    moduleButton.click();
                    await waitFor(() => !document.querySelector('.o_expense_content .spinner-border'), 'Module did not finish loading');
                    await delay(80);
                    const moduleName = moduleButton.textContent.trim();
                    const subnav = [...document.querySelectorAll('.o_expense_subnav button')];
                    for (const pageButton of subnav) {
                        pageButton.click();
                        await waitFor(() => !document.querySelector('.o_expense_content .spinner-border'), `${moduleName}/${pageButton.textContent.trim()} did not finish loading`);
                        await delay(60);
                        const content = document.querySelector('.o_expense_content')?.textContent || '';
                        if (content.includes('Implementation phase in progress') || content.includes('Page unavailable')) {
                            throw new Error(`${moduleName}/${pageButton.textContent.trim()} rendered fallback content`);
                        }
                    }
                }
                const app = document.querySelector('.o_expense_app');
                if (!getComputedStyle(app).getPropertyValue('--expense-pink').trim()) throw new Error('Theme tokens were not applied');
                console.log('test successful');
            })();
        """
        self.browser_js(
            "/web#action=%s" % action.id,
            code=code,
            ready="odoo.isReady === true",
            login="admin",
            timeout=240,
        )
