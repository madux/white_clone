"use client";

import ThemedSelect from "./ThemedSelect";

type ScopeTarget = { id: number; name: string };

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
}: OrganizationalAccessScopeFieldsProps) {
  const scopeOptions = [
    { value: "all_staff", label: "All staff" },
    { value: "department", label: "Specific departments" },
    { value: "grade", label: "Specific grades" },
    { value: "individual", label: "Specific employees" },
    { value: "admin_only", label: "Admin only" },
  ];

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
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
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
        </div>
      )}
    </div>
  );
}
