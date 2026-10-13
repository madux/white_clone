"use client";

import { EF_FIXED_CATEGORY_ROWS } from "../../../../lib/roleModuleTabs";
import {
  ensureFixedCategoryLines,
  updateCategoryLine,
} from "../../../../lib/roleCategoryLines";
import type { EmployeeFilesRole, EmployeeFilesRoleLine } from "../../../../lib/types";
import ThemedSelect from "../ThemedSelect";
import { PinkSwitch } from "../PinkSwitch";

const SCOPE_OPTIONS = [
  { value: "own_team", label: "Own team" },
  { value: "department", label: "Department" },
  { value: "all", label: "All employees" },
];

const MATRIX_COLUMNS = [
  { key: "view" as const, label: "View" },
  { key: "upload" as const, label: "Upload" },
  { key: "approve" as const, label: "Edit" },
  { key: "download" as const, label: "Download" },
  { key: "delete" as const, label: "Delete" },
  { key: "archive" as const, label: "Archive" },
  { key: "export" as const, label: "Export" },
];

type ActionKey = (typeof MATRIX_COLUMNS)[number]["key"];

export default function RoleEmployeeFilesTab({
  role,
  readOnly,
  moduleOff,
  approvalWorkflowActive,
  onChange,
  onHint,
}: {
  role: EmployeeFilesRole;
  readOnly: boolean;
  moduleOff: boolean;
  approvalWorkflowActive: boolean;
  onChange: (patch: Partial<EmployeeFilesRole>) => void;
  onHint?: (message: string) => void;
}) {
  const lines = ensureFixedCategoryLines(role);
  const perms = role.dms_permissions || {};
  const accessOn = Boolean(perms.view_employee_files);

  function patchLines(nextLines: EmployeeFilesRoleLine[]) {
    onChange({ lines: nextLines });
  }

  function toggleLineAction(
    group: string,
    action: ActionKey,
    enabled: boolean,
  ) {
    if (readOnly || moduleOff) return;
    const line = lines.find((item) => item.category_group === group);
    if (!line) return;
    const actions = { ...line.actions };
    if (enabled && action !== "view" && !actions.view) {
      actions.view = true;
      onHint?.("View added because this action needs it.");
    }
    if (enabled && action === "delete" && !actions.upload) {
      actions.upload = true;
      actions.view = true;
      onHint?.("View and Edit (upload) added because Delete needs them.");
    }
    if (!enabled && action === "view") {
      const active = MATRIX_COLUMNS.filter(
        (col) => col.key !== "view" && actions[col.key],
      );
      if (active.length) {
        const names = active.map((col) => col.label).join(", ");
        const ok = window.confirm(
          `Removing View also removes ${names} for this category. Continue?`,
        );
        if (!ok) return;
        for (const col of MATRIX_COLUMNS) {
          if (col.key !== "view") actions[col.key] = false;
        }
      }
      actions.view = false;
    } else {
      actions[action] = enabled;
    }
    patchLines(updateCategoryLine(lines, group, { actions }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Employee Files access</p>
          <p className="text-xs text-slate-500">Turn off to hide the module for this role.</p>
        </div>
        <PinkSwitch
          checked={accessOn}
          disabled={readOnly || moduleOff}
          onCheckedChange={(checked) => {
            const next = { ...(role.dms_permissions || {}), view_employee_files: checked };
            if (!checked) {
              next.ef_view = false;
            }
            onChange({ dms_permissions: next });
          }}
          aria-label="Employee Files access"
        />
      </div>

      <div className="max-w-md">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Employee scope
        </p>
        <ThemedSelect
          ariaLabel="Employee scope"
          value={role.employee_scope}
          options={SCOPE_OPTIONS}
          disabled={readOnly || moduleOff}
          onChange={(value) =>
            onChange({
              employee_scope: value as EmployeeFilesRole["employee_scope"],
            })
          }
        />
      </div>

      <div className="ef-role-access-matrix-wrap overflow-x-auto">
        <table className="ef-role-access-matrix w-full min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left">Category</th>
              {MATRIX_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EF_FIXED_CATEGORY_ROWS.map(({ group, label }) => {
              const line = lines.find((item) => item.category_group === group)!;
              return (
                <tr key={group}>
                  <td className="font-medium text-slate-800">{label}</td>
                  {MATRIX_COLUMNS.map((col) => {
                    const isOn = Boolean(line.actions[col.key]);
                    const locked =
                      moduleOff ||
                      readOnly ||
                      (col.key !== "view" && !line.actions.view);
                    return (
                      <td key={col.key}>
                        <label
                          className={`ef-role-access-matrix__cell inline-flex ${
                            isOn ? "is-on" : ""
                          } ${locked ? "is-disabled opacity-50" : ""}`}
                          title={locked && col.key !== "view" ? "Needs View" : undefined}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isOn}
                            disabled={locked}
                            onChange={(event) =>
                              toggleLineAction(group, col.key, event.target.checked)
                            }
                          />
                          <span className="ef-role-access-matrix__check" aria-hidden />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {approvalWorkflowActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Upload without approval</p>
            <p className="text-xs text-slate-500">
              Only applies when Approval Workflow is enabled for the organisation.
            </p>
          </div>
          <PinkSwitch
            checked={Boolean(perms.ef_upload_without_approval)}
            disabled={
              readOnly || moduleOff || !perms.ef_upload || !accessOn
            }
            onCheckedChange={(checked) =>
              onChange({
                dms_permissions: {
                  ...perms,
                  ef_upload_without_approval: checked,
                  ef_upload: true,
                  ef_view: true,
                  view_employee_files: true,
                },
              })
            }
            aria-label="Upload without approval"
          />
        </div>
      ) : null}
    </div>
  );
}
