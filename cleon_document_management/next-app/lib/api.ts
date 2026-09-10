// cleon_document_management/next-app/lib/api.ts
import axios from "axios";
import type {
  DocFolder,
  DocDocument,
  MyWorkspace,
  CompliancePolicy,
  ComplianceTargets,
  User,
  AdminAttention,
  ApprovalInbox,
  PendingEmployeeUploads,
  MyPendingUploads,
  MyCompliance,
  OnboardingState,
  QuickAccess,
  DashboardStats,
  WorkspaceActivity,
  DocumentType,
  ShareLink,
  UploadDuplicateMatch,
} from "./types";

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { message: string; data?: any };
}

declare global {
  interface Window {
    __ODOO_USER__?: {
      user_id: number;
      user_name: string;
      user_email?: string;
      company_id?: number;
      company_name?: string;
      tz?: string;
      is_admin?: boolean;
      is_document_manager?: boolean;
    };
  }
}

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ODOO_URL || "",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Keep multipart requests on a client without a JSON default header. Axios must
// be allowed to set the browser-generated multipart boundary, otherwise the
// FormData object can be serialized as `{}` and Odoo receives no file.
const multipartClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ODOO_URL || "",
  withCredentials: true,
});

export async function rpc<T = any>(
  path: string,
  params: Record<string, any> = {},
): Promise<T> {
  try {
    const { data } = await client.post<JsonRpcResponse<T>>(path, {
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params,
    });

    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message);
    }

    return data.result as T;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const serverMessage =
        err.response?.data?.error?.data?.message ||
        err.response?.data?.error?.message;
      throw new Error(serverMessage || err.message);
    }
    throw err;
  }
}

