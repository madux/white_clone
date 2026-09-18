/** Odoo origin for authenticated preview/download (same tab as the Next app). */
export function odooAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");
}

export function documentPreviewUrl(
  documentId: number,
  options?: { variant?: "default" | "current" | "pending" },
): string {
  const base = `${odooAppOrigin()}/document-management/document/${documentId}/preview`;
  const variant = options?.variant;
  if (variant && variant !== "default") {
    return `${base}?variant=${variant}`;
  }
  return base;
}

export function documentVersionPreviewUrl(versionId: number): string {
  return `${odooAppOrigin()}/document-management/document/version/${versionId}/preview`;
}
