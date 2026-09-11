export const CREATE_FOLDER_INTENT_KEY = "cleon_dm_create_folder_intent";

export type CreateFolderPrefill = {
  departmentId?: number;
  employeeId?: number;
  folderName?: string;
};

export function storeCreateFolderIntent(prefill: CreateFolderPrefill) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CREATE_FOLDER_INTENT_KEY, JSON.stringify(prefill));
}

export function readCreateFolderIntent(): CreateFolderPrefill | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CREATE_FOLDER_INTENT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(CREATE_FOLDER_INTENT_KEY);
  try {
    return JSON.parse(raw) as CreateFolderPrefill;
  } catch {
    return null;
  }
}

export function prefillFromSearchParams(
  params: URLSearchParams,
): CreateFolderPrefill {
  return {
    departmentId: Number(params.get("department_id") || 0) || undefined,
    employeeId: Number(params.get("employee_id") || 0) || undefined,
    folderName: params.get("folder_name") || "",
  };
}

export function buildCreateFolderHref(item: {
  employee_id: number;
  department_id?: number;
  department?: string;
}) {
  const params = new URLSearchParams({
    create: "1",
    employee_id: String(item.employee_id),
  });
  if (item.department_id) {
    params.set("department_id", String(item.department_id));
  }
  if (item.department) {
    params.set("folder_name", item.department);
  }
  return `/pages/employee/?${params.toString()}`;
}
