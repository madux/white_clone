"use client";

import { type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  MATRIX_COLUMNS,
  ROLE_MATRIX_MODULES,
  applyEmployeeScope,
  applyMatrixColumnToggle,
  employeeScopeOptions,
  matrixColumnChecked,
  matrixColumnState,
  type RoleMatrixModuleRow,
} from "../../../../lib/rolePermissionsMatrix";
import type { EmployeeFilesRole } from "../../../../lib/types";
import ThemedSelect from "../ThemedSelect";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";

function MatrixCellFrame({ children }: { children: ReactNode }) {
  return <span className="ef-role-matrix-cell">{children}</span>;
}

function MatrixCell({
  state,
  disabled,
  label,
  onChange,
}: {
  state: "on" | "off" | "na" | "locked";
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  if (state === "na") {
    return (
      <MatrixCellFrame>
        <span className="text-base leading-none text-slate-300" aria-hidden="true">
          —
        </span>
      </MatrixCellFrame>
    );
  }
  if (state === "locked") {
    return (
      <MatrixCellFrame>
        <span className="text-slate-400" title="Locked">
          <Lock className="h-4 w-4" aria-label={`${label} locked`} />
        </span>
      </MatrixCellFrame>
    );
  }
  const checked = state === "on";
  const readOnly = Boolean(disabled);
  return (
    <MatrixCellFrame>
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={(value) => onChange(value === true)}
        className={cn(
          disabled && "pointer-events-none cursor-default opacity-100",
          readOnly
            ? "border-slate-300 bg-white data-checked:border-slate-400 data-checked:bg-slate-200 data-checked:text-slate-600 dark:data-checked:bg-slate-200"
            : "data-checked:border-brand-pink data-checked:bg-brand-pink dark:data-checked:bg-brand-pink",
        )}
      />
    </MatrixCellFrame>
  );
}

export default function RolePermissionsMatrix({
  role,
  readOnly,
  moduleOffForRow,
  onChange,
  onHint,
}: {
  role: EmployeeFilesRole;
  readOnly: boolean;
  moduleOffForRow: (row: RoleMatrixModuleRow) => boolean;
  onChange: (role: EmployeeFilesRole) => void;
  onHint?: (message: string) => void;
}) {
  const perms = role.dms_permissions || {};

  return (
    <div className="ef-role-matrix-wrap overflow-x-auto">
      <table className="ef-role-matrix w-full min-w-[880px]">
        <thead>
          <tr>
            <th className="text-left">Module</th>
            <th className="text-left">Scope</th>
            {MATRIX_COLUMNS.map((col) => (
              <th key={col.id} className="text-center">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLE_MATRIX_MODULES.map((row) => {
            const moduleOff = moduleOffForRow(row);
            const rowReadOnly = readOnly || moduleOff;
            return (
              <tr key={row.id}>
                <td className="font-semibold text-slate-800">{row.label}</td>
                <td className="min-w-[9rem]">
                  {row.scopeMode === "employee" ? (
                    <ThemedSelect
                      ariaLabel={`${row.label} scope`}
                      value={role.employee_scope}
                      disabled={rowReadOnly}
                      options={employeeScopeOptions().map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                      onChange={(value) =>
                        onChange(
                          applyEmployeeScope(
                            role,
                            value as EmployeeFilesRole["employee_scope"],
                          ),
                        )
                      }
                    />
                  ) : (
                    <span className="text-sm text-slate-500">
                      {row.staticScopeLabel || "—"}
                    </span>
                  )}
                </td>
                {MATRIX_COLUMNS.map((col) => {
                  const state = matrixColumnState(perms, row, col.id);
                  const spec = row.columns[col.id];
                  const needsView =
                    !rowReadOnly &&
                    col.id !== "view" &&
                    spec &&
                    spec !== "na" &&
                    spec !== "locked" &&
                    !matrixColumnChecked(perms, row, "view") &&
                    state === "off";
                  return (
                    <td key={col.id} className="ef-role-matrix-perm-cell text-center">
                      <MatrixCell
                        state={state}
                        disabled={rowReadOnly || needsView}
                        label={`${row.label} ${col.label}`}
                        onChange={(enabled) => {
                          const result = applyMatrixColumnToggle(
                            role,
                            row,
                            col.id,
                            enabled,
                          );
                          onChange(result.role);
                          if (result.message) onHint?.(result.message);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
