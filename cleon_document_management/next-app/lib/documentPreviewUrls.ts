/** Odoo origin for authenticated preview/download (same tab as the Next app). */
export function odooAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");
}

export function documentPreviewUrl(
  documentId: number,
  options?: {
    variant?: "default" | "current" | "pending";
    auditSource?: string;
  },
): string {
  const base = `${odooAppOrigin()}/document-management/document/${documentId}/preview`;
  const params = new URLSearchParams();
  const variant = options?.variant;
  if (variant && variant !== "default") {
    params.set("variant", variant);
  }
  if (options?.auditSource) {
    params.set("audit_source", options.auditSource);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function documentVersionPreviewUrl(versionId: number): string {
  return `${odooAppOrigin()}/document-management/document/version/${versionId}/preview`;
}
