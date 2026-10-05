// Run with: node --test white_clone_portal/tests/portal_registry.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function portal(modules, disabled = false, failTime = false, initial = 'dashboard') {
    const entries = [];
    const calls = [];
    const hooks = [];
    const services = {
        user: { name: 'Employee' }, notification: { add() {} },
        orm: { async call(model, method) {
            calls.push(method);
            if (method === 'get_employee_portal_leave_access') return { enabled: !disabled };
            if (method === 'get_cleon_access') {
                if (failTime) throw Error('Unavailable');
                return { has_employee: true, portalModules: { time: !disabled }, featureAccess: { attendance: !disabled, overtime: false } };
            }
            if (method === 'get_cleon_employee_data') return { employee: 'Ada' };
            throw Error(`Unexpected RPC ${model}.${method}`);
        } },
    };
    const context = vm.createContext({
        Component: class { constructor() { this.props = { action: { params: { initial_page: initial } } }; } },
        EmployeeLeaveDashboard: class {}, MyLeaveRequestsPage: class {}, LeaveCalendarPage: class {}, TimeManagementApp: class {},
        employeePortalRegistry: { add(key, entry, opts) { entries.push({ entry, sequence: opts.sequence }); }, getAll() { return entries.sort((a,b) => a.sequence-b.sequence).map(e => e.entry); } },
        registry: { category() { return { add() {} }; } },
        useService: name => services[name], useState: value => value,
        onWillStart: hook => hooks.push(hook), onWillUnmount() {}, _t: text => text,
        document: { documentElement: { classList: { add() {}, remove() {} } } }, window: {},
    });
    function evaluate(file) {
        const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/^import .*;\n/gm, '').replace(/export class /g, 'class ');
        vm.runInContext(source, context);
    }
    for (const module of modules) evaluate(`white_clone_portal_${module}/static/src/portal_${module}.js`);
    evaluate('white_clone_portal/static/src/employee_portal.js');
    const app = vm.runInContext('new EmployeePortalApp()', context);
    app.setup();
    await Promise.all(hooks.map(hook => hook()));
    return { app, calls };
}

test('portal alone opens dashboard without optional module RPCs', async () => {
    const { app, calls } = await portal([], false, false, 'clock');
    assert.equal(app.state.page, 'dashboard');
    assert.equal(app.sections.length, 0);
    assert.equal(calls.length, 0);
});
test('Leave-only registration preserves personal props and legacy links', async () => {
    const { app, calls } = await portal(['leave'], false, false, 'leave');
    assert.equal(app.state.page, 'leaveRequests');
    assert.equal(app.currentProps.personalOnly, true);
    assert.equal(app.sections.length, 1);
    assert.deepEqual(calls, ['get_employee_portal_leave_access']);
});
test('combined providers sort menus and enforce feature visibility', async () => {
    const { app } = await portal(['time', 'leave']);
    assert.equal(app.sections[0].id, 'leave');
    assert.equal(app.sections[1].id, 'time');
    assert.equal(app.findPage('overtime'), undefined);
    app.setPage('clock');
    assert.equal(app.currentProps.action.params.employee_page, 'clock');
    app.setPage('overtime');
    assert.equal(app.state.page, 'clock');
    assert.equal(app.dashboards.length, 1);
});
test('disabled features are hidden even through direct links', async () => {
    const { app } = await portal(['leave', 'time'], true, false, 'leaveRequests');
    assert.equal(app.sections.length, 0);
    assert.equal(app.state.page, 'dashboard');
});
test('a failed optional provider does not block other screens', async () => {
    const { app } = await portal(['leave', 'time'], false, true, 'leaveRequests');
    assert.equal(app.state.page, 'leaveRequests');
    assert.equal(app.sections.length, 1);
    assert.equal(app.state.failures.length, 1);
});