export const api = {
  injectedUser: (): User | null => {
    const rawUser =
      typeof window !== "undefined" ? window.__ODOO_USER__ : undefined;

    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      console.log("[document-management] Odoo user global:", rawUser);
    }

    if (rawUser) {
      const mappedUser = {
        id: rawUser.user_id,
        name: rawUser.user_name || "",
        email: rawUser.user_email || "",
        company_id: rawUser.company_id || 0,
        company_name: rawUser.company_name || "",
        tz: rawUser.tz || "",
        is_admin: rawUser.is_admin,
        is_document_manager: rawUser.is_document_manager,
      };
      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV !== "production"
      ) {
        console.log("[document-management] Mapped user:", mappedUser);
      }
      return mappedUser;
    }
    return null;
  },

  me: async (): Promise<User | null> => {
    const injected = api.injectedUser();
    if (injected) return injected;

    const res = await rpc<{ success: boolean; data: User; message?: string }>(
      "/api/me",
    );
    if (!res?.success || !res?.data) {
      console.warn("Session check failed or empty:", res?.message);
      return null;
    }
    return res.data;
  },
  dashboardStats: () =>
    rpc<{ success: boolean; data: DashboardStats }>(
      "/api/dashboard-stats",
    ).then((result) => result.data),

  getFolders: () =>
    rpc<{
      success: boolean;
      count: number;
      data: { data: DocFolder[]; total_count: number };
    }>("/api/get-folder", {}).then((r) => r.data.data),

  getQuickAccess: () =>
    rpc<{ success: boolean; data: QuickAccess }>("/api/quick-access", {}),

  getFolder: (id: number) =>
    rpc<{ success: boolean; data: DocFolder }>(
      `/api/view-folder/${id}`,
      {},
    ).then((r) => r.data),

  createFolder: (payload: Record<string, any>) =>
    rpc<{ success: boolean; message: string; data: DocFolder }>(
      "/api/create-folder",
      payload,
    ),

  addEmployeesToFolder: (payload: { id: number; employee_ids: number[] }) =>
    rpc<{ success: boolean; employee_ids: number[] }>(
      "/api/folder/add-employees",
      payload,
    ),

  checkEmployeeConflicts: (payload: { folderId: number; employeeIds: number[] }) =>
    rpc<{
      success: boolean;
      message?: string;
      already_in_folder: { employee_id: number; employee_name: string }[];
      conflicts: {
        employee_id: number;
        employee_name: string;
        folder_id: number;
        folder_name: string;
      }[];
    }>("/api/folder/check-employee-conflicts", {
      folder_id: payload.folderId,
      employee_ids: payload.employeeIds,
    }),

  removeEmployeesFromFolder: (payload: { id: number; employee_ids: number[] }) =>
    rpc<{ success: boolean; employee_ids: number[] }>(
      "/api/folder/remove-employees",
      payload,
    ),

  moveEmployeesBetweenFolders: (payload: { id: number; employee_ids: number[]; destination_folder_id: number }) =>
    rpc<{ success: boolean; employee_ids: number[]; message?: string }>(
      "/api/folder/move-employees",
      payload,
    ),

  updateFolder: (payload: {
    id: number;
    name: string;
    description?: string;
    require_upload_approval?: boolean;
    approval_flow?: string;
    approver_ids?: number[];
    access_scope?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
  }) =>
    rpc<{ success: boolean; message: string }>("/api/update-folder", {
      id: payload.id,
      folder_name: payload.name,
      description: payload.description,
      require_upload_approval: payload.require_upload_approval,
      approval_flow: payload.approval_flow,
      approver_ids: payload.approver_ids,
      access_scope: payload.access_scope,
      department_ids: payload.department_ids,
      grade_ids: payload.grade_ids,
      employee_ids: payload.employee_ids,
    }),

  deleteFolder: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/delete-folder", { id }),

  archiveFolder: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/archive-folder", { id }),

  folderAction: (payload: {
    id: number;
    action: string;
    permission?: string;
    expiry_option?: string;
    allow_download?: boolean;
    allow_printing?: boolean;
  }) =>
    rpc<{ success: boolean; data: { token?: string; url?: string }; message?: string }>(
      "/api/folder-action",
      payload,
    ),

  moveRecycledFolderDocuments: (payload: {
    folder_id: number;
    destination_folder_id?: number;
    release_only?: boolean;
  }) =>
    rpc<{ success: boolean; message: string; data?: { moved_count: number; linked_document_count: number } }>(
      "/api/folder/move-recycle-documents",
      payload,
    ),

  getDocuments: (folderId?: number | null, includeInactive = false) =>
    rpc<{
      success: boolean;
      count: number;
      data: { data: DocDocument[]; total_count: number };
    }>("/api/get-document", {
      folder_id: folderId || false,
      include_inactive: includeInactive,
    }).then((r) => r.data.data),

  getMyDocuments: () =>
    rpc<{ success: boolean; data: DocDocument[] }>("/api/my-documents", {}),

  getMyWorkspace: () => {
    return rpc<{ success: boolean; data: MyWorkspace }>(
      "/api/my-workspace",
      {},
    );
  },

  getMyPendingUploads: () =>
    rpc<{ success: boolean; data: MyPendingUploads }>(
      "/api/my-pending-uploads",
      {},
    ),

  getMyCompliance: () =>
    rpc<{ success: boolean; data: MyCompliance }>("/api/my-compliance", {}),

  getDocument: (id: number) =>
    rpc<{ success: boolean; data: DocDocument }>(
      `/api/view-document/${id}`,
      {},
    ).then((r) => r.data),

  createDocument: (payload: Record<string, any>) =>
    rpc<{ success: boolean; message: string; data: DocDocument }>(
      "/api/create-document",
      payload,
    ),

  uploadDocument: (payload: {
    files: File[];
    folder_id: number;
    document_type_ids: number[];
    expiry_dates?: string[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("folder_id", String(payload.folder_id));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    return multipartClient
      .post<{
        success: boolean;
        data: DocDocument;
      }>("/api/upload-document", form)
      .then((response) => response.data);
  },

  uploadMyDocument: (payload: {
    files: File[];
    document_type_ids: number[];
    expiry_dates?: string[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    return multipartClient
      .post<{
        success: boolean;
        data: DocDocument;
        message?: string;
      }>("/api/my-documents/upload", form)
      .then((response) => response.data);
  },

  uploadEmployeeDocument: (payload: {
    files: File[];
    employee_id: number;
    document_type_ids: number[];
    expiry_dates?: string[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("employee_id", String(payload.employee_id));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    return multipartClient
      .post<{ success: boolean; data?: { id: number; name: string }; message?: string }>(
        "/api/employee-documents/upload",
        form,
      )
      .then((response) => response.data);
  },

  checkUploadDuplicates: (payload: {
    employee_id: number;
    items: { filename: string; document_type_id: number }[];
  }) =>
    rpc<{
      success: boolean;
      matches?: UploadDuplicateMatch[];
      message?: string;
    }>("/api/check-upload-duplicates", payload),

  requestDocumentApproval: (id: number) => {
    return rpc<{
      success: boolean;
      data: { id: number; state: string; approval_state: string };
      message?: string;
    }>("/api/my-documents/request-approval", { id });
  },

  updateDocument: (payload: { id: number; [key: string]: any }) =>
    rpc<{ success: boolean; message: string }>("/api/update-document", payload),

  moveDocuments: (payload: {
    document_ids: number[];
    destination_folder_id: number;
  }) =>
    rpc<{
      success: boolean;
      message: string;
      data?: { document_ids: number[]; folder_id: number };
    }>("/api/move-documents", payload),

  deleteDocument: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/delete-document", { id }),

  documentAction: (payload: {
    id: number;
    action:
      | "favorite"
      | "pin"
      | "delete"
      | "archive"
      | "restore"
      | "activate"
      | "deactivate"
      | "permanent_delete";
  }) =>
    rpc<{ success: boolean; data: { id: number; action: string } }>(
      "/api/document-action",
      payload,
    ),

  acknowledgeDocument: (id: number) =>
    rpc<{ success: boolean; data: { acknowledged: boolean; acknowledged_at?: string }; message?: string }>(
      "/api/document/acknowledge",
      { id },
    ),

  getAdminAttention: () =>
    rpc<{ success: boolean; data: AdminAttention }>(
      "/api/admin-attention",
      {},
    ),

  getApprovalInbox: () =>
    rpc<{ success: boolean; data: ApprovalInbox }>(
      "/api/admin-approval-inbox",
      {},
    ),

  getPendingEmployeeUploads: () =>
    rpc<{ success: boolean; data: PendingEmployeeUploads }>(
      "/api/admin/pending-employee-uploads",
      {},
    ),

  getWorkspaceActivity: () =>
    rpc<{ success: boolean; data: WorkspaceActivity }>(
      "/api/workspace-activity",
      {},
    ),

  getOnboarding: () =>
    rpc<{ success: boolean; data: OnboardingState }>("/api/onboarding", {}),

  updateOnboarding: (payload: {
    action: "complete_step" | "complete" | "dismiss" | "reset";
    step_id?: string;
  }) =>
    rpc<{ success: boolean; data: OnboardingState; message?: string }>(
      "/api/onboarding/update",
      payload,
    ),

  reviewDocument: (payload: {
    id: number;
    action: "approve" | "reject";
    reason?: string;
  }) =>
    rpc<{ success: boolean; data: any }>("/api/document-review", payload),

  getDocumentLifecycle: (lifecycle: "archived" | "recycle_bin") =>
    rpc<{ success: boolean; data: DocDocument[] }>(
      "/api/document-lifecycle",
      { lifecycle },
    ),

  getFolderLifecycle: (lifecycle: "archived" | "recycle_bin") =>
    rpc<{ success: boolean; data: any[] }>("/api/folder-lifecycle", { lifecycle }),

  getSettings: () =>
    rpc<{ success: boolean; data: { settings: any; document_types: any[]; approvers: any[] } }>(
      "/api/settings",
      {},
    ),

  saveSettings: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data?: any; message?: string }>(
      "/api/settings/save",
      payload,
    ),

  saveSettingsDocumentType: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data?: any; message?: string }>(
      "/api/settings/document-type",
      payload,
    ),

  toggleSettingsDocumentType: (id: number) =>
    rpc<{ success: boolean; active?: boolean; message?: string }>(
      "/api/settings/document-type/toggle",
      { id },
    ),

  getPolicyTypes: () =>
    rpc<{ success: boolean; data: any[] }>(
      "/api/compliance/policy-types",
      {},
    ).then((r) => r.data),

  getComplianceTargets: () =>
    rpc<{ success: boolean; data: ComplianceTargets }>(
      "/api/compliance/targets",
      {},
    ).then((r) => r.data),

  getExceptions: () =>
    rpc<{ success: boolean; data: any[] }>(
      "/api/compliance/exceptions",
      {},
    ).then((r) => r.data),

  createException: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: any }>(
      "/api/compliance/exceptions/create",
      payload,
    ),

  deactivateException: (id: number) =>
    rpc<{ success: boolean; active: boolean }>(
      `/api/compliance/exceptions/${id}/deactivate`,
      {},
    ),

  reactivateException: (id: number) =>
    rpc<{ success: boolean; active: boolean }>(
      `/api/compliance/exceptions/${id}/reactivate`,
      {},
    ),

  deleteException: (id: number) =>
    rpc<{ success: boolean; message: string }>(
      `/api/compliance/exceptions/${id}/delete`,
      {},
    ),

  approveException: (id: number) =>
    rpc<{ success: boolean; status?: string; message?: string }>(
      `/api/compliance/exceptions/${id}/approve`,
      {},
    ),

  rejectException: (id: number) =>
    rpc<{ success: boolean; status?: string; message?: string }>(
      `/api/compliance/exceptions/${id}/reject`,
      {},
    ),

  getEvaluations: (employeeId?: number) =>
    rpc<{ success: boolean; data: any[] }>(
      "/api/compliance/evaluations",
      employeeId ? { employee_id: employeeId } : {},
    ).then((r) => r.data),

  getEvaluationRuns: (policyId?: number) =>
    rpc<{ success: boolean; data: any[] }>(
      "/api/compliance/runs",
      policyId ? { policy_id: policyId } : {},
    ).then((r) => r.data),

  evaluatePolicy: (policyId: number) =>
    rpc<{ success: boolean; data: any[]; run?: any; message?: string }>(
      `/api/compliance/policies/${policyId}/evaluate`,
      {},
    ),

  getPolicies: () =>
    rpc<{ success: boolean; count: number; data: CompliancePolicy[] }>(
      "/api/compliance/policies",
      { active_only: true },
    ).then((r) => r.data),

  createPolicy: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: CompliancePolicy }>(
      "/api/compliance/policies/create",
      payload,
    ),

  updatePolicy: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: CompliancePolicy }>(
      "/api/compliance/policies/update",
      payload,
    ),

  deletePolicy: (id: number) =>
    rpc<{ success: boolean; message: string }>(
      "/api/compliance/policies/delete",
      { id },
    ),

  getDocumentTypes: () =>
    rpc<{ success: boolean; data: DocumentType[] }>(
      "/api/get-document-type",
      {},
    ).then((r) => r.data),

  createDocumentType: (payload: {
    name: string;
    category: string;
    description?: string;
    is_mandatory_default?: boolean;
    expiry_applicable?: boolean;
    default_retention_years?: number;
  }) =>
    rpc<{ success: boolean; data: DocumentType; message?: string }>(
      "/api/create-document-type",
      payload,
    ),

  getDocumentVersions: (documentId: number) =>
    rpc<{ success: boolean; count: number; data: import("./types").DocumentVersion[] }>(
      "/api/document-versions",
      { document_id: documentId },
    ),

  getShareLinks: () =>
    rpc<{ success: boolean; data: ShareLink[] }>(
      "/api/share-links",
      {},
    ).then((r) => r.data),

  downloadFolder: (folderId: number) => {
    triggerDownload(`/document-management/folder/${folderId}/download`);
  },

  downloadDocument: (docId: number) => {
    triggerDownload(`/document-management/document/${docId}/download`);
  },

  downloadEmployee: (employeeId: number) => {
    triggerDownload(`/document-management/employee/${employeeId}/download`);
  },
};

function triggerDownload(url: string) {
  const link = document.createElement("a");
  const backendUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(
    /\/$/,
    "",
  );
  link.href = `${backendUrl}${url}`;
  link.download = "";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
