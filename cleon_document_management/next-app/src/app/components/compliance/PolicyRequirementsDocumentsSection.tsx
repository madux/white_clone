"use client";

import type { PolicyCreateFormState } from "../../../../lib/policyCreateForm";
import { documentTypesForPicker } from "../../../../lib/complianceDocumentTypes";
import {
  documentPickerExpiryTypesOnly,
  documentPickerVariantForPolicyType,
  policyTypeUsesDocumentTypeList,
} from "../../../../lib/policyDocumentPicker";
import { useMemo } from "react";
import type { DocumentType } from "../../../../lib/types";
import { DocumentRequirementDocumentsPanel } from "./DocumentRequirementWizardPanels";

type Props = {
  typeCode: string;
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  selectableDocumentTypes: DocumentType[];
  documentTypeError?: string;
  onDocumentTypesChange?: () => void;
};

/** Modal-style document list + picker used across policy types (matches document-requirement wizard). */
export function PolicyRequirementsDocumentsSection({
  typeCode,
  form,
  setForm,
  selectableDocumentTypes,
  documentTypeError,
  onDocumentTypesChange,
}: Props) {
  const typesForPolicy = useMemo(
    () => documentTypesForPicker(selectableDocumentTypes),
    [selectableDocumentTypes],
  );

  if (!policyTypeUsesDocumentTypeList(typeCode)) {
    return null;
  }
  return (
    <DocumentRequirementDocumentsPanel
      form={form}
      setForm={setForm}
      selectableDocumentTypes={typesForPolicy}
      documentTypeError={documentTypeError}
      onDocumentTypesChange={onDocumentTypesChange}
      variant={documentPickerVariantForPolicyType(typeCode)}
      expiryTypesOnly={documentPickerExpiryTypesOnly(typeCode)}
    />
  );
}
