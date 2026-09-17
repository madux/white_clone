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
