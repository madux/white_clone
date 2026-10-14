"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import AppSelect from "./AppSelect";

export type AlbumAccessScope =
  | "company"
  | "department"
  | "branch"
  | "unit"
  | "grade"
  | "employee"
  | "custom_group";

interface ScopeTarget {
  id: number;
  name: string;
  department?: string;
  member_count?: number;
}

interface ScopeTargets {
  departments: ScopeTarget[];
  branches: ScopeTarget[];
  units: ScopeTarget[];
  grades: ScopeTarget[];
  custom_groups: ScopeTarget[];
  employees: ScopeTarget[];
  branches_available: boolean;
  units_available: boolean;
  grades_available: boolean;
}

export type AlbumScopeValues = {
  access_scope: AlbumAccessScope;
  department_ids: number[];
  branch_ids: number[];
  unit_ids: number[];
  grade_ids: number[];
  custom_group_ids: number[];
  employee_ids: number[];
};

export function AlbumAccessScopeFields({
  accessScope,
  departmentIds,
  branchIds,
  unitIds,
  gradeIds,
  customGroupIds,
  employeeIds,
  disabled = false,
  onChange,
}: {
  accessScope: AlbumAccessScope;
  departmentIds: number[];
  branchIds: number[];
  unitIds: number[];
  gradeIds: number[];
  customGroupIds: number[];
  employeeIds: number[];
  disabled?: boolean;
  onChange: (values: AlbumScopeValues) => void;
}) {
  const [targets, setTargets] = useState<ScopeTargets | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.scopeTargets()
      .then((data) => setTargets({
        departments: data.departments || [],
        branches: data.branches || [],
        units: data.units || [],
        grades: data.grades || [],
        custom_groups: data.custom_groups || [],
        employees: data.employees || [],
        branches_available: data.branches_available,
        units_available: data.units_available ?? !!(data.units?.length),
        grades_available: data.grades_available ?? !!(data.grades?.length),
      }))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load scope options"));
  }, []);

  const filteredEmployees = useMemo(() => {
    const list = targets?.employees || [];
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return list.slice(0, 50);
    return list.filter((employee) =>
      employee.name.toLowerCase().includes(query)
      || (employee.department || "").toLowerCase().includes(query),
    ).slice(0, 50);
  }, [employeeSearch, targets]);

  const emit = (patch: Partial<AlbumScopeValues>) => onChange({
    access_scope: accessScope,
    department_ids: departmentIds,
    branch_ids: branchIds,
    unit_ids: unitIds,
    grade_ids: gradeIds,
    custom_group_ids: customGroupIds,
    employee_ids: employeeIds,
    ...patch,
  });

  const toggleId = (
    key: "department_ids" | "branch_ids" | "unit_ids" | "grade_ids" | "custom_group_ids" | "employee_ids",
    id: number,
  ) => {
    const map: Record<string, number[]> = {
      department_ids: departmentIds,
      branch_ids: branchIds,
      unit_ids: unitIds,
      grade_ids: gradeIds,
      custom_group_ids: customGroupIds,
      employee_ids: employeeIds,
    };
    const current = map[key];
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    emit({ [key]: next } as Partial<AlbumScopeValues>);
  };

  const scopeOptions: { value: AlbumAccessScope; label: string; disabled?: boolean }[] = [
    { value: "company", label: "Everyone in the company" },
    { value: "department", label: "Specific departments" },
    { value: "branch", label: "Specific branches", disabled: !targets?.branches_available },
    { value: "unit", label: "Specific units", disabled: !targets?.units_available },
    { value: "grade", label: "Grade levels", disabled: !targets?.grades_available },
    { value: "custom_group", label: "Custom groups" },
    { value: "employee", label: "Specific employees" },
  ];

  const onScopeChange = (value: AlbumAccessScope) => {
    emit({
      access_scope: value,
      department_ids: value === "department" ? departmentIds : [],
      branch_ids: value === "branch" ? branchIds : [],
      unit_ids: value === "unit" ? unitIds : [],
      grade_ids: value === "grade" ? gradeIds : [],
      custom_group_ids: value === "custom_group" ? customGroupIds : [],
      employee_ids: value === "employee" ? employeeIds : [],
    });
  };

  const chipList = (
    key: "department_ids" | "branch_ids" | "unit_ids" | "grade_ids" | "custom_group_ids",
    label: string,
    items: ScopeTarget[],
  ) => (
    <div className="scope-multi-select">
      <strong>{label}</strong>
      <div className="scope-chip-list">
        {items.map((item) => (
          <label key={item.id} className="scope-chip">
            <input
              type="checkbox"
              disabled={disabled}
              checked={(key === "department_ids" ? departmentIds
                : key === "branch_ids" ? branchIds
                  : key === "unit_ids" ? unitIds
                    : key === "grade_ids" ? gradeIds
                      : customGroupIds).includes(item.id)}
              onChange={() => toggleId(key, item.id)}
            />
            <span>
              {item.name}
              {item.member_count != null ? <small>{item.member_count} members</small> : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="scope-fields">
      {error && <div className="alert-banner">{error}</div>}
      <label>
        Access scope
        <AppSelect
          value={accessScope}
          disabled={disabled}
          options={scopeOptions.map((option) => ({
            value: option.value,
            label: option.label,
            disabled: option.disabled,
          }))}
          onChange={(value) => onScopeChange(value as AlbumAccessScope)}
          ariaLabel="Album access scope"
        />
        <span className="form-hint">
          Users without an employee record cannot access scoped albums (fail-closed).
        </span>
      </label>

      {accessScope === "department" && chipList("department_ids", "Departments", targets?.departments || [])}
      {accessScope === "branch" && targets?.branches_available && chipList("branch_ids", "Branches", targets?.branches || [])}
      {accessScope === "unit" && targets?.units_available && chipList("unit_ids", "Units", targets?.units || [])}
      {accessScope === "grade" && targets?.grades_available && chipList("grade_ids", "Grades", targets?.grades || [])}
      {accessScope === "custom_group" && chipList("custom_group_ids", "Custom groups", targets?.custom_groups || [])}

      {accessScope === "employee" && (
        <div className="scope-multi-select">
          <strong>Employees</strong>
          <input
            value={employeeSearch}
            disabled={disabled}
            placeholder="Search employees"
            onChange={(event) => setEmployeeSearch(event.target.value)}
          />
          <div className="scope-chip-list">
            {filteredEmployees.map((employee) => (
              <label key={employee.id} className="scope-chip">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={employeeIds.includes(employee.id)}
                  onChange={() => toggleId("employee_ids", employee.id)}
                />
                <span>
                  {employee.name}
                  {employee.department ? <small>{employee.department}</small> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
