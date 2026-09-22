import type {
  ComplianceTargetEmployee,
  EmployeeFileHeaderField,
  EmployeeFileSummary,
  EmployeeFilesHeaderFieldOption,
} from "./types";

/** Mirrors backend HEADER_FIELD_CATALOG (EF-F1); used when API omits available_header_fields. */
export const EMPLOYEE_FILE_HEADER_FIELD_CATALOG: EmployeeFilesHeaderFieldOption[] = [
  { key: "employee_id", label: "Employee ID", ems_managed: true },
  { key: "name", label: "Full name", ems_managed: true },
  { key: "department_id", label: "Department", ems_managed: true },
  { key: "job_id", label: "Position", ems_managed: true },
  { key: "work_location", label: "Location", ems_managed: true },
  { key: "branch", label: "Branch", ems_managed: true },
  { key: "grade", label: "Grade / level", ems_managed: true },
  { key: "employment_type", label: "Employment type", ems_managed: true },
  { key: "status", label: "Status", ems_managed: true },
  { key: "work_email", label: "Work email", ems_managed: true },
  { key: "work_phone", label: "Work phone", ems_managed: true },
];

export const DEFAULT_EMPLOYEE_FILE_HEADER_FIELD_KEYS = [
  "employee_id",
  "name",
  "department_id",
  "job_id",
];

export function resolveHeaderFieldCatalog(
  fromApi?: EmployeeFilesHeaderFieldOption[] | null,
): EmployeeFilesHeaderFieldOption[] {
  if (fromApi?.length) return fromApi;
  return EMPLOYEE_FILE_HEADER_FIELD_CATALOG;
}

/** Normalize config/header keys from API (array or legacy JSON string). */
export function normalizeHeaderFieldKeys(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (key): key is string => typeof key === "string" && Boolean(key.trim()),
    );
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (key): key is string => typeof key === "string" && Boolean(key.trim()),
        );
      }
    } catch {
      return DEFAULT_EMPLOYEE_FILE_HEADER_FIELD_KEYS;
    }
  }
  return DEFAULT_EMPLOYEE_FILE_HEADER_FIELD_KEYS;
}

export const EMS_HEADER_READ_ONLY_NOTE =
  "Organizational fields are read-only here. Update the employee record in EMS to change them.";

function headerValueForKey(
  key: string,
  employeeId: number,
  employee?: ComplianceTargetEmployee | null,
  summary?: EmployeeFileSummary | null,
): string {
  const id = employee?.id ?? summary?.employee_id ?? employeeId;
  switch (key) {
    case "employee_id":
      return id ? `EMP-${id}` : "—";
    case "name":
      return employee?.name ?? summary?.employee_name ?? "—";
    case "department_id":
      return (
        employee?.department ??
        summary?.department_name ??
        "—"
      );
    case "job_id":
      return employee?.job_title ?? summary?.job_title ?? "—";
    case "work_location":
      return employee?.location ?? employee?.work_location ?? "—";
    case "grade":
      return employee?.grade ?? "—";
    case "branch":
    case "employment_type":
      return "—";
    case "status":
      if (summary?.state === "inactive") return "Inactive";
      if (employee?.lifecycle_status) {
        return employee.lifecycle_status.replace(/_/g, " ");
      }
      return "Active";
    case "work_email":
      return employee?.work_email ?? "—";
    case "work_phone":
      return employee?.work_phone ?? "—";
    default:
      return "—";
  }
}

/** When `/employee-file` omits `header_fields`, build from saved config + EMS data. */
export function buildProfileHeaderFields(
  keys: string[],
  employeeId: number,
  employee?: ComplianceTargetEmployee | null,
  summary?: EmployeeFileSummary | null,
  catalog?: EmployeeFilesHeaderFieldOption[],
): EmployeeFileHeaderField[] {
  const fieldCatalog = resolveHeaderFieldCatalog(catalog);
  const metaByKey = new Map(fieldCatalog.map((item) => [item.key, item]));
  return keys
    .map((key) => {
      const meta = metaByKey.get(key);
      if (!meta) return null;
      return {
        key,
        label: meta.label,
        value: headerValueForKey(key, employeeId, employee, summary) || "—",
        ems_managed: meta.ems_managed,
      };
    })
    .filter(Boolean) as EmployeeFileHeaderField[];
}
