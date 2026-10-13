export type TenantModuleKey =
  | "employee_files"
  | "organizational_files"
  | "templates_forms"
  | "compliance"
  | "document_intelligence"
  | "signatures"
  | "audit_trail"
  | "approval_workflow"
  | "triggers_alerts"
  | "retention_legal_hold"
  | "cleonai";

export type TenantModulesMap = Partial<Record<TenantModuleKey, boolean>>;

export type TenantModuleDefinition = {
  key: TenantModuleKey;
  label: string;
  description: string;
  requires?: TenantModuleKey[];
  requiresAny?: TenantModuleKey[];
  navKeys?: string[];
};

export const TENANT_MODULE_DEFINITIONS: TenantModuleDefinition[] = [
  {
    key: "employee_files",
    label: "Employee Files",
    description: "HR employee folders, profiles, uploads, and EF administration.",
    navKeys: ["employee_files"],
  },
  {
    key: "organizational_files",
    label: "Organisational Files",
    description: "Company library, folders, policies, and shared records.",
    navKeys: ["organizational_files"],
  },
  {
    key: "templates_forms",
    label: "Templates & Forms",
    description: "Template library and form distribution (under Organisational Files).",
    requires: ["organizational_files"],
    navKeys: ["templates_forms"],
  },
  {
    key: "compliance",
    label: "Compliance",
    description: "Compliance programmes, rules, runs, and employee evaluations.",
    requires: ["employee_files"],
    navKeys: ["compliance_admin", "self_service_compliance", "self_service_reviews"],
  },
  {
    key: "document_intelligence",
    label: "Document Intelligence",
    description: "Datasets, validation, and insights across your documents.",
    requiresAny: ["employee_files", "organizational_files"],
    navKeys: ["document_intelligence"],
  },
  {
    key: "signatures",
    label: "Signatures",
    description: "Policy acknowledgement and signature requests.",
    requires: ["organizational_files"],
  },
  {
    key: "audit_trail",
    label: "Audit trail",
    description: "Cross-module activity and audit exports.",
    navKeys: ["audit_trail"],
  },
  {
    key: "approval_workflow",
    label: "Approval workflow",
    description: "Upload and change approvals for Employee and Organisational Files.",
    requiresAny: ["employee_files", "organizational_files"],
    navKeys: ["self_service_approvals"],
  },
  {
    key: "triggers_alerts",
    label: "Triggers & Alerts",
    description: "Automation triggers tied to documents and compliance.",
    requiresAny: ["employee_files", "organizational_files", "compliance"],
  },
  {
    key: "retention_legal_hold",
    label: "Retention & legal hold",
    description: "Retention policies and legal holds on organisational content.",
    requires: ["organizational_files"],
  },
  {
    key: "cleonai",
    label: "CleonAI",
    description: "AI-assisted authoring and assistance (when licensed).",
    requiresAny: ["document_intelligence"],
  },
];

export const DEFAULT_TENANT_MODULES: Record<TenantModuleKey, boolean> =
  TENANT_MODULE_DEFINITIONS.reduce(
    (acc, item) => {
      acc[item.key] = true;
      return acc;
    },
    {} as Record<TenantModuleKey, boolean>,
  );

export function mergeTenantModules(
  raw?: TenantModulesMap | null,
): Record<TenantModuleKey, boolean> {
  const merged = { ...DEFAULT_TENANT_MODULES };
  if (!raw) return merged;
  for (const def of TENANT_MODULE_DEFINITIONS) {
    if (typeof raw[def.key] === "boolean") {
      merged[def.key] = raw[def.key]!;
    }
  }
  return merged;
}

export function isTenantModuleEnabled(
  modules: TenantModulesMap | null | undefined,
  key: TenantModuleKey | string,
): boolean {
  if (!(key in DEFAULT_TENANT_MODULES)) {
    return true;
  }
  const merged = mergeTenantModules(modules);
  return merged[key as TenantModuleKey] !== false;
}

/** Nav / workspace module key → tenant module key */
export function tenantKeyForNavModule(navKey: string | null | undefined): TenantModuleKey | null {
  if (!navKey) return null;
  if (navKey === "compliance_admin") return "compliance";
  for (const def of TENANT_MODULE_DEFINITIONS) {
    if (def.navKeys?.includes(navKey)) {
      return def.key;
    }
  }
  if (navKey in DEFAULT_TENANT_MODULES) {
    return navKey as TenantModuleKey;
  }
  return null;
}

export function isNavModuleEnabled(
  modules: TenantModulesMap | null | undefined,
  navKey: string | null | undefined,
): boolean {
  const tenantKey = tenantKeyForNavModule(navKey);
  if (!tenantKey) return true;
  return isTenantModuleEnabled(modules, tenantKey);
}

export function applyTenantModuleToggle(
  current: Record<TenantModuleKey, boolean>,
  key: TenantModuleKey,
  enabled: boolean,
): { modules: Record<TenantModuleKey, boolean>; notes: string[] } {
  const next = { ...current, [key]: enabled };
  const notes: string[] = [];
  if (!enabled) {
    return { modules: next, notes };
  }
  const def = TENANT_MODULE_DEFINITIONS.find((item) => item.key === key);
  if (!def) return { modules: next, notes };
  for (const req of def.requires ?? []) {
    if (!next[req]) {
      next[req] = true;
      notes.push(
        `${TENANT_MODULE_DEFINITIONS.find((d) => d.key === req)?.label ?? req} was enabled because ${def.label} requires it.`,
      );
    }
  }
  if (def.requiresAny?.length) {
    const anyOn = def.requiresAny.some((k) => next[k]);
    if (!anyOn) {
      const fallback = def.requiresAny[0];
      next[fallback] = true;
      notes.push(
        `${TENANT_MODULE_DEFINITIONS.find((d) => d.key === fallback)?.label ?? fallback} was enabled because ${def.label} needs a content module.`,
      );
    }
  }
  return { modules: next, notes };
}

export function disableBlockedReason(
  current: Record<TenantModuleKey, boolean>,
  key: TenantModuleKey,
): string | null {
  if (current[key]) {
    for (const def of TENANT_MODULE_DEFINITIONS) {
      if (!current[def.key]) continue;
      if (def.requires?.includes(key)) {
        return `Turn off ${def.label} before disabling ${TENANT_MODULE_DEFINITIONS.find((d) => d.key === key)?.label ?? key}.`;
      }
    }
  }
  return null;
}
