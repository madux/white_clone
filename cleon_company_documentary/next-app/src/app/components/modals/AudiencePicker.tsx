"use client";

import { Check, Search } from "lucide-react";
import { useState } from "react";
import type { AudienceOptions } from "../../../../lib/types";
import { useDocumentaryAudience } from "../../../../hooks/useDocumentary";

export type AudienceScope = "company" | "department";

export function AudiencePicker({
  scope,
  setScope,
  departmentIds,
  setDepartmentIds,
}: {
  scope: AudienceScope;
  setScope: (value: AudienceScope) => void;
  departmentIds: number[];
  setDepartmentIds: (value: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const audienceQuery = useDocumentaryAudience(search, true);
  const data: AudienceOptions = audienceQuery.data || {
    departments: [],
    grades: [],
    employees: [],
  };
  const choices = data.departments;

  function toggle(id: number) {
    setDepartmentIds(departmentIds.includes(id) ? [] : [id]);
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
            ["company", "All employees"],
            ["department", "One department"],
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
                    departmentIds.includes(id)
                      ? "audience-result selected"
                      : "audience-result"
                  }
                  onClick={() => toggle(id)}
                >
                  <span>
                    {departmentIds.includes(id) ? (
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
          {!!departmentIds.length && (
            <div className="selected-count">
              {departmentIds.length} department
              {departmentIds.length === 1 ? "" : "s"} selected
            </div>
          )}
        </>
      )}
    </div>
  );
}
