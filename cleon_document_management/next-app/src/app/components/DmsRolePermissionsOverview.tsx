"use client";

import {
  Building2,
  ClipboardCheck,
  FileStack,
  LayoutGrid,
  Settings2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  countEnabledInArea,
  DMS_PERMISSION_AREAS,
  EMPLOYEE_SCOPE_LABELS,
  type DmsPermissionAreaId,
} from "../../../lib/dmsRolePermissionCatalog";
import { toggleDmsPermission } from "../../../lib/rolePermissionRules";
import type { DmsPermissionsMap } from "../../../lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";
import { Lock } from "lucide-react";

const AREA_TABS = DMS_PERMISSION_AREAS.map((area) => {
  const icon =
    area.id === "workspace"
      ? LayoutGrid
      : area.id === "employee"
        ? Users
        : area.id === "organization"
          ? Building2
          : area.id === "compliance"
            ? ClipboardCheck
            : area.id === "templates"
              ? FileStack
              : Settings2;
  return {
    id: area.id,
    label: area.title,
    icon,
  };
});

export default function DmsRolePermissionsOverview({
  permissions,
  employeeScope,
  readOnly = true,
  onPermissionsChange,
  areaIdOnly,
  moduleOff = false,
  onPermissionHint,
  hideModuleTabs = false,
}: {
  permissions?: Partial<DmsPermissionsMap>;
  employeeScope?: "own_team" | "department" | "all";
  readOnly?: boolean;
  onPermissionsChange?: (next: Partial<DmsPermissionsMap>) => void;
  areaIdOnly?: DmsPermissionAreaId;
  moduleOff?: boolean;
  onPermissionHint?: (message: string) => void;
  hideModuleTabs?: boolean;
}) {
  const merged = useMemo(() => ({ ...(permissions || {}) }), [permissions]);
  const [areaId, setAreaId] = useState<DmsPermissionAreaId>(
    areaIdOnly || "workspace",
  );
  const effectiveAreaId = areaIdOnly || areaId;
  const area = DMS_PERMISSION_AREAS.find((item) => item.id === effectiveAreaId)!;
  const { enabled, total } = countEnabledInArea(merged, effectiveAreaId);

  const tabItems = useMemo(
    () =>
      AREA_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
      })),
    [],
  );

  const lead = readOnly
    ? "Standard roles use a fixed permission set. You can change employee scope and assign users on the Assign to users tab."
    : "Choose which capabilities this custom role grants. Users receive the union of all roles assigned to them.";

  function isLocked(key: keyof DmsPermissionsMap & string): boolean {
    if (moduleOff || readOnly) return true;
    if (key.startsWith("ef_") && key !== "ef_view" && !merged.ef_view) {
      return true;
    }
    const parent = key.endsWith("_without_approval")
      ? key.replace("_without_approval", "")
      : null;
    if (parent && parent in merged && !merged[parent as keyof DmsPermissionsMap]) {
      return true;
    }
    return false;
  }

  function togglePermission(key: keyof DmsPermissionsMap & string, next: boolean) {
    if (readOnly || !onPermissionsChange || moduleOff) return;
    if (!next && key === "ef_view") {
      const children = area.groups
        .flatMap((g) => g.items)
        .filter((item) => item.key.startsWith("ef_") && item.key !== "ef_view")
        .filter((item) => merged[item.key]);
      if (children.length) {
        const names = children.map((item) => item.label).join(", ");
        const confirmed = window.confirm(
          `Removing View also removes ${names} on employee files. Continue?`,
        );
        if (!confirmed) return;
      }
    }
    const result = toggleDmsPermission(merged, key, next);
    onPermissionsChange(result.permissions);
    if (result.message) onPermissionHint?.(result.message);
  }

  return (
    <section className="dms-role-permissions" aria-labelledby="dms-role-permissions-title">
      <header className="dms-role-permissions__header">
        <div>
          <h3 id="dms-role-permissions-title" className="dms-role-permissions__title">
            Permissions
          </h3>
          <p className="dms-role-permissions__lead">{lead}</p>
        </div>
      </header>

      {!hideModuleTabs && !areaIdOnly ? (
        <SectionTabs
          ariaLabel="Permission modules"
          value={areaId}
          onChange={setAreaId}
          items={tabItems}
          level="nested"
          stretch
          className="dms-role-permissions__tabs"
        />
      ) : null}

      <div className="dms-role-permissions__panel">
        {moduleOff ? (
          <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Module off — permissions are kept but inactive until the module is enabled in
            Settings → Modules.
          </p>
        ) : null}
        <div className="dms-role-permissions__panel-head">
          <div>
            <h4 className="dms-role-permissions__panel-title">{area.title}</h4>
            <p className="dms-role-permissions__panel-desc">{area.description}</p>
          </div>
          <p className="dms-role-permissions__panel-stat" aria-live="polite">
            <span className="dms-role-permissions__panel-stat-value">{enabled}</span>
            <span className="dms-role-permissions__panel-stat-label">
              of {total} enabled
            </span>
          </p>
        </div>

        {effectiveAreaId === "employee" && employeeScope ? (
          <p className="dms-role-permissions__scope">
            Employee scope for this role:{" "}
            <strong>{EMPLOYEE_SCOPE_LABELS[employeeScope]}</strong>
          </p>
        ) : null}

        <div className="dms-role-permissions__groups">
          {area.groups.map((group) => (
            <div key={group.title} className="dms-role-permissions__group">
              <p className="dms-role-permissions__group-title">{group.title}</p>
              <ul className="dms-role-permissions__list">
                {group.items.map((item) => {
                  const isOn = Boolean(merged[item.key]);
                  const locked = isLocked(item.key);
                  return (
                    <li key={item.key} className="dms-role-permissions__row">
                      {readOnly || moduleOff ? (
                        <div className="dms-role-permissions__row-text">
                          <span className="dms-role-permissions__row-label">
                            {item.label}
                          </span>
                          <span className="dms-role-permissions__row-desc">
                            {item.description}
                          </span>
                        </div>
                      ) : (
                        <label
                          className={`dms-role-permissions__row-edit flex min-w-0 flex-1 items-start gap-3 ${
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                          }`}
                          title={locked ? "Needs View" : undefined}
                        >
                          {locked ? (
                            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          ) : (
                            <Checkbox
                              checked={isOn}
                              onCheckedChange={(checked) =>
                                togglePermission(item.key, checked === true)
                              }
                              className="mt-0.5"
                            />
                          )}
                          <span className="dms-role-permissions__row-text">
                            <span className="dms-role-permissions__row-label">
                              {item.label}
                            </span>
                            <span className="dms-role-permissions__row-desc">
                              {item.description}
                            </span>
                          </span>
                        </label>
                      )}
                      {readOnly ? (
                        <StatusPill
                          label={isOn ? "Included" : "Not included"}
                          tone={isOn ? "ok" : "neutral"}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
