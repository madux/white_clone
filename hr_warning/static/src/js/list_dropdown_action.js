/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

console.log("Loading the dropdown widget")

export class ListDropdownActions extends Component {

    setup() {
        this.orm = this.env.services.orm;
        this.action = this.env.services.action;
        this.userService = this.env.services.user;

        this.isManager = false;

        onWillStart(async () => {

            this.isManager =
                await this.userService.hasGroup(
                    'hr_warning.group_hr_warning_manager'
                );
            console.log("user is ==>",this.isManager)
            
        });
    }

    openRecord(ev) {
        ev.preventDefault();
        this.action.doAction({
            type: 'ir.actions.act_window',
            res_model: this.props.record.resModel,
            res_id: this.props.record.resId,
            views: [[false, 'form']],
            target: 'current',
        });
    }

    open_investigtor_modal(ev) {

        ev.preventDefault();

        this.action.doAction({
            type: 'ir.actions.act_window',
            name: 'Investigator',
            res_model: "hr.warning.investigator",
            views: [[false, 'form']],
            target: 'new',
            context: {
                default_warning_id: this.props.record.resId,
                default_name: 'New Investigator',
                default_model_id_char: this.props.record.resModel,
                // custom_action: true,
                // active_id: this.props.record.resId,
                // active_model: this.props.record.resModel,
            },
            flags: {
            form: {
                action_buttons: false,
            },
        },
        });
    }

    async approveRecord(ev) {

        ev.preventDefault();

        await this.orm.call(
            this.props.record.resModel,
            'action_approve',
            [[this.props.record.resId]]
        );

        window.location.reload();
    }

    async deleteRecord(ev) {

        ev.preventDefault();

        await this.orm.unlink(
            this.props.record.resModel,
            [this.props.record.resId]
        );

        window.location.reload();
    }

    
}

// setTimeout(() => {

//     const dropdown = document.querySelector('.dropdown-menu.show');
//     const button = document.querySelector('.dropdown-toggle.show');

//     if (dropdown && button) {

//         const rect = button.getBoundingClientRect();

//         dropdown.style.top = `${rect.bottom + 4}px`;
//         dropdown.style.left = `${rect.left}px`;
//     }

// }, 0);

ListDropdownActions.template =
    "hr_warning.ListDropdownActions";

// ListDropdownActions.supportedTypes = ["char"];

export const listDropdownActions = {
    component: ListDropdownActions,
    supportedOptions: [
        {
            label: _t("Title"),
            name: "title",
            type: "string",
            availableTypes: ["char", "integer", "float"],

        },
        
    ],
    extractProps: ({ options }) => ({
        title: options.title,
    }),
};

registry.category("fields").add(
    "list_dropdown_actions",
    listDropdownActions
);