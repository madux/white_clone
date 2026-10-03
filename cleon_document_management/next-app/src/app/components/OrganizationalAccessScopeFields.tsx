"use client";

import ThemedSelect from "./ThemedSelect";
import EmployeeMetricPicker from "./EmployeeMetricPicker";

type ScopeTarget = {
  id: number;
  name: string;
  department?: string;
  department_name?: string;
  job_title?: string;
  work_location?: string;
  location?: string;
  employment_type?: string;
  status?: string;
  branch?: string;
  grade?: string;
};

type OrganizationalAccessScopeFieldsProps = {
  accessScope: string;
  onAccessScopeChange: (value: string) => void;
  scopeIds: number[];
  onScopeIdsChange: (value: number[]) => void;
  scopeSearch: string;
  onScopeSearchChange: (value: string) => void;
  departments: ScopeTarget[];
  grades: ScopeTarget[];
  employees: ScopeTarget[];
  hideAdminOnly?: boolean;
  allowedScopes?: string[];
};

export function scopeIdsForFolder(folder: {
  access_scope?: string;
  department_ids?: number[];
  grade_ids?: number[];
  employee_ids?: number[];
}) {
  if (folder.access_scope === "department") return folder.department_ids ?? [];
  if (folder.access_scope === "grade") return folder.grade_ids ?? [];
  if (folder.access_scope === "individual") return folder.employee_ids ?? [];
  return [];
}

export function validateOrganizationalScope(
  accessScope: string,
  scopeIds: number[],
) {
  if (
    (accessScope === "department" ||
      accessScope === "grade" ||
      accessScope === "individual") &&
    !scopeIds.length
  ) {
    const label =
      accessScope === "department"
        ? "department"
        : accessScope === "grade"
          ? "grade"
          : "employee";
    return `Select at least one ${label}.`;
  }
  return null;
}

export default function OrganizationalAccessScopeFields({
  accessScope,
  onAccessScopeChange,
  scopeIds,
  onScopeIdsChange,
  scopeSearch,
  onScopeSearchChange,
  departments,
  grades,
  employees,
  hideAdminOnly = false,
  allowedScopes,
}: OrganizationalAccessScopeFieldsProps) {
  const scopeOptions = [
    { value: "all_staff", label: "All staff" },
    { value: "department", label: "Specific departments" },
    { value: "grade", label: "Specific grades" },
    { value: "individual", label: "Specific employees" },
    { value: "private", label: "Private" },
    { value: "company_owned", label: "Company owned" },
    ...(hideAdminOnly ? [] : [{ value: "admin_only", label: "Admin only" }]),
  ].filter((option) => !allowedScopes || allowedScopes.includes(option.value));

  const scopeSource =
    accessScope === "department"
      ? departments
      : accessScope === "grade"
        ? grades
        : accessScope === "individual"
          ? employees
          : [];

  const scopeLabel =
    accessScope === "department"
      ? "departments"
      : accessScope === "grade"
        ? "grades"
        : "employees";

  const toggleScopeId = (id: number) => {
    onScopeIdsChange(
      scopeIds.includes(id)
        ? scopeIds.filter((value) => value !== id)
        : [...scopeIds, id],
    );
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">Access scope</span>
        <ThemedSelect
          value={accessScope}
          onChange={(value) => {
            onAccessScopeChange(value);
            onScopeIdsChange([]);
            onScopeSearchChange("");
          }}
          options={scopeOptions}
        />
      </label>

      {(accessScope === "department" ||
        accessScope === "grade" ||
        accessScope === "individual") && (
        <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
          <span className="label">Select {scopeLabel}</span>
          {accessScope === "individual" ? (
            <EmployeeMetricPicker
              employees={employees.map((item) => ({
                id: item.id,
                name: item.name,
                department_name: item.department_name || item.department,
                job_title: item.job_title,
                work_location: item.work_location || item.location,
                employment_type: item.employment_type,
                status: item.status,
                branch: item.branch,
                grade: item.grade,
              }))}
              selectedIds={scopeIds}
              onChange={(ids) => onScopeIdsChange(ids)}
            />
          ) : (
            <>
              <input
                value={scopeSearch}
                onChange={(event) => onScopeSearchChange(event.target.value)}
                placeholder={`Search ${scopeLabel}...`}
                className="field mt-2"
              />
              <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {scopeSource
                  .filter((item) =>
                    item.name.toLowerCase().includes(scopeSearch.toLowerCase()),
                  )
                  .map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={scopeIds.includes(item.id)}
                        onChange={() => toggleScopeId(item.id)}
                        className="h-4 w-4 accent-pink-600"
                      />
                      {item.name}
                    </label>
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
