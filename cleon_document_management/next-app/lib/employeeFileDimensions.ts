export const EMPLOYEE_FILE_DIMENSION_LABELS: Record<string, string> = {
  department: "Department",
  branch: "Branch",
  grade: "Grade / Level",
  employment_type: "Employment Type",
  work_location: "Location",
  status: "Status",
};

export function employeeFileDimensionLabel(key: string) {
  return EMPLOYEE_FILE_DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
}

export function orderOrganizingDimensions(
  included: string[],
  primary: string,
  secondary?: string,
) {
  const unique = included.filter(
    (key, index) => key && included.indexOf(key) === index,
  );
  const secondaryKey =
    secondary && secondary !== "none" && secondary !== primary ? secondary : "";
  const rest = unique.filter((key) => key !== primary && key !== secondaryKey);
  const ordered = [
    ...(primary && unique.includes(primary) ? [primary] : []),
    ...(secondaryKey && unique.includes(secondaryKey) ? [secondaryKey] : []),
    ...rest,
  ];
  return ordered.length ? ordered : unique;
}

export function organizingDimensionRole(
  dimension: string,
  primary?: string,
  secondary?: string,
) {
  if (dimension === primary) return "Primary";
  if (secondary && secondary !== "none" && dimension === secondary) {
    return "Sub-group";
  }
  return "Independent";
}

export const ALLOWED_FILE_TYPE_CATALOG = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "csv",
  "txt",
  "zip",
] as const;

export function parseAllowedFileTypes(value: string | undefined | null) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.replace(/^\./, "").trim().toLowerCase())
    .filter(Boolean);
}

export function serializeAllowedFileTypes(values: string[]) {
  return values
    .map((item) => item.replace(/^\./, "").trim().toLowerCase())
    .filter(Boolean)
    .join(",");
}
