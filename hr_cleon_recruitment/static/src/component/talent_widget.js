/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { useService } from "@web/core/utils/hooks";

export class TalentMobilityMatchCards extends Component {
    setup() {
        this.orm = useService("orm");
    }

    get matches() {
        return this.props.record.data[this.props.name].records.map((r) => r.data);
    }

    async callAction(matchId, methodName) {
        await this.orm.call("hr.talent.mobility.match", methodName, [[matchId]]);
        await this.props.record.load();
        this.props.record.model.notify();
    }
}
TalentMobilityMatchCards.template = "hr_cleon_recruitment.TalentMobilityMatchCards";
TalentMobilityMatchCards.props = { ...standardFieldProps };

registry.category("fields").add("o_tm_match_cards", {
    component: TalentMobilityMatchCards,
});