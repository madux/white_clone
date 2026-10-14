"use client";

import type { PolicyCreateFormState } from "../../../../lib/policyCreateForm";
import type { DocumentType } from "../../../../lib/types";
import type { PolicyWizardFieldId } from "../../../../lib/policyWizardFieldErrors";
import { PolicyRequirementsDocumentsSection } from "./PolicyRequirementsDocumentsSection";
import { WizardSectionHeader } from "./WizardSectionHeader";
import {
  RetentionActionModeFields,
  RetentionSettingsRulesTable,
  useRetentionSettingRules,
} from "./retentionPolicyFields";

type Props = {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  selectableDocumentTypes: DocumentType[];
  fieldErrors?: Partial<Record<PolicyWizardFieldId, string>>;
  onFieldEdit?: (id: PolicyWizardFieldId) => void;
};

export default function RetentionPolicyWizardPanel({
  form,
  setForm,
  selectableDocumentTypes,
  fieldErrors = {},
  onFieldEdit,
}: Props) {
  const { rules, loading, missingTypeIds } = useRetentionSettingRules(
    form.document_type_ids,
  );

  return (
    <div className="w-full min-w-0 space-y-8">
      <section className="space-y-4">
        <PolicyRequirementsDocumentsSection
          typeCode="retention"
          form={form}
          setForm={setForm}
          selectableDocumentTypes={selectableDocumentTypes}
          documentTypeError={fieldErrors.document_type_ids}
          onDocumentTypesChange={() => onFieldEdit?.("document_type_ids")}
        />
      </section>

      <section className="space-y-4">
        <WizardSectionHeader
          letter=""
          title="Rules from Settings → Retention Settings"
          badgeCount={1}
          description="Summary of retention periods configured for each selected document type."
        />
        <RetentionSettingsRulesTable
          documentTypeIds={form.document_type_ids}
          rules={rules}
          loading={loading}
          missingTypeIds={missingTypeIds}
          compactNote
        />
      </section>

      <section className="space-y-4">
        <WizardSectionHeader
          letter="B"
          title="Action mode"
          badgeCount={2}
          description="Choose how archive and delete actions run when retention dates are reached."
        />
        <RetentionActionModeFields form={form} setForm={setForm} layout="wizard" />
      </section>
    </div>
  );
}
