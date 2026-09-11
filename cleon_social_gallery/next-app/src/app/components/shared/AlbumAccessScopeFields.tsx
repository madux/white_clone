"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

export type AlbumAccessScope = "company" | "department" | "branch" | "employee";

interface ScopeTarget {
  id: number;
  name: string;
  department?: string;
}

interface ScopeTargets {
  departments: ScopeTarget[];
  branches: ScopeTarget[];
  employees: ScopeTarget[];
  branches_available: boolean;
}

export function AlbumAccessScopeFields({
  accessScope,
  departmentIds,
  branchIds,
  employeeIds,
  disabled = false,
  onChange,
}: {
  accessScope: AlbumAccessScope;
  departmentIds: number[];
  branchIds: number[];
  employeeIds: number[];
  disabled?: boolean;
  onChange: (values: {
    access_scope: AlbumAccessScope;
    department_ids: number[];
    branch_ids: number[];
    employee_ids: number[];
  }) => void;
}) {
  const [targets, setTargets] = useState<ScopeTargets | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.scopeTargets()
      .then(setTargets)
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

  const toggleId = (key: "department_ids" | "branch_ids" | "employee_ids", id: number) => {
    const current = key === "department_ids" ? departmentIds : key === "branch_ids" ? branchIds : employeeIds;
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    onChange({
      access_scope: accessScope,
      department_ids: key === "department_ids" ? next : departmentIds,
      branch_ids: key === "branch_ids" ? next : branchIds,
      employee_ids: key === "employee_ids" ? next : employeeIds,
    });
  };

  const scopeOptions: { value: AlbumAccessScope; label: string; disabled?: boolean }[] = [
    { value: "company", label: "Everyone in the company" },
    { value: "department", label: "Specific departments" },
    { value: "branch", label: "Specific branches", disabled: !targets?.branches_available },
    { value: "employee", label: "Specific employees" },
  ];

  return (
    <div className="scope-fields">
      {error && <div className="alert-banner">{error}</div>}
      <label>
        Access scope
        <select
          value={accessScope}
          disabled={disabled}
          onChange={(event) => onChange({
            access_scope: event.target.value as AlbumAccessScope,
            department_ids: event.target.value === "department" ? departmentIds : [],
            branch_ids: event.target.value === "branch" ? branchIds : [],
            employee_ids: event.target.value === "employee" ? employeeIds : [],
          })}
        >
          {scopeOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="form-hint">
          Restrict who can view this album beyond its visibility setting.
        </span>
      </label>

      {accessScope === "department" && (
        <div className="scope-multi-select">
          <strong>Departments</strong>
          <div className="scope-chip-list">
            {(targets?.departments || []).map((department) => (
              <label key={department.id} className="scope-chip">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={departmentIds.includes(department.id)}
                  onChange={() => toggleId("department_ids", department.id)}
                />
                <span>{department.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {accessScope === "branch" && targets?.branches_available && (
        <div className="scope-multi-select">
          <strong>Branches</strong>
          <div className="scope-chip-list">
            {(targets?.branches || []).map((branch) => (
              <label key={branch.id} className="scope-chip">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={branchIds.includes(branch.id)}
                  onChange={() => toggleId("branch_ids", branch.id)}
                />
                <span>{branch.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
