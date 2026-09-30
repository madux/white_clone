"use client";

import OrganizationalAccessScopeFields, {
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import ThemedSelect from "./ThemedSelect";
import {
  allowedAccessScopes,
  allowedVisibilityModes,
  coerceAccessScope,
  coerceVisibilityMode,
  type OrgVisibilityMode,
} from "../../../lib/organizationalFolderScope";

export type { OrgVisibilityMode };

export function visibilityToAccessScope(
  mode: OrgVisibilityMode,
  restrictedScope: string,
): string {
  if (mode === "public") return "all_staff";
  if (mode === "private") return "private";
  if (mode === "admin_only") return "admin_only";
  return restrictedScope;
}

export function accessScopeToVisibility(accessScope: string): {
  mode: OrgVisibilityMode;
  restrictedScope: string;
} {
  if (accessScope === "private") {
    return { mode: "private", restrictedScope: "department" };
  }
  if (accessScope === "admin_only") {
    return { mode: "admin_only", restrictedScope: "department" };
  }
  if (accessScope === "all_staff") {
    return { mode: "public", restrictedScope: "department" };
  }
  return { mode: "restricted", restrictedScope: accessScope };
}

export function validateOrganizationalVisibility(
  mode: OrgVisibilityMode,
  restrictedScope: string,
  scopeIds: number[],
) {
  if (mode === "restricted") {
    return validateOrganizationalScope(restrictedScope, scopeIds);
  }
  return null;
}

type ScopeTarget = { id: number; name: string };

const VISIBILITY_LABELS: Record<OrgVisibilityMode, string> = {
  public: "Public",
  restricted: "Restricted",
  private: "Private",
  admin_only: "Admin only",
};

export default function OrganizationalVisibilityFields({
  visibilityMode,
  onVisibilityModeChange,
  restrictedScope,
  onRestrictedScopeChange,
  scopeIds,
  onScopeIdsChange,
  scopeSearch,
  onScopeSearchChange,
  departments,
  grades,
  employees,
  parentAccessScope,
}: {
  visibilityMode: OrgVisibilityMode;
  onVisibilityModeChange: (value: OrgVisibilityMode) => void;
  restrictedScope: string;
  onRestrictedScopeChange: (value: string) => void;
  scopeIds: number[];
  onScopeIdsChange: (value: number[]) => void;
  scopeSearch: string;
  onScopeSearchChange: (value: string) => void;
  departments: ScopeTarget[];
  grades: ScopeTarget[];
  employees: ScopeTarget[];
  parentAccessScope?: string;
}) {
  const modes = allowedVisibilityModes(parentAccessScope);
  const mode = coerceVisibilityMode(visibilityMode, parentAccessScope);
  const restricted = coerceAccessScope(restrictedScope, parentAccessScope);

  return (
    <div className="grid gap-4 sm:col-span-2">
      <label>
        <span className="label">Visibility</span>
        <ThemedSelect
          value={mode}
          onChange={(value) => onVisibilityModeChange(value as OrgVisibilityMode)}
          options={modes.map((value) => ({
            value,
            label: VISIBILITY_LABELS[value],
          }))}
        />
      </label>
      {mode === "restricted" ? (
        <OrganizationalAccessScopeFields
          accessScope={restricted}
          onAccessScopeChange={onRestrictedScopeChange}
          scopeIds={scopeIds}
          onScopeIdsChange={onScopeIdsChange}
          scopeSearch={scopeSearch}
          onScopeSearchChange={onScopeSearchChange}
          departments={departments}
          grades={grades}
          employees={employees}
          allowedScopes={allowedAccessScopes(parentAccessScope).filter(
            (scope) => !["all_staff", "private"].includes(scope),
          )}
        />
      ) : null}
    </div>
  );
}
