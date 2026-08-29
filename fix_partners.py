
env.cr.execute('SELECT id, name, work_email, work_phone FROM hr_employee WHERE work_contact_id IS NULL')
employees = env.cr.dictfetchall()

for emp in employees:
    partner = env['res.partner'].create({
        'name': emp['name'],
        'email': emp['work_email'],
        'phone': emp['work_phone'],
        'company_id': 1,
        'active': True,
        'employee': True,
    })
    env['hr.employee'].browse(emp['id']).write({'work_contact_id': partner.id})
    env.cr.commit()

print(f"Fixed {len(employees)} employees by creating missing work contacts.")
