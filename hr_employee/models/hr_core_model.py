class HrStaffEngagement(models.Model):
    _name = "hr.staff_engagement"
    _description = "HrStaffEngagement"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTask(models.Model):
    _name = "hr.core_task"
    _description = "HrCoreTask"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrGrade(models.Model):
    _name = "hr.grade"
    _description = "HrGrade"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreSurvey(models.Model):
    _name = "hr.core_survey"
    _description = "HrCoreSurvey"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCorePerformance(models.Model):
    _name = "hr.core_performance"
    _description = "HrCorePerformance"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreCompliance(models.Model):
    _name = "hr.core_compliance"
    _description = "HrCoreCompliance"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreReportline(models.Model):
    _name = "hr.core_reportline"
    _description = "HrCoreReportline"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreGuarantorManagement(models.Model):
    _name = "hr.core_guarantor_management"
    _description = "HrCoreGuarantorManagement"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreDocumentation(models.Model):
    _name = "hr.core_documentation"
    _description = "HrCoreDocumentation"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrSalaryManagement(models.Model):
    _name = "hr.salary_management"
    _description = "HrSalaryManagement"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTraining(models.Model):
    _name = "hr.core_training"
    _description = "HrCoreTraining"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCorePromotion(models.Model):
    _name = "hr.core_promotion"
    _description = "HrCorePromotion"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreWorkforcePlanning(models.Model):
    _name = "hr.core_workforce_planning"
    _description = "HrCoreWorkforcePlanning"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreOfferMgt(models.Model):
    _name = "hr.core_offer_mgt"
    _description = "HrCoreOfferMgt"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreExitProcess(models.Model):
    _name = "hr.core_exit_process"
    _description = "HrCoreExitProcess"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreReferenceCheck(models.Model):
    _name = "hr.core_reference_check"
    _description = "HrCoreReferenceCheck"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrLeave(models.Model):
    _name = "hr.leave"
    _description = "HrLeave"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrWarning(models.Model):
    _name = "hr.warning"
    _description = "HrWarning"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreRecognition(models.Model):
    _name = "hr.core_recognition"
    _description = "HrCoreRecognition"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreOnboarding(models.Model):
    _name = "hr.core_onboarding"
    _description = "HrCoreOnboarding"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrOrganisationSetup(models.Model):
    _name = "hr.organisation_setup"
    _description = "HrOrganisationSetup"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreInterviewMgt(models.Model):
    _name = "hr.core_interview_mgt"
    _description = "HrCoreInterviewMgt"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreResignation(models.Model):
    _name = "hr.core_resignation"
    _description = "HrCoreResignation"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrLevel(models.Model):
    _name = "hr.level"
    _description = "HrLevel"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreOnboardingProcess(models.Model):
    _name = "hr.core_onboarding_process"
    _description = "HrCoreOnboardingProcess"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreBirthday(models.Model):
    _name = "hr.core_birthday"
    _description = "HrCoreBirthday"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTrainingCompliance(models.Model):
    _name = "hr.core_training_compliance"
    _description = "HrCoreTrainingCompliance"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreOnboardingProbation(models.Model):
    _name = "hr.core_onboarding_probation"
    _description = "HrCoreOnboardingProbation"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreSettlement(models.Model):
    _name = "hr.core_settlement"
    _description = "HrCoreSettlement"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTalent(models.Model):
    _name = "hr.core_talent"
    _description = "HrCoreTalent"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTermination(models.Model):
    _name = "hr.core_termination"
    _description = "HrCoreTermination"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrContract(models.Model):
    _name = "hr.contract"
    _description = "HrContract"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreBackgroundCheck(models.Model):
    _name = "hr.core_background_check"
    _description = "HrCoreBackgroundCheck"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreTransfer(models.Model):
    _name = "hr.core_transfer"
    _description = "HrCoreTransfer"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreEmploymentType(models.Model):
    _name = "hr.core_employment_type"
    _description = "HrCoreEmploymentType"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreVerification(models.Model):
    _name = "hr.core_verification"
    _description = "HrCoreVerification"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrCoreClearance(models.Model):
    _name = "hr.core_clearance"
    _description = "HrCoreClearance"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrUnit(models.Model):
    _name = "hr.unit"
    _description = "HrUnit"
    _rec_name = "name"

    name = fields.Char(string="Name")


class HrStateManagement(models.Model):
    _name = "hr.state_management"
    _description = "HrStateManagement"
    _rec_name = "name"

    name = fields.Char(string="Name")