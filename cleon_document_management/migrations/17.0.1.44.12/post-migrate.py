def migrate(cr, version):
    cr.execute(
        """
        UPDATE doc_compliance_evaluation_run
        SET state = 'completed'
        WHERE state IS NULL OR state = ''
        """
    )
