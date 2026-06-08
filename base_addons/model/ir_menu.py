from odoo import api, models, fields

class IrUiMenu(models.Model):
    _inherit = "ir.ui.menu"

    category_name = fields.Char(help="HRCORE")
    icon_class = fields.Char(default="fa fa-folder")
    # parent_category_name = fields.Char(help="HRCORE", related="parent.category_name", store=True)

    @api.model
    def get_hr_parent_menus(self, categoryName):
        '''menu_param: menus will start as the parent i.e'''
        menus = self.search([
            # ('parent', '=', False),
            ('action', '!=', False),
            ('parent_id.category_name', '=', categoryName),
            # ('parent_category_name', 'ilike', categoryName),
        ])

        return [{
            'id': menu.id,
            'name': menu.name,
            'icon_class': menu.icon_class,
            'action_id': menu.action.id if menu.action else False,

        } for menu in menus]