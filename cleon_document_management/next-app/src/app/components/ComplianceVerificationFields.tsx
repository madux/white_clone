"use client";

import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import type { DocumentType } from "../../../lib/types";
import { policyTypeUsesVerification } from "../../../lib/verificationPolicy";
import { PolicyWizardVerificationPanel } from "./compliance/DocumentRequirementWizardPanels";

export default function ComplianceVerificationFields({
  form,
  setForm,
  typeCode = "",
  documentTypes,
  entityName = "rule",
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  typeCode?: string;
  documentTypes?: DocumentType[];
  entityName?: "rule" | "policy";
}) {
  if (!policyTypeUsesVerification(typeCode)) {
    return null;
  }
  return (
    <div className="sm:col-span-2">
      <PolicyWizardVerificationPanel
        form={form}
        setForm={setForm}
        documentTypes={documentTypes ?? []}
        entityName={entityName}
        typeCode={typeCode}
      />
    </div>
  );
}
