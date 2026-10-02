"""Transfer metadata ownership, including deployments updated before the split."""
from odoo.addons.hr_time_management.migration_ownership import MODEL_OWNERS, RECORD_OWNERS


def migrate(cr, version):
    modules = set(MODEL_OWNERS.values())
    cr.execute("SELECT name FROM ir_module_module WHERE name IN %s AND state IN ('installed', 'to install', 'to upgrade')", (tuple(modules),))
    if {row[0] for row in cr.fetchall()} != modules:
        raise RuntimeError("Upgrade Time Management together with -i hr_time_management_suite to preserve existing operational data.")

    def transfer(name, owner):
        cr.execute("UPDATE ir_model_data SET module=%s WHERE module='hr_time_management' AND name=%s", (owner, name))

    for name, owner in RECORD_OWNERS.items():
        transfer(name, owner)
    for model, owner in MODEL_OWNERS.items():
        key = model.replace('.', '_')
        transfer('model_' + key, owner)
        cr.execute("SELECT name FROM ir_model_data WHERE module='hr_time_management' AND model='ir.model.fields' AND starts_with(name, %s)", ('field_' + key + '__',))
        for (name,) in cr.fetchall():
            transfer(name, owner)
        for table in ('ir_model_constraint', 'ir_model_relation'):
            metadata_model = table.replace('_', '.')
            cr.execute(f"UPDATE ir_model_data d SET module=%s FROM {table} m WHERE d.module='hr_time_management' AND d.model=%s AND d.res_id=m.id AND m.model=(SELECT id FROM ir_model WHERE model=%s)", (owner, metadata_model, model))
            cr.execute(f"UPDATE {table} SET module=(SELECT id FROM ir_module_module WHERE name=%s) WHERE module=(SELECT id FROM ir_module_module WHERE name='hr_time_management') AND model=(SELECT id FROM ir_model WHERE model=%s)", (owner, model))

    fields = {
        'hr_attendance_management': [('cleon_time_policy', 'regularization_window_days'), ('cleon_time_audit', 'attendance_id')],
        'hr_shift_management': [('cleon_time_policy', 'selected_shift_id'), ('cleon_time_policy', 'default_shift_id')],
        'hr_overtime_management': [('cleon_time_policy', 'overtime_request_mode'), ('cleon_time_policy', 'overtime_auto_approve_max_hours')],
        'hr_time_work': [('cleon_time_policy', 'billable_tracking_enabled'), ('cleon_time_policy', 'default_billing_rate')],
        'hr_time_attendance_shift': [('hr_attendance', 'cleon_shift_id')],
        'hr_time_attendance_overtime': [('cleon_overtime_request', 'attendance_id')],
    }
    for prefix, owner in [('field_hr_attendance__', 'hr_attendance_management'), ('field_account_analytic_line__', 'hr_time_work')]:
        cr.execute("SELECT name FROM ir_model_data WHERE module='hr_time_management' AND starts_with(name, %s)", (prefix,))
        for (name,) in cr.fetchall():
            if name != 'field_hr_attendance__cleon_shift_id':
                transfer(name, owner)
    for owner, entries in fields.items():
        for model, name in entries:
            # Overtime model fields may already have moved with the model above.
            cr.execute("UPDATE ir_model_data SET module=%s WHERE module IN ('hr_time_management','hr_overtime_management') AND name=%s", (owner, 'field_' + model + '__' + name))
    cr.execute("""UPDATE ir_model_data d SET module=f.module
        FROM ir_model_fields_selection s, ir_model_data f
        WHERE d.module='hr_time_management' AND d.model='ir.model.fields.selection'
        AND d.res_id=s.id AND f.model='ir.model.fields' AND f.res_id=s.field_id
        AND f.module IN %s""", (tuple(modules),))
    cr.execute("UPDATE ir_model_data SET module='hr_time_attendance_overtime' WHERE module='hr_overtime_management' AND name='constraint_cleon_overtime_request_attendance_unique'")
    cr.execute("UPDATE ir_model_constraint SET module=(SELECT id FROM ir_module_module WHERE name='hr_time_attendance_overtime') WHERE name='cleon_overtime_request_attendance_unique' AND module=(SELECT id FROM ir_module_module WHERE name='hr_overtime_management')")
