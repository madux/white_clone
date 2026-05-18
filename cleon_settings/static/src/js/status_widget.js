/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class StatusWidget extends Component {

    get stages() {
        return this.props.record.fields.workflow_status.selection;
    }

    isActive(value) {
        return this.props.value === value;
    }

    isDone(value) {

        const currentIndex = this.stages.findIndex(
            s => s[0] === this.props.value
        );

        const stageIndex = this.stages.findIndex(
            s => s[0] === value
        );

        return stageIndex < currentIndex;
    }
}

StatusWidget.template = "hr_warning.StatusWidget";

StatusWidget.props = {
    ...standardFieldProps,
};

registry.category("fields").add("statusWidget", StatusWidget);