import type { PolicyWizardStep } from "./policyCreateValidation";

export const DOCUMENT_REQUIREMENT_WIZARD_LABELS = [
  "Basic Information",
  "Required Documents",
  "Applies to",
  "Timing & Completion",
  "Verification & Oversight",
] as const;

export const DOCUMENT_REQUIREMENT_WIZARD_STEP_KEYS: PolicyWizardStep[] = [
  "basics",
  "documents",
  "audience",
  "timing",
  "verification",
];

export function isDocumentRequirementPageWizard(
  typeCode: string,
  isPage: boolean,
  organizationalMode?: boolean,
) {
  return (
    isPage &&
    !organizationalMode &&
    typeCode === "document_requirement"
  );
}

export function policyWizardStepKeys(
  typeCode: string,
  docRequirementPageWizard: boolean,
): PolicyWizardStep[] {
  if (docRequirementPageWizard) {
    return DOCUMENT_REQUIREMENT_WIZARD_STEP_KEYS;
  }
  if (typeCode === "renewable_document") {
    return ["basics", "audience", "requirements"];
  }
  if (typeCode === "retention") {
    return ["basics", "audience", "requirements"];
  }
  return ["basics", "audience", "requirements", "timing"];
}

/** Shared stepper labels for all non–document-requirement policy types. */
export const POLICY_ENGINE_WIZARD_LABELS = [
  "Basic Information",
  "Applies to",
  "Requirements",
  "Timing & Completion",
  "Review",
] as const;

export const RENEWABLE_POLICY_WIZARD_LABELS = [
  "Basic Information",
  "Applies to",
  "Requirements",
  "Review",
] as const;

export const RETENTION_POLICY_WIZARD_LABELS = [
  "Basic Information",
  "Applies to",
  "Configure Requirements",
  "Review",
] as const;

export function policyEngineWizardLabels(typeCode: string): readonly string[] {
  if (typeCode === "renewable_document") {
    return RENEWABLE_POLICY_WIZARD_LABELS;
  }
  if (typeCode === "retention") {
    return RETENTION_POLICY_WIZARD_LABELS;
  }
  return POLICY_ENGINE_WIZARD_LABELS;
}

/** @deprecated Use POLICY_ENGINE_WIZARD_LABELS */
export const GENERIC_RULE_WIZARD_LABELS = POLICY_ENGINE_WIZARD_LABELS;

export function policyEngineWizardTitle(
  typeName: string,
  step: "configure" | "review",
) {
  const label = typeName.trim() || "rule";
  return step === "review" ? `Review ${label}` : `New ${label}`;
}
