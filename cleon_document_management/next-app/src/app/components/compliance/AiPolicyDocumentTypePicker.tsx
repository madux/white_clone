"use client";

import { useMemo } from "react";
import { defaultPolicyForm } from "../../../../lib/policyCreateForm";
import { policyTypeUsesDocumentTypeList } from "../../../../lib/policyDocumentPicker";
import type { DocumentType } from "../../../../lib/types";
import { PolicyRequirementsDocumentsSection } from "./PolicyRequirementsDocumentsSection";

type Props = {
  typeCode: string;
  policyTypeId: string;
  documentTypeIds: number[];
  onDocumentTypeIdsChange: (ids: number[]) => void;
  selectableDocumentTypes: DocumentType[];
};

/** AI brief step: same document picker chrome as the policy wizards. */
export function AiPolicyDocumentTypePicker({
  typeCode,
  policyTypeId,
  documentTypeIds,
  onDocumentTypeIdsChange,
  selectableDocumentTypes,
}: Props) {
  const form = useMemo(
    () => ({
      ...defaultPolicyForm(policyTypeId),
      document_type_ids: documentTypeIds,
    }),
    [documentTypeIds, policyTypeId],
  );

  if (!policyTypeUsesDocumentTypeList(typeCode)) {
    return null;
  }

  return (
    <PolicyRequirementsDocumentsSection
      typeCode={typeCode}
      form={form}
      setForm={(next) => onDocumentTypeIdsChange(next.document_type_ids)}
      selectableDocumentTypes={selectableDocumentTypes}
    />
  );
}
