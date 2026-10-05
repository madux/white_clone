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
import type { DmsPermissionsMap } from "../../../lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";

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
}: {
  permissions?: Partial<DmsPermissionsMap>;
  employeeScope?: "own_team" | "department" | "all";
  readOnly?: boolean;
  onPermissionsChange?: (next: Partial<DmsPermissionsMap>) => void;
}) {
  const merged = useMemo(() => ({ ...(permissions || {}) }), [permissions]);
  const [areaId, setAreaId] = useState<DmsPermissionAreaId>("workspace");
  const area = DMS_PERMISSION_AREAS.find((item) => item.id === areaId)!;
  const { enabled, total } = countEnabledInArea(merged, areaId);

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

  function togglePermission(key: keyof DmsPermissionsMap & string, next: boolean) {
    if (readOnly || !onPermissionsChange) return;
    onPermissionsChange({ ...merged, [key]: next });
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

      <SectionTabs
        ariaLabel="Permission modules"
        value={areaId}
        onChange={setAreaId}
        items={tabItems}
        level="nested"
        stretch
        className="dms-role-permissions__tabs"
      />

      <div className="dms-role-permissions__panel">
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

        {areaId === "employee" && employeeScope ? (
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
                  return (
                    <li key={item.key} className="dms-role-permissions__row">
                      {readOnly ? (
                        <div className="dms-role-permissions__row-text">
                          <span className="dms-role-permissions__row-label">
                            {item.label}
                          </span>
                          <span className="dms-role-permissions__row-desc">
                            {item.description}
                          </span>
                        </div>
                      ) : (
                        <label className="dms-role-permissions__row-edit flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <Checkbox
                            checked={isOn}
                            onCheckedChange={(checked) =>
                              togglePermission(item.key, checked === true)
                            }
                            className="mt-0.5"
                          />
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
