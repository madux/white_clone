/**
 * Unit test suite for Leave Policy UI State Invariants and Transformations
 *
 * Verifies the "One Leave Policy + Progressive Disclosure" semantics:
 * 1. Opening/expanding Advanced Settings does NOT mark a policy as advanced.
 * 2. Repeated expand/collapse leaves form state unchanged.
 * 3. Granular per-leave-type differences or advanced rules mark hasAdvancedOverrides === true.
 * 4. Collapsed configured policy preserves per-line values and payload saves as "advanced".
 * 5. Explicit "Apply Common Values to All Types" cleanly synchronizes values and resets overrides.
 * 6. Removing the last leave type keeps lines and simple_leave_type_ids in sync without divergence.
 * 7. Organisation defaults mapping integrity (carry.maximum vs max_balance_cap, allow_overlap vs block_overlap).
 */

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

(async function runTests() {
    // Dynamically load ES module leave_policy_state.js cleanly inside Node CommonJS runner
    const stateFile = path.join(__dirname, "leave_policy_state.js");
    const stateCode = fs.readFileSync(stateFile, "utf8");
    const { newForm, newLine, hasAdvancedOverrides } = await import(
        "data:text/javascript," + encodeURIComponent(stateCode)
    );

    // Mock helper simulating LeavePoliciesPage instance state operations
    class PolicyFormSimulator {
        constructor(defaults = {}) {
            this.defaults = defaults;
            this.state = {
                form: newForm("simple", defaults),
                step: 1,
            };
        }

        get hasAdvancedOverrides() {
            return hasAdvancedOverrides(this.state.form);
        }

        toggleAdvanced() {
            this.state.form.advancedOpen = !this.state.form.advancedOpen;
            if (this.state.form.advancedOpen && !this.hasAdvancedOverrides) {
                this.syncSimpleLines();
            }
            this.state.step = 1;
        }

        addSimpleType(typeId) {
            const id = Number(typeId);
            if (id && !this.state.form.simple_leave_type_ids.includes(id)) {
                this.state.form.simple_leave_type_ids.push(id);
                if (this.hasAdvancedOverrides) {
                    if (!this.state.form.lines.some(l => l.leave_type_id === id)) {
                        this.state.form.lines.push(newLine(id, "", this.state.form.organisation_defaults));
                    }
                } else {
                    this.syncSimpleLines();
                }
            }
        }

        removeSimpleType(typeId) {
            const id = Number(typeId);
            const index = this.state.form.simple_leave_type_ids.indexOf(id);
            if (index >= 0) {
                this.state.form.simple_leave_type_ids.splice(index, 1);
                if (this.hasAdvancedOverrides) {
                    const lineIdx = this.state.form.lines.findIndex(l => l.leave_type_id === id);
                    if (lineIdx >= 0) {
                        this.state.form.lines.splice(lineIdx, 1);
                    }
                } else {
                    this.syncSimpleLines();
                }
            }
        }

        syncSimpleLines() {
            if (this.hasAdvancedOverrides) {
                return;
            }
            const accrual = this.state.form.simple_accrual;
            const newLines = [];
            for (const typeId of this.state.form.simple_leave_type_ids) {
                const existing = this.state.form.lines.find(l => l.leave_type_id === typeId);
                newLines.push({
                    ...(existing || newLine(typeId, "", this.state.form.organisation_defaults)),
                    leave_type_id: typeId,
                    new_leave_type_name: "",
                    compensation: accrual.compensation,
                    unit: accrual.unit,
                    entitlement_type: accrual.accrual_period === "none" ? "fixed" : "accrued",
                    accrual_period: accrual.accrual_period,
                    accrual_basis: accrual.accrual_basis,
                    accrual_amount: accrual.accrual_amount,
                    waiting_period_days: accrual.waiting_period_days,
                    exclude_public_holidays: accrual.exclude_public_holidays,
                    exclude_non_working_days: accrual.exclude_non_working_days,
                });
            }
            for (const customName of this.state.form.custom_type_names) {
                const existing = this.state.form.lines.find(l => l.new_leave_type_name === customName);
                newLines.push({
                    ...(existing || newLine("", customName, this.state.form.organisation_defaults)),
                    leave_type_id: "",
                    new_leave_type_name: customName,
                    compensation: accrual.compensation,
                    unit: accrual.unit,
                    entitlement_type: accrual.accrual_period === "none" ? "fixed" : "accrued",
                    accrual_period: accrual.accrual_period,
                    accrual_basis: accrual.accrual_basis,
                    accrual_amount: accrual.accrual_amount,
                    waiting_period_days: accrual.waiting_period_days,
                    exclude_public_holidays: accrual.exclude_public_holidays,
                    exclude_non_working_days: accrual.exclude_non_working_days,
                });
            }
            this.state.form.lines = newLines.length ? newLines : [newLine("", "", this.state.form.organisation_defaults)];
        }

        applyCommonValuesToAllTypes() {
            const common = this.state.form.simple_accrual;
            const defaults = this.state.form.organisation_defaults || {};
            for (const line of this.state.form.lines) {
                line.compensation = common.compensation;
                line.unit = common.unit;
                line.accrual_period = common.accrual_period;
                line.accrual_basis = common.accrual_basis;
                line.accrual_amount = common.accrual_amount;
                line.waiting_period_days = common.waiting_period_days;
                line.exclude_public_holidays = common.exclude_public_holidays;
                line.exclude_non_working_days = common.exclude_non_working_days;

                line.minimum_notice_days = Number(defaults.minimum_notice_days || 0);
                line.document_policy = defaults.supporting_document_policy === "always" ? "required" : (defaults.supporting_document_policy === "conditional" ? "optional" : "not_required");
                line.document_required_after_days = 0;
                line.accepted_document_types = "";
                line.blackout_period_ids = [];
                line.minimum_duration = 0;
                line.maximum_duration = 0;
                line.allow_backdated = false;
                line.allow_overlap = false;
                line.allow_half_day = defaults.allow_half_day !== false;
                line.allow_negative_balance = Boolean(defaults.allow_negative_balance);
            }
            this.syncSimpleLines();
        }

        preparePayload() {
            if (!this.hasAdvancedOverrides) {
                this.syncSimpleLines();
            }
            const payload = JSON.parse(JSON.stringify(this.state.form));
            payload.mode = this.hasAdvancedOverrides ? "advanced" : "simple";
            return payload;
        }
    }

    // ── Test Runner ──
    console.log("Running Leave Policy JS State Invariant Tests...\n");

    const orgDefaults = {
        unit: "days",
        approval_workflow: "single",
        supporting_document_policy: "never",
        minimum_notice_days: 2,
        allow_half_day: true,
        allow_carryover: true,
        maximum_balance_cap: 30, // Organisation total balance ceiling
        allow_negative_balance: false,
        team_overlap_percent: 25,
        block_overlap_threshold: true, // Team absence threshold
    };

    // Scenario 1: Opening Advanced without editing does not mark policy advanced
    {
        const sim = new PolicyFormSimulator(orgDefaults);
        sim.addSimpleType(101); // Annual Leave
        sim.addSimpleType(102); // Sick Leave

        assert.equal(sim.hasAdvancedOverrides, false, "Fresh policy must not have advanced overrides");
        assert.equal(sim.state.form.advancedOpen, false);

        // Admin opens Advanced Settings just to inspect
        sim.toggleAdvanced();
        assert.equal(sim.state.form.advancedOpen, true, "Advanced settings expanded");
        assert.equal(sim.hasAdvancedOverrides, false, "Simply opening Advanced Settings must NOT mark policy as advanced");

        // Admin closes Advanced Settings without changes
        sim.toggleAdvanced();
        assert.equal(sim.state.form.advancedOpen, false, "Advanced settings collapsed");
        assert.equal(sim.hasAdvancedOverrides, false, "Closing Advanced Settings leaves policy simple");

        // Admin now updates normal entitlement from 21 to 25
        sim.state.form.simple_accrual.accrual_amount = 25;
        const payload = sim.preparePayload();

        assert.equal(payload.mode, "simple", "Policy must save with mode='simple'");
        assert.equal(payload.lines.length, 2);
        assert.equal(payload.lines[0].accrual_amount, 25, "Line 1 synchronized to 25");
        assert.equal(payload.lines[1].accrual_amount, 25, "Line 2 synchronized to 25");
        console.log("✓ Scenario 1 passed: Opening Advanced without editing does NOT mark policy as advanced.");
    }

    // Scenario 2: Repeated expand/collapse leaves state unchanged
    {
        const sim = new PolicyFormSimulator(orgDefaults);
        sim.addSimpleType(101);

        for (let i = 0; i < 6; i++) {
            sim.toggleAdvanced();
            assert.equal(sim.hasAdvancedOverrides, false, `Cycle ${i}: hasAdvancedOverrides must remain false`);
        }
        assert.equal(sim.state.form.advancedOpen, false, "Ended in collapsed state");
        assert.equal(sim.preparePayload().mode, "simple");
        console.log("✓ Scenario 2 passed: Repeated expand/collapse leaves state completely unchanged.");
    }

    // Scenario 3: Configuring an advanced override marks it configured
    {
        // 3A: Entitlement divergence across lines
        const simA = new PolicyFormSimulator(orgDefaults);
        simA.addSimpleType(101);
        simA.addSimpleType(102);
        simA.toggleAdvanced();
        simA.state.form.lines[0].accrual_amount = 25; // Annual = 25
        simA.state.form.lines[1].accrual_amount = 10; // Sick = 10
        assert.equal(simA.hasAdvancedOverrides, true, "Divergent accrual amounts must trigger hasAdvancedOverrides");

        // 3B: Line-level notice days override
        const simB = new PolicyFormSimulator(orgDefaults);
        simB.addSimpleType(101);
        simB.toggleAdvanced();
        simB.state.form.lines[0].minimum_notice_days = 14; // Default is 2
        assert.equal(simB.hasAdvancedOverrides, true, "Notice days override must trigger hasAdvancedOverrides");

        // 3C: Policy-level conditions
        const simC = new PolicyFormSimulator(orgDefaults);
        simC.addSimpleType(101);
        simC.state.form.apply_to = "conditions";
        assert.equal(simC.hasAdvancedOverrides, true, "Conditional eligibility must trigger hasAdvancedOverrides");

        // 3D: Blackout period configured on line
        const simD = new PolicyFormSimulator(orgDefaults);
        simD.addSimpleType(101);
        simD.state.form.lines[0].blackout_period_ids = [5];
        assert.equal(simD.hasAdvancedOverrides, true, "Blackout periods must trigger hasAdvancedOverrides");

        console.log("✓ Scenario 3 passed: Configuring granular differences accurately sets hasAdvancedOverrides = true.");
    }

    // Scenario 4: Collapsed configured policy preserves distinct per-line values
    {
        const sim = new PolicyFormSimulator(orgDefaults);
        sim.addSimpleType(101); // Annual
        sim.addSimpleType(102); // Sick
        sim.toggleAdvanced();
        sim.state.form.lines[0].accrual_amount = 25;
        sim.state.form.lines[1].accrual_amount = 10;

        // Admin closes Advanced Settings
        sim.toggleAdvanced();
        assert.equal(sim.state.form.advancedOpen, false, "Advanced collapsed");
        assert.equal(sim.hasAdvancedOverrides, true, "Still recognizes advanced overrides exist");

        // Attempting simple sync does NOT flatten divergent lines
        sim.syncSimpleLines();
        assert.equal(sim.state.form.lines[0].accrual_amount, 25, "Annual preserved at 25");
        assert.equal(sim.state.form.lines[1].accrual_amount, 10, "Sick preserved at 10");

        const payload = sim.preparePayload();
        assert.equal(payload.mode, "advanced", "Must save with mode='advanced'");
        assert.equal(payload.lines[0].accrual_amount, 25);
        assert.equal(payload.lines[1].accrual_amount, 10);
        console.log("✓ Scenario 4 passed: Collapsed configured policy preserves distinct per-line values without flattening.");
    }

    // Scenario 5: Explicit "Apply Common Values to All Types" resets overrides
    {
        const sim = new PolicyFormSimulator(orgDefaults);
        sim.addSimpleType(101);
        sim.addSimpleType(102);
        sim.toggleAdvanced();
        sim.state.form.lines[0].accrual_amount = 25;
        sim.state.form.lines[1].accrual_amount = 10;
        assert.equal(sim.hasAdvancedOverrides, true);

        // User chooses to reset overrides and apply common entitlement
        sim.state.form.simple_accrual.accrual_amount = 22;
        sim.applyCommonValuesToAllTypes();

        assert.equal(sim.hasAdvancedOverrides, false, "Overrides cleared; policy returns to simple semantics");
        assert.equal(sim.state.form.lines[0].accrual_amount, 22);
        assert.equal(sim.state.form.lines[1].accrual_amount, 22);

        const payload = sim.preparePayload();
        assert.equal(payload.mode, "simple", "Saves as simple policy once common values applied");
        console.log("✓ Scenario 5 passed: Explicit apply common values resets overrides and restores simple mode.");
    }

    // Scenario 6: Removing the last leave type keeps lines and simple_leave_type_ids in sync
    {
        const sim = new PolicyFormSimulator(orgDefaults);
        sim.addSimpleType(101);
        assert.equal(sim.state.form.simple_leave_type_ids.length, 1);
        assert.equal(sim.state.form.lines.length, 1);

        // Remove the only leave type
        sim.removeSimpleType(101);
        assert.equal(sim.state.form.simple_leave_type_ids.length, 0, "simple_leave_type_ids is empty");
        assert.equal(sim.state.form.lines.length, 1, "lines has 1 placeholder line with no type");
        assert.equal(sim.state.form.lines[0].leave_type_id, "", "line type ID is empty");

        // In advanced mode with overrides
        sim.addSimpleType(101);
        sim.state.form.lines[0].minimum_notice_days = 10; // make it have override
        assert.equal(sim.hasAdvancedOverrides, true);

        sim.removeSimpleType(101);
        assert.equal(sim.state.form.simple_leave_type_ids.length, 0);
        assert.equal(sim.state.form.lines.length, 0, "lines is empty in advanced mode when last type removed");
        console.log("✓ Scenario 6 passed: Removing the last leave type maintains 1:1 synchronization between arrays.");
    }

    // Scenario 7: Organisation defaults mapping integrity
    {
        const form = newForm("simple", orgDefaults);
        assert.equal(form.carry.maximum, 5, "carry.maximum must default to 5, NOT maximum_balance_cap (30)");
        assert.equal(form.rules.block_overlap_threshold, true, "block_overlap_threshold mapped to rules");

        const line = newLine(101, "", orgDefaults);
        assert.equal(line.allow_overlap, false, "line.allow_overlap must default to false (not conflated with block_overlap_threshold)");
        console.log("✓ Scenario 7 passed: Organisation defaults correctly mapped without semantic conflation.");
    }

    console.log("\nALL 7 JS STATE INVARIANT SCENARIOS PASSED SUCCESSFULLY!");
})().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
