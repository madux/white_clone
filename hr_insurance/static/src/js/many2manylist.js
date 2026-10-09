/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";

import { standardFieldProps } from "@web/views/fields/standard_field_props";


/**
 * ============================================================
 * BENEFIT SELECTOR DIALOG
 * ============================================================
 */

export class InsuranceBenefitSelector extends Component {

    static template = "hr_insurance.InsuranceBenefitSelector";

    static components = {
        Dialog,
    };

    static props = {
        close: Function,
        model: String,
        selectedIds: Array,
        domain: { type: Array, optional: true },
        onApply: Function,
    };

    setup() {

        this.orm = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            search: "",
            records: [],
            selectedIds: new Set(this.props.selectedIds || []),
            loading: false,
            creating: false,
            newName: "",
        });

        this.searchBenefits();
    }


    /**
     * ========================================================
     * SEARCH
     * ========================================================
     */

    async searchBenefits() {

        this.state.loading = true;

        try {

            const domain = [
                ...(this.props.domain || []),
            ];

            if (this.state.search.trim()) {

                domain.push([
                    "display_name",
                    "ilike",
                    this.state.search.trim(),
                ]);

            }

            const records = await this.orm.call(
                this.props.model,
                "search_read",
                [
                    domain,
                    [
                        "id",
                        "display_name",
                    ],
                ],
                {
                    limit: 100,
                    order: "display_name asc",
                }
            );

            this.state.records = records;

        } catch (error) {

            console.error(
                "Insurance benefit search error:",
                error
            );

            this.notification.add(
                "Unable to load benefits.",
                {
                    type: "danger",
                }
            );

        } finally {

            this.state.loading = false;

        }
    }


    /**
     * ========================================================
     * SEARCH INPUT
     * ========================================================
     */

    onSearchInput(event) {

        this.state.search = event.target.value;

        this.searchBenefits();
    }


    /**
     * ========================================================
     * CHECK / UNCHECK
     * ========================================================
     */

    toggleRecord(record) {

        const id = record.id;

        if (this.state.selectedIds.has(id)) {

            this.state.selectedIds.delete(id);

        } else {

            this.state.selectedIds.add(id);

        }

        // Force Owl to notice Set mutation
        this.state.selectedIds = new Set(
            this.state.selectedIds
        );
    }


    /**
     * ========================================================
     * CHECK WHETHER SELECTED
     * ========================================================
     */

    isSelected(id) {

        return this.state.selectedIds.has(id);
    }


    /**
     * ========================================================
     * SELECT ALL
     * ========================================================
     */

    selectAll() {

        const ids = this.state.records.map(
            record => record.id
        );

        this.state.selectedIds = new Set([
            ...this.state.selectedIds,
            ...ids,
        ]);
    }


    /**
     * ========================================================
     * CLEAR SEARCH RESULTS
     * ========================================================
     */

    clearVisibleSelection() {

        const visibleIds = new Set(
            this.state.records.map(
                record => record.id
            )
        );

        const selected = new Set(
            [...this.state.selectedIds]
                .filter(id => !visibleIds.has(id))
        );

        this.state.selectedIds = selected;
    }


    /**
     * ========================================================
     * CREATE NEW BENEFIT
     * ========================================================
     */

    onNewNameInput(event) {

        this.state.newName = event.target.value;
    }


    async createBenefit() {

        const name = this.state.newName.trim();

        if (!name) {

            this.notification.add(
                "Enter a benefit name.",
                {
                    type: "warning",
                }
            );

            return;
        }

        this.state.creating = true;

        try {

            const newId = await this.orm.call(
                this.props.model,
                "create",
                [
                    {
                        name: name,
                    },
                ]
            );

            /*
             * Automatically select the newly-created record.
             */

            this.state.selectedIds = new Set([
                ...this.state.selectedIds,
                newId,
            ]);

            this.state.newName = "";

            /*
             * Refresh the search result.
             */

            await this.searchBenefits();

            /*
             * If search text was present and doesn't match
             * the new record, clear it so the user can see it.
             */

            this.state.search = "";

            await this.searchBenefits();

        } catch (error) {

            console.error(
                "Create benefit error:",
                error
            );

            this.notification.add(
                "Unable to create the benefit.",
                {
                    type: "danger",
                }
            );

        } finally {

            this.state.creating = false;

        }
    }


    /**
     * ========================================================
     * APPLY
     * ========================================================
     */

    apply() {

        const ids = [
            ...this.state.selectedIds,
        ];

        this.props.onApply(ids);

        this.props.close();
    }


    /**
     * ========================================================
     * CANCEL
     * ========================================================
     */

    cancel() {

        this.props.close();
    }
}


/**
 * ============================================================
 * MAIN MANY2MANY FIELD
 * ============================================================
 */

export class InsuranceBenefitsField extends Component {

    static template = "hr_insurance.InsuranceBenefitsField";

    static props = {
        ...standardFieldProps,
    };

    setup() {

        this.dialog = useService("dialog");
        this.notification = useService("notification");

    }


    /**
     * ========================================================
     * FIELD MODEL
     * ========================================================
     *
     * Automatically get the Many2many related model.
     *
     * benefit_ids -> hr.insurance.benefit
     */

    get relationModel() {

        return this.props.record.fields[
            this.props.name
        ].relation;
    }


    /**
     * ========================================================
     * FIELD RECORDS
     * ========================================================
     */

    get records() {

        const field = this.props.record.data[
            this.props.name
        ];

        return field?.records || [];
    }


    /**
     * ========================================================
     * CURRENT IDS
     * ========================================================
     */

    get selectedIds() {

        return this.records
            .map(record => record.resId)
            .filter(id => id);
    }


    /**
     * ========================================================
     * REMOVE
     * ========================================================
     */

    async removeBenefit(benefit) {

        if (!benefit.resId) {
            return;
        }

        const currentIds = this.selectedIds.filter(
            id => id !== benefit.resId
        );

        await this.props.record.update({

            [this.props.name]: [
                [6, 0, currentIds],
            ],

        });
    }


    /**
     * ========================================================
     * OPEN SELECTOR
     * ========================================================
     */

    openBenefitSelector() {

        const model = this.relationModel;

        /*
         * Optional domain from the XML field.
         */

        const domain =
            this.props.domain || [];


        this.dialog.add(
            InsuranceBenefitSelector,
            {

                model: model,

                selectedIds: [
                    ...this.selectedIds,
                ],

                domain: domain,

                onApply: (ids) => {
                    this.updateBenefits(ids);
                },

            }
        );
    }


    /**
     * ========================================================
     * UPDATE MANY2MANY
     * ========================================================
     */

    async updateBenefits(ids) {

        await this.props.record.update({

            [this.props.name]: [
                [6, 0, ids],
            ],

        });
    }

}


/**
 * ============================================================
 * FIELD REGISTRY
 * ============================================================
 */

registry.category("fields").add(
    "insurance_benefits",
    {
        component: InsuranceBenefitsField,
        supportedTypes: ["many2many"],
    }
);