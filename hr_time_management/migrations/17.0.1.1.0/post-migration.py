def migrate(cr, version):
    cr.execute(
        """
        UPDATE cleon_overtime_request
           SET payroll_state = 'ready'
         WHERE state = 'approved'
           AND payroll_state = 'not_ready'
        """
    )
