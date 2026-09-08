"use client";

import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Search,
  User,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type DepartmentOption = {
  id: number;
  name: string;
  employeeCount: number;
};

export type EmployeeOption = {
  id: number;
  name: string;
  department_id: number | false;
  department_name: string;
  job_title?: string;
};

type DepartmentAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  departments: DepartmentOption[];
  employees?: EmployeeOption[];
  selectedDepartmentId: number | null;
  selectedEmployeeId?: number | null;
  onSelectDepartment: (department: DepartmentOption) => void;
  onSelectEmployee?: (employee: EmployeeOption) => void;
  onClearSelection?: () => void;
  existingFolderByDepartmentId?: Map<number, string>;
  disabled?: boolean;
  error?: string;
  helperText?: string;
};

function rankText(text: string, query: string): number {
  const normalized = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 50;
  if (normalized === needle) return 100;
  if (normalized.startsWith(needle)) return 80;
  if (normalized.includes(needle)) return 60;
  return -1;
}

function rankEmployee(employee: EmployeeOption, query: string): number {
  const nameScore = rankText(employee.name, query);
  const departmentScore = rankText(employee.department_name, query);
  return Math.max(nameScore, departmentScore > 0 ? departmentScore - 10 : -1);
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const index = lowerText.indexOf(lowerNeedle);
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-pink-100/90 px-0.5 font-semibold text-brand-text not-italic">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

type FlatSuggestion =
  | { kind: "employee"; employee: EmployeeOption; index: number }
  | { kind: "department"; department: DepartmentOption; index: number };

export default function DepartmentAutocomplete({
  value,
  onChange,
  departments,
  employees = [],
  selectedDepartmentId,
  selectedEmployeeId = null,
  onSelectDepartment,
  onSelectEmployee,
  onClearSelection,
  existingFolderByDepartmentId,
  disabled = false,
  error,
  helperText = "Search by employee or department name. Selecting an employee fills in their department.",
}: DepartmentAutocompleteProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const departmentSuggestions = useMemo(() => {
    return departments
      .map((department) => ({
        department,
        score: rankText(department.name, value),
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.department.name.localeCompare(b.department.name);
      })
      .slice(0, 6)
      .map((item) => item.department);
  }, [departments, value]);

  const employeeSuggestions = useMemo(() => {
    return employees
      .map((employee) => ({
        employee,
        score: rankEmployee(employee, value),
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.employee.name.localeCompare(b.employee.name);
      })
      .slice(0, 6)
      .map((item) => item.employee);
  }, [employees, value]);

  const flatSuggestions = useMemo<FlatSuggestion[]>(() => {
    const items: FlatSuggestion[] = [];
    let index = 0;
    for (const employee of employeeSuggestions) {
      items.push({ kind: "employee", employee, index });
      index += 1;
    }
    for (const department of departmentSuggestions) {
      items.push({ kind: "department", department, index });
      index += 1;
    }
    return items;
  }, [departmentSuggestions, employeeSuggestions]);

  const selectedDepartment = useMemo(
    () => departments.find((item) => item.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId],
  );

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const showDropdown =
    open && !disabled && value.trim().length > 0 && flatSuggestions.length > 0;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    setActiveIndex(0);
  }, [value, showDropdown]);

  const resolveDepartment = (departmentId: number | false) =>
    departments.find((item) => item.id === departmentId) ?? null;

  const selectDepartment = (department: DepartmentOption) => {
    const existingFolder = existingFolderByDepartmentId?.get(department.id);
    if (existingFolder) return;
    onSelectDepartment(department);
    closeDropdown();
  };

  const selectEmployee = (employee: EmployeeOption) => {
    if (!employee.department_id) return;
    const department = resolveDepartment(employee.department_id);
    if (!department) return;
    const existingFolder = existingFolderByDepartmentId?.get(department.id);
    if (existingFolder) return;
    onSelectEmployee?.(employee);
    onSelectDepartment(department);
    closeDropdown();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showDropdown) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(flatSuggestions.length - 1, 0)),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && showDropdown && flatSuggestions[activeIndex]) {
      event.preventDefault();
      const item = flatSuggestions[activeIndex];
      if (item.kind === "employee") {
        selectEmployee(item.employee);
      } else {
        selectDepartment(item.department);
      }
      return;
    }
    if (event.key === "Escape") {
      closeDropdown();
    }
  };

  const showEmptyState =
    open && !disabled && value.trim().length > 0 && !flatSuggestions.length;

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id="department-folder-name"
          type="text"
          role="combobox"
          aria-expanded={showDropdown || showEmptyState}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          autoComplete="off"
          disabled={disabled}
          value={value}
          placeholder="Search employees or departments..."
          className={`field w-full pl-10 pr-10 transition-shadow ${
            selectedDepartment
              ? "border-pink-200 bg-pink-50/40 ring-2 ring-pink-100"
              : error
                ? "border-red-300 ring-2 ring-red-100"
                : "focus:ring-2 focus:ring-pink-100"
          }`}
          onChange={(event) => {
            onChange(event.target.value);
            if ((selectedDepartmentId || selectedEmployeeId) && onClearSelection) {
              onClearSelection();
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${
            showDropdown || showEmptyState ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </div>

      {selectedDepartment && (
        <div className="flex items-center gap-2 rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50/80 to-white px-3 py-2.5 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-pink shadow-sm">
            {selectedEmployee ? (
              <User className="h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-800">
              {selectedDepartment.name}
            </p>
            <p className="text-xs text-slate-500">
              {selectedEmployee
                ? `Selected via ${selectedEmployee.name} · `
                : ""}
              {selectedDepartment.employeeCount} employee
              {selectedDepartment.employeeCount === 1 ? "" : "s"} will be added
            </p>
          </div>
          <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
        </div>
      )}

      {(showDropdown || showEmptyState) && (
        <div
          className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.18)]"
          role="presentation"
        >
          {employeeSuggestions.length > 0 && (
            <>
              <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Matching employees
              </div>
              <ul role="listbox" className="max-h-48 overflow-y-auto p-1.5">
                {employeeSuggestions.map((employee) => {
                  const flatItem = flatSuggestions.find(
                    (item) =>
                      item.kind === "employee" && item.employee.id === employee.id,
                  );
                  const itemIndex = flatItem?.index ?? 0;
                  const department = resolveDepartment(employee.department_id);
                  const existingFolder = employee.department_id
                    ? existingFolderByDepartmentId?.get(employee.department_id)
                    : undefined;
                  const missingDepartment = !employee.department_id || !department;
                  const isDisabled = missingDepartment || Boolean(existingFolder);
                  const isActive = itemIndex === activeIndex;
                  const isSelected =
                    selectedEmployeeId === employee.id &&
                    selectedDepartmentId === employee.department_id;

                  return (
                    <li key={`employee-${employee.id}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={isDisabled}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => selectEmployee(employee)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          isDisabled
                            ? "cursor-not-allowed opacity-60"
                            : isActive
                              ? "bg-pink-50"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-gradient-to-br from-brand-text to-brand-pink text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <User className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            <HighlightMatch text={employee.name} query={value} />
                          </span>
                          {missingDepartment ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              No department assigned in HR
                            </span>
                          ) : existingFolder ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {employee.department_name} — folder exists:{" "}
                              {existingFolder}
                            </span>
                          ) : (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <Building2 className="h-3.5 w-3.5" />
                              Department:{" "}
                              <HighlightMatch
                                text={employee.department_name}
                                query={value}
                              />
                            </span>
                          )}
                        </span>
                        {isSelected && !isDisabled && (
                          <Check className="h-4 w-4 shrink-0 text-brand-pink" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {departmentSuggestions.length > 0 && (
            <>
              <div className="border-b border-t border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Matching departments
              </div>
              <ul
                id={listboxId}
                role="listbox"
                className="max-h-48 overflow-y-auto p-1.5"
              >
                {departmentSuggestions.map((department) => {
                  const flatItem = flatSuggestions.find(
                    (item) =>
                      item.kind === "department" &&
                      item.department.id === department.id,
                  );
                  const itemIndex = flatItem?.index ?? 0;
                  const existingFolder = existingFolderByDepartmentId?.get(
                    department.id,
                  );
                  const isActive = itemIndex === activeIndex;
                  const isSelected = department.id === selectedDepartmentId;

                  return (
                    <li key={`department-${department.id}`} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={Boolean(existingFolder)}
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => selectDepartment(department)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          existingFolder
                            ? "cursor-not-allowed opacity-60"
                            : isActive
                              ? "bg-pink-50"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-gradient-to-br from-brand-text to-brand-pink text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            <HighlightMatch text={department.name} query={value} />
                          </span>
                          {existingFolder ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Folder already exists: {existingFolder}
                            </span>
                          ) : (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <Users className="h-3.5 w-3.5" />
                              {department.employeeCount} employee
                              {department.employeeCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                        {isSelected && !existingFolder && (
                          <Check className="h-4 w-4 shrink-0 text-brand-pink" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {!employeeSuggestions.length && !departmentSuggestions.length && showEmptyState && (
            <div className="px-4 py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                No matching employees or departments
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try another name, or add the employee or department in HR first.
              </p>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
