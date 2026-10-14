/** Shared document-type picker rules across compliance policy / rule forms. */

export type PolicyDocumentPickerVariant =
  | "document_requirement"
  | "renewable_document"
  | "retention";

export function policyTypeUsesDocumentTypeList(typeCode: string): boolean {
  return (
    typeCode !== "compliance_request" && typeCode !== "review_schedule"
  );
}

export function documentPickerVariantForPolicyType(
  typeCode: string,
): PolicyDocumentPickerVariant {
  if (typeCode === "renewable_document") {
    return "renewable_document";
  }
  if (typeCode === "retention") {
    return "retention";
  }
  return "document_requirement";
}

export function documentPickerExpiryTypesOnly(typeCode: string): boolean {
  return typeCode === "renewable_document";
}
