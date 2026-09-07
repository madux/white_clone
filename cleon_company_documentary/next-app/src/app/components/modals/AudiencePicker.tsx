"use client";

import { Check, Search } from "lucide-react";
import { useState } from "react";
import type { AudienceOptions } from "../../../../lib/types";
import { useDocumentaryAudience } from "../../../../hooks/useDocumentary";

export type AudienceScope = "company" | "department" | "grade" | "employee";

export function AudiencePicker({
  scope,
  setScope,
  departmentIds,
  setDepartmentIds,
  gradeIds,
  setGradeIds,
  employeeIds,
  setEmployeeIds,
}: {
  scope: AudienceScope;
  setScope: (value: AudienceScope) => void;
  departmentIds: number[];
  setDepartmentIds: (value: number[]) => void;
  gradeIds: number[];
  setGradeIds: (value: number[]) => void;
  employeeIds: number[];
  setEmployeeIds: (value: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const audienceQuery = useDocumentaryAudience(search, true);
  const data: AudienceOptions = audienceQuery.data || {
    departments: [],
    grades: [],
    employees: [],
  };
  const choices =
    scope === "department"
      ? data.departments
      : scope === "grade"
        ? data.grades
        : data.employees;
  const selected =
    scope === "department"
      ? departmentIds
      : scope === "grade"
        ? gradeIds
        : employeeIds;
  const setSelected =
    scope === "department"
      ? setDepartmentIds
      : scope === "grade"
        ? setGradeIds
        : setEmployeeIds;

  function toggle(id: number) {
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="audience-picker">
      <div className="audience-label">
        <span>Who can access this folder?</span>
        <small>Access is enforced on every request.</small>
      </div>
      <div className="scope-grid">
        {(
          [
            ["company", "Everyone in the company"],
            ["department", "Specific departments"],
            ["grade", "Specific grades"],
            ["employee", "Specific employees"],
          ] as [AudienceScope, string][]
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={scope === value ? "scope-option active" : "scope-option"}
            onClick={() => setScope(value)}
          >
            <span>
              {scope === value ? (
                <Check size={13} />
              ) : (
                <span className="scope-dot" />
              )}
            </span>
            {label}
          </button>
        ))}
      </div>
      {scope !== "company" && (
        <>
          <label className="search-field compact-search">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${scope}s`}
            />
          </label>
          <div className="audience-results">
            {choices.map((choice) => {
              const id = choice.id;
              const label = "name" in choice ? choice.name : "";
              const employee =
                "email" in choice
                  ? (choice as AudienceOptions["employees"][number])
                  : null;
              const detail = employee
                ? employee.email || employee.department
                : "";
              return (
                <button
                  type="button"
                  key={id}
                  className={
                    selected.includes(id)
                      ? "audience-result selected"
                      : "audience-result"
                  }
                  onClick={() => toggle(id)}
                >
                  <span>
                    {selected.includes(id) ? (
                      <Check size={14} />
                    ) : (
                      <span className="scope-dot" />
                    )}
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                </button>
              );
            })}
            {!choices.length && (
              <span className="form-hint">
                No matching people or groups found.
              </span>
            )}
          </div>
          {!!selected.length && (
            <div className="selected-count">
              {selected.length} {scope}
              {selected.length === 1 ? "" : "s"} selected
            </div>
          )}
        </>
      )}
    </div>
  );
}
