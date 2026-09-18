export type EmployeeFilesLayoutMode = "list" | "card";

export type EmployeeFilesBrowseFilters = {
  category: string;
  documentTypeId: string;
  departmentId: string;
  source: string;
  status: string;
};

export const DEFAULT_EMPLOYEE_FILES_BROWSE_FILTERS: EmployeeFilesBrowseFilters = {
  category: "all",
  documentTypeId: "all",
  departmentId: "all",
  source: "all",
  status: "all",
};

export type EmployeeFilesDocumentColumnId =
  | "name"
  | "employee"
  | "category"
  | "documentType"
  | "source"
  | "status"
  | "uploadDate"
  | "expiry";

export const EMPLOYEE_FILES_DOCUMENT_COLUMNS: {
  id: EmployeeFilesDocumentColumnId;
  label: string;
  defaultVisible: boolean;
}[] = [
  { id: "name", label: "Document", defaultVisible: true },
  { id: "employee", label: "Employee", defaultVisible: true },
  { id: "category", label: "Category", defaultVisible: true },
  { id: "documentType", label: "Document type", defaultVisible: true },
  { id: "source", label: "Source", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
  { id: "uploadDate", label: "Upload date", defaultVisible: true },
  { id: "expiry", label: "Expiry", defaultVisible: false },
];

export type EmployeeFilesEmployeeColumnId =
  | "name"
  | "employeeId"
  | "department"
  | "jobTitle"
  | "documents"
  | "attention";

export const EMPLOYEE_FILES_EMPLOYEE_COLUMNS: {
  id: EmployeeFilesEmployeeColumnId;
  label: string;
  defaultVisible: boolean;
}[] = [
  { id: "name", label: "Employee", defaultVisible: true },
  { id: "employeeId", label: "Employee ID", defaultVisible: true },
  { id: "department", label: "Department", defaultVisible: true },
  { id: "jobTitle", label: "Job title", defaultVisible: false },
  { id: "documents", label: "Documents", defaultVisible: true },
  { id: "attention", label: "Needs attention", defaultVisible: true },
];

const STORAGE_KEY = "cleon-employee-files-browse-prefs";

export type EmployeeFilesBrowsePreferences = {
  layoutMode: EmployeeFilesLayoutMode;
  documentColumns: EmployeeFilesDocumentColumnId[];
  employeeColumns: EmployeeFilesEmployeeColumnId[];
  documentSort: string;
  employeeSort: string;
};

function defaultDocumentColumns(): EmployeeFilesDocumentColumnId[] {
  return EMPLOYEE_FILES_DOCUMENT_COLUMNS.filter((c) => c.defaultVisible).map(
    (c) => c.id,
  );
}

function defaultEmployeeColumns(): EmployeeFilesEmployeeColumnId[] {
  return EMPLOYEE_FILES_EMPLOYEE_COLUMNS.filter((c) => c.defaultVisible).map(
    (c) => c.id,
  );
}

export function loadEmployeeFilesBrowsePreferences(): EmployeeFilesBrowsePreferences {
  if (typeof window === "undefined") {
    return {
      layoutMode: "list",
      documentColumns: defaultDocumentColumns(),
      employeeColumns: defaultEmployeeColumns(),
      documentSort: "upload_date desc",
      employeeSort: "name asc",
    };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        layoutMode: "list",
        documentColumns: defaultDocumentColumns(),
        employeeColumns: defaultEmployeeColumns(),
        documentSort: "upload_date desc",
        employeeSort: "name asc",
      };
    }
    const parsed = JSON.parse(raw) as Partial<EmployeeFilesBrowsePreferences>;
    return {
      layoutMode: parsed.layoutMode === "card" ? "card" : "list",
      documentColumns: parsed.documentColumns?.length
        ? parsed.documentColumns
        : defaultDocumentColumns(),
      employeeColumns: parsed.employeeColumns?.length
        ? parsed.employeeColumns
        : defaultEmployeeColumns(),
      documentSort: parsed.documentSort || "upload_date desc",
      employeeSort: parsed.employeeSort || "name asc",
    };
  } catch {
    return {
      layoutMode: "list",
      documentColumns: defaultDocumentColumns(),
      employeeColumns: defaultEmployeeColumns(),
      documentSort: "upload_date desc",
      employeeSort: "name asc",
    };
  }
}

export function saveEmployeeFilesBrowsePreferences(
  prefs: EmployeeFilesBrowsePreferences,
) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
