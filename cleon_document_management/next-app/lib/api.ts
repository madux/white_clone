// cleon_document_management/next-app/lib/api.ts
import axios from "axios";
import {
  assertOrgUploadSucceeded,
  type OrgUploadApiResult,
} from "./orgDocumentUpload";
import { getActiveWorkspaceGrantId } from "./workspaceGrantRpc";
import type {
  DocFolder,
  DocDocument,
  MyWorkspace,
  CompliancePolicy,
  ComplianceTargets,
  User,
  AdminAttention,
  ApprovalInbox,
  ReviewAlertItem,
  PendingEmployeeUploads,
  MyPendingUploads,
  MyCompliance,
  OnboardingState,
  QuickAccess,
  DashboardStats,
  WorkspaceActivity,
  DocumentAcknowledgementAudience,
  ModuleRoleAssignment,
  ModuleRoleDefinition,
  ModuleRoleMember,
  ModuleRoleMembersPayload,
  DocumentType,
  ShareLink,
  UploadConflict,
  WorkspaceGrant,
  WorkspaceModule,
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
      is_document_admin?: boolean;
      is_super_admin?: boolean;
      dms_permissions?: import("./types").DmsPermissionsMap;
      employee_files_permissions?: import("./types").EmployeeFilesPermissions;
      organizational_files_permissions?: import("./types").OrganizationalFilesPermissions;
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
export const multipartClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ODOO_URL || "",
  withCredentials: true,
});

multipartClient.interceptors.request.use((config) => {
  const grantId = getActiveWorkspaceGrantId();
  if (grantId) {
    config.params = { ...(config.params || {}), workspace_grant_id: grantId };
  }
  return config;
});

export async function rpc<T = any>(
  path: string,
  params: Record<string, any> = {},
  options: { timeout?: number; skipWorkspaceGrant?: boolean } = {},
): Promise<T> {
  try {
    const grantId = options.skipWorkspaceGrant
      ? null
      : getActiveWorkspaceGrantId();
    const rpcParams =
      grantId && !path.startsWith("/api/workspace-access")
        ? { ...params, workspace_grant_id: grantId }
        : params;
    const { data } = await client.post<JsonRpcResponse<T>>(
      path,
      {
        jsonrpc: "2.0",
        method: "call",
        id: Date.now(),
        params: rpcParams,
      },
      options.timeout ? { timeout: options.timeout } : undefined,
    );

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

function unwrapCompliance<T extends { success?: boolean; message?: string }>(
  result: T,
): T {
  if (result?.success === false) {
    throw new Error(result.message || "Compliance request failed.");
  }
  return result;
}

export const api = {
  injectedUser: (): User | null => {
    // The page HTML embeds the signed-in user; a remote session must load the owner from /api/me.
    if (getActiveWorkspaceGrantId()) return null;
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
        is_document_admin: rawUser.is_document_admin,
        is_super_admin: rawUser.is_super_admin,
        dms_permissions: rawUser.dms_permissions,
        employee_files_permissions: rawUser.employee_files_permissions,
        organizational_files_permissions: rawUser.organizational_files_permissions,
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
    name?: string;
    description?: string;
    require_upload_approval?: boolean;
    approval_flow?: string;
    approver_ids?: number[];
    access_scope?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    color_hex?: string;
    color?: number;
    organize_by?: string;
  }) =>
    rpc<{ success: boolean; message: string }>("/api/update-folder", {
      id: payload.id,
      ...(payload.name !== undefined ? { folder_name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.require_upload_approval !== undefined
        ? { require_upload_approval: payload.require_upload_approval }
        : {}),
      ...(payload.approval_flow !== undefined
        ? { approval_flow: payload.approval_flow }
        : {}),
      ...(payload.approver_ids !== undefined
        ? { approver_ids: payload.approver_ids }
        : {}),
      ...(payload.access_scope !== undefined
        ? { access_scope: payload.access_scope }
        : {}),
      ...(payload.department_ids !== undefined
        ? { department_ids: payload.department_ids }
        : {}),
      ...(payload.grade_ids !== undefined ? { grade_ids: payload.grade_ids } : {}),
      ...(payload.employee_ids !== undefined
        ? { employee_ids: payload.employee_ids }
        : {}),
      ...(payload.color_hex !== undefined ? { color_hex: payload.color_hex } : {}),
      ...(payload.color !== undefined ? { color: payload.color } : {}),
      ...(payload.organize_by !== undefined ? { organize_by: payload.organize_by } : {}),
    }).then((result) => {
      if (result?.success === false) {
        throw new Error(result.message || "Unable to update folder.");
      }
      return result;
    }),

  deleteFolder: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/delete-folder", { id }),

  deleteFolders: (folder_ids: number[]) =>
    rpc<{
      success: boolean;
      message: string;
      data?: { folder_ids: number[] };
    }>("/api/delete-folders", { folder_ids }),

  archiveFolder: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/archive-folder", { id }),

  folderAction: (payload: {
    id: number;
    action: string;
    permission?: string;
    expiry_option?: string;
    allow_download?: boolean;
    allow_printing?: boolean;
    include_documents?: boolean;
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

  getMyComplianceInboxItem: (payload: { kind: string; record_id: number }) =>
    rpc<{ success: boolean; data: import("./types").MyComplianceInboxItem }>(
      "/api/compliance/my-inbox/item",
      payload,
    ),

  submitComplianceDocument: (payload: {
    files: File[];
    document_type_ids: number[];
    policy_id?: number;
    evaluation_line_id?: number;
    replace_document_id?: number;
    expiry_dates?: string[];
    issue_dates?: string[];
    descriptions?: string[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.policy_id) {
      form.append("policy_id", String(payload.policy_id));
    }
    if (payload.evaluation_line_id) {
      form.append("evaluation_line_id", String(payload.evaluation_line_id));
    }
    if (payload.replace_document_id) {
      form.append("replace_document_id", String(payload.replace_document_id));
    }
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    if (payload.issue_dates?.length) {
      form.append("issue_dates", JSON.stringify(payload.issue_dates));
    }
    if (payload.descriptions?.length) {
      form.append("descriptions", JSON.stringify(payload.descriptions));
    }
    return multipartClient
      .post<{ success: boolean; message?: string; data?: { id: number; name: string } }>(
        "/api/compliance/submit-document",
        form,
      )
      .then((response) => {
        const body = response.data;
        if (!body?.success) {
          throw new Error(body?.message || "We could not save your document. Try again.");
        }
        return body;
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.data) {
          const data = err.response.data as { message?: string };
          if (data.message) throw new Error(data.message);
        }
        throw err;
      });
  },

  previewUploadMetadata: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return multipartClient
      .post<{
        success: boolean;
        data?: {
          issue_date?: string;
          expiry_date?: string;
          description?: string;
          detected_fields?: string[];
        };
      }>("/api/my-documents/upload-preview", form)
      .then((r) => r.data);
  },

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
    issue_dates?: string[];
    descriptions?: string[];
    replace_document_ids?: Array<number | null>;
    change_notes?: string[];
    is_template?: boolean;
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("folder_id", String(payload.folder_id));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    if (payload.issue_dates?.length) {
      form.append("issue_dates", JSON.stringify(payload.issue_dates));
    }
    if (payload.descriptions?.length) {
      form.append("descriptions", JSON.stringify(payload.descriptions));
    }
    if (payload.replace_document_ids?.length) {
      form.append("replace_document_ids", JSON.stringify(payload.replace_document_ids));
    }
    if (payload.change_notes?.length) {
      form.append("change_notes", JSON.stringify(payload.change_notes));
    }
    if (payload.is_template) {
      form.append("is_template", "1");
    }
    return multipartClient
      .post<OrgUploadApiResult & { data?: DocDocument; documents?: DocDocument[] }>(
        "/api/upload-document",
        form,
      )
      .then((response) => {
        const data = response.data;
        assertOrgUploadSucceeded(data);
        return data;
      })
      .catch((err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.data) {
          const body = err.response.data as { message?: string };
          if (body.message) {
            throw new Error(body.message);
          }
        }
        throw err;
      });
  },

  uploadMyDocument: (payload: {
    files: File[];
    document_type_ids: number[];
    expiry_dates?: string[];
    issue_dates?: string[];
    descriptions?: string[];
    replace_document_ids?: Array<number | null>;
    change_notes?: string[];
    allow_separate_duplicates?: boolean[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    if (payload.issue_dates?.length) {
      form.append("issue_dates", JSON.stringify(payload.issue_dates));
    }
    if (payload.descriptions?.length) {
      form.append("descriptions", JSON.stringify(payload.descriptions));
    }
    if (payload.replace_document_ids?.length) {
      form.append("replace_document_ids", JSON.stringify(payload.replace_document_ids));
    }
    if (payload.change_notes?.length) {
      form.append("change_notes", JSON.stringify(payload.change_notes));
    }
    if (payload.allow_separate_duplicates?.length) {
      form.append(
        "allow_separate_duplicates",
        JSON.stringify(payload.allow_separate_duplicates),
      );
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
    issue_dates?: string[];
    descriptions?: string[];
    replace_document_ids?: Array<number | null>;
    change_notes?: string[];
    allow_separate_duplicates?: boolean[];
  }) => {
    const form = new FormData();
    payload.files.forEach((file) => form.append("file", file, file.name));
    form.append("employee_id", String(payload.employee_id));
    form.append("document_type_ids", JSON.stringify(payload.document_type_ids));
    if (payload.expiry_dates?.length) {
      form.append("expiry_dates", JSON.stringify(payload.expiry_dates));
    }
    if (payload.issue_dates?.length) {
      form.append("issue_dates", JSON.stringify(payload.issue_dates));
    }
    if (payload.descriptions?.length) {
      form.append("descriptions", JSON.stringify(payload.descriptions));
    }
    if (payload.replace_document_ids?.length) {
      form.append("replace_document_ids", JSON.stringify(payload.replace_document_ids));
    }
    if (payload.change_notes?.length) {
      form.append("change_notes", JSON.stringify(payload.change_notes));
    }
    if (payload.allow_separate_duplicates?.length) {
      form.append(
        "allow_separate_duplicates",
        JSON.stringify(payload.allow_separate_duplicates),
      );
    }
    return multipartClient
      .post<{ success: boolean; data?: { id: number; name: string }; message?: string }>(
        "/api/employee-documents/upload",
        form,
      )
      .then((response) => response.data);
  },

  checkUploadConflicts: (payload: {
    employee_id: number;
    items: { document_type_id: number }[];
  }) =>
    rpc<{
      success: boolean;
      conflicts?: UploadConflict[];
      message?: string;
    }>("/api/check-upload-conflicts", payload),

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

  updateOrganizationalDocumentAccess: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; data: import("./types").DocDocument }>(
      "/api/organizational/document-access",
      payload,
    ),

  assignPolicyTemplate: (payload: {
    document_id: number;
    linked_policy_id?: number | false;
    linked_template_document_id?: number | false;
  }) =>
    rpc<{ success: boolean; data: import("./types").DocDocument }>(
      "/api/organizational/assign-policy-template",
      payload,
    ),

  copyOrganizationalDocument: (payload: { document_id: number; folder_id: number }) =>
    rpc<{ success: boolean; message?: string; data: import("./types").DocDocument }>(
      "/api/organizational/copy-document",
      payload,
    ),

  renameOrganizationalDocument: (payload: { document_id: number; name: string }) =>
    rpc<{ success: boolean; message?: string; data: import("./types").DocDocument }>(
      "/api/organizational/rename-document",
      payload,
    ),

  createOrganizationalShortcut: (payload: { document_id: number; folder_id: number }) =>
    rpc<{ success: boolean; message?: string; data: import("./types").DocDocument }>(
      "/api/organizational/create-shortcut",
      payload,
    ),

  moveOrganizationalFolder: (payload: { folder_id: number; parent_id?: number | false }) =>
    rpc<{ success: boolean; message?: string }>("/api/organizational/move-folder", payload),

  refreshOrganizationalLinkStatus: (documentId: number) =>
    rpc<{ success: boolean; data: { link_status: string; source_url: string } }>(
      "/api/organizational/link-status",
      { document_id: documentId },
    ),

  listOrganizationalPoliciesTemplates: () =>
    rpc<{
      success: boolean;
      data: {
        policies: { id: number; name: string; lifecycle_status: string; category: string }[];
        templates: { id: number; name: string; folder_id: number }[];
      };
    }>("/api/organizational/policies-templates", {}),

  suggestedOrganizationalFiles: (payload: { name: string; folder_id?: number }) =>
    rpc<{ success: boolean; data: { items: import("./types").DocDocument[] } }>(
      "/api/organizational/suggested-files",
      payload,
    ),

  suggestedPolicyFiles: (payload: {
    name?: string;
    folder_id?: number;
    policy_folder_id?: number;
    preview_suggestions?: boolean;
    /** List eligible org library files (not only name-matched suggestions). */
    browse_library?: boolean;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: import("./types").SuggestedPolicyFile[] };
    }>("/api/organizational/suggested-policy-files", payload),

  adoptPolicyFiles: (payload: { policy_id: number; document_ids: number[] }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: {
        policy: import("./types").OrganizationalPolicy;
        documents: import("./types").DocDocument[];
      };
    }>("/api/organizational/adopt-policy-files", payload, { timeout: 120000 }),

  createPolicyScratchDraft: (payload: {
    folder_id: number;
    name: string;
    document_type_id: number;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: {
        folder_id: number;
        hr_document_id: number;
        editor_document_id: number;
        document: import("./types").DocDocument;
      };
    }>("/api/organizational/create-policy-scratch-draft", payload),

  syncPolicyEditorAttachment: (payload: {
    hr_document_id: number;
    rendered_text?: string;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: { synced: boolean; document: import("./types").DocDocument };
    }>(`/api/organizational/policy-editor/${payload.hr_document_id}/sync-attachment`, {
      rendered_text: payload.rendered_text,
    }),

  listActiveTemplatesForms: (payload?: { q?: string; kind?: "template" | "form" }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: { templates: Array<Record<string, unknown>> };
    }>("/api/organizational/active-templates-forms", payload ?? {}),

  createPolicyFolder: (payload: {
    name: string;
    parent_folder_id?: number;
    document_ids: number[];
    category?: string;
    visibility?: string;
    effective_date?: string;
    description?: string;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      code?: string;
      data?: {
        folder: import("./types").DocFolder;
        policy: import("./types").OrganizationalPolicy;
        document?: import("./types").DocDocument;
        documents: import("./types").DocDocument[];
        policy_id?: number;
      };
    }>("/api/organizational/create-policy-folder", payload, { timeout: 120000 }),

  listOrganizationalPolicies: (payload?: {
    search?: string;
    status?: string;
    visibility?: string;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: import("./types").OrganizationalPolicy[]; count: number };
    }>("/api/organizational/policies", payload ?? {}),

  updateOrganizationalPolicy: (payload: {
    policy_id: number;
    lifecycle_status?: "draft" | "active" | "archived";
    name?: string;
    category?: string;
    description?: string;
    policy_visibility?: "employees" | "hr_only";
    effective_date?: string | false;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: { policy: import("./types").OrganizationalPolicy };
    }>("/api/organizational/policies/update", payload),

  generateFromOrganizationalTemplate: (payload: { template_id: number; folder_id: number }) =>
    rpc<{ success: boolean; message?: string; data: import("./types").DocDocument }>(
      "/api/organizational/generate-from-template",
      payload,
      { timeout: 120000 },
    ),

  createOrganizationalTemplate: (documentId: number) =>
    rpc<{ success: boolean; data: import("./types").DocDocument }>(
      "/api/organizational/create-template",
      { document_id: documentId },
    ),

  importOrganizationalPolicy: (documentId: number) =>
    rpc<{ success: boolean; message?: string }>("/api/organizational/import-policy", {
      document_id: documentId,
    }),

  analyzePolicyDocument: (documentId: number) =>
    rpc<{
      success: boolean;
      message?: string;
      data: {
        document_id: number;
        document_name: string;
        proposal: import("./policyProposal").PolicyAiProposal;
      };
    }>("/api/organizational/analyze-policy-document", {
      document_id: documentId,
    }, { timeout: 120000 }),

  confirmPolicyImport: (documentId: number, payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { policy: import("./types").CompliancePolicy; document: import("./types").DocDocument };
    }>("/api/organizational/confirm-policy-import", {
      document_id: documentId,
      ...payload,
    }),

  proposePolicyFromAi: (payload: {
    name: string;
    description?: string;
    policy_type_id?: number;
    document_type_ids?: number[];
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./policyProposal").PolicyAiProposal;
    }>("/api/compliance/policies/propose-from-ai", payload, { timeout: 120000 }),

  draftAiPolicy: (payload: {
    name: string;
    description?: string;
    policy_type_id?: number;
    document_type_ids?: number[];
    document_type_id?: number;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./policyProposal").PolicyAiProposal;
    }>("/api/organizational/ai-policy-draft", payload, { timeout: 120000 }),

  linkPolicyDocument: (policyId: number, documentId: number) =>
    rpc<{ success: boolean; message?: string; data: import("./types").CompliancePolicy }>(
      "/api/compliance/policies/link-document",
      { policy_id: policyId, document_id: documentId },
    ),

  unlinkPolicyDocument: (policyId: number) =>
    rpc<{ success: boolean; message?: string; data: import("./types").CompliancePolicy }>(
      "/api/compliance/policies/unlink-document",
      { policy_id: policyId },
    ),

  organizationalAutomations: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; message?: string; data: any }>(
      "/api/organizational/automations",
      payload,
    ),

  organizationalConnectors: (payload: Record<string, unknown> = {}) =>
    rpc<{
      success: boolean;
      data: { items?: { provider: string; label: string; connected: boolean }[] } | { provider: string; connected: boolean };
    }>("/api/organizational/connectors", payload),

  organizationalOauthStart: (payload: {
    provider: string;
    folder_id?: number;
    return_path?: string;
  }) =>
    rpc<{ success: boolean; message?: string; data?: { auth_url: string } }>(
      "/api/organizational/oauth/start",
      payload,
    ),

  organizationalOauthStatus: () =>
    rpc<{
      success: boolean;
      data: {
        items: {
          provider: string;
          configured: boolean;
          company_enabled: boolean;
          user_connected: boolean;
          account_label: string;
        }[];
      };
    }>("/api/organizational/oauth/status", {}),

  organizationalOauthDisconnect: (payload: { provider: string }) =>
    rpc<{ success: boolean; message?: string }>(
      "/api/organizational/oauth/disconnect",
      payload,
    ),

  listOrganizationalCloudFiles: (payload: {
    provider: string;
    parent_id?: string;
    page_token?: string;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: {
        items: {
          id: string;
          name: string;
          mime_type: string;
          is_folder: boolean;
          size: number;
          modified_at: string;
        }[];
        next_page_token?: string;
      };
    }>("/api/organizational/cloud-files/list", payload),

  importFromOrganizationalConnector: (payload: {
    folder_id: number;
    provider: string;
    file_id: string;
    document_type_id: number;
    name?: string;
  }) =>
    rpc<{ success: boolean; message?: string; data?: DocDocument }>(
      "/api/organizational/import-from-connector",
      payload,
    ),

  assignPolicyToEmployee: (payload: {
    /** Organizational policy registry id (active policies with a policy document). */
    policy_id: number;
    employee_id: number;
    requested_signature?: boolean;
    organizational_policy_id?: number;
  }) =>
    rpc<{ success: boolean; message?: string }>("/api/organizational/assign-policy-employee", payload),

  listEmployeePolicies: (employeeId: number) =>
    rpc<{ success: boolean; data: { items: any[] } }>("/api/organizational/employee-policies", {
      employee_id: employeeId,
    }),

  organizationalObjectAudit: (payload: { res_model: string; res_id: number }) =>
    rpc<{ success: boolean; data: { items: any[] } }>("/api/organizational/object-audit", payload),

  organizationalFoldersIndex: (payload: Record<string, unknown> = {}) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: import("./types").OrgFolderIndexRow[]; total_count: number };
    }>("/api/organizational/folders-index", payload),

  organizationalSearch: (payload: { query: string; limit?: number }) =>
    rpc<{
      success: boolean;
      data: {
        folders: import("./types").OrgFolderIndexRow[];
        documents: import("./types").DocDocument[];
      };
    }>("/api/organizational/search", payload),

  organizationalPolicyAssignments: (payload: Record<string, unknown> = {}) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: Record<string, unknown>[]; total_count: number };
    }>("/api/organizational/policy-assignments", payload),

  organizationalAutomationHub: () =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: Record<string, unknown>[] };
    }>("/api/organizational/automation-hub", {}),

  organizationalAuditExport: (payload: {
    res_model: string;
    res_id: number;
    include_shares?: boolean;
    include_approvals?: boolean;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: {
        object_audit: Record<string, unknown>[];
        share_access: Record<string, unknown>[];
        approvals: Record<string, unknown>[];
      };
    }>("/api/organizational/audit-export", payload),

  restoreOrganizationalVersion: (versionId: number) =>
    rpc<{ success: boolean; message?: string }>("/api/organizational/restore-version", {
      version_id: versionId,
    }),

  suggestOrganizationalFolderDescription: async (payload: {
    name: string;
    visibility?: string;
    description?: string;
  }) => {
    const result = await rpc<{
      success: boolean;
      message?: string;
      data?: { description: string };
    }>("/api/organizational/suggest-description", payload, { timeout: 120000 });
    if (!result?.success) {
      throw new Error(result?.message || "Unable to suggest a description.");
    }
    return result;
  },

  summarizeOrganizationalDocument: async (documentId: number) => {
    const result = await rpc<{
      success: boolean;
      message?: string;
      data?: { summary: string };
    }>(
      "/api/organizational/summarize-document",
      { document_id: documentId },
      { timeout: 120000 },
    );
    if (!result?.success) {
      throw new Error(result?.message || "Unable to summarize this document.");
    }
    return result;
  },

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
      | "permanent_delete"
      | "copy"
      | "print";
    folder_id?: number;
  }) =>
    rpc<{ success: boolean; data: { id: number; action: string } }>(
      "/api/document-action",
      payload,
    ),

  documentsAction: (payload: {
    document_ids: number[];
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
    rpc<{
      success: boolean;
      message?: string;
      pending_approval?: boolean;
      data?: { document_ids: number[]; action: string };
    }>("/api/documents-action", payload),

  lifecycleBulkAction: (payload: {
    action: "restore" | "permanent_delete";
    records: { record_type: "document" | "folder"; id: number }[];
  }) =>
    rpc<{ success: boolean; message?: string; data?: { count: number; action: string } }>(
      "/api/lifecycle-bulk-action",
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

  getWorkspaceActivity: async () => {
    const result = await rpc<{
      success: boolean;
      data: WorkspaceActivity;
      message?: string;
    }>("/api/workspace-activity", {});
    if (!result?.success || !result.data) {
      throw new Error(result?.message || "Acknowledgement data could not be loaded.");
    }
    return result;
  },

  getDocumentAcknowledgementAudience: (payload: {
    document_id: number;
    page?: number;
    limit?: number;
    search?: string;
    status?: "all" | "acknowledged" | "pending";
  }) =>
    rpc<{ success: boolean; data: DocumentAcknowledgementAudience; message?: string }>(
      "/api/acknowledgements/document-audience",
      payload,
    ),

  getOnboarding: () =>
    rpc<{ success: boolean; data: OnboardingState }>("/api/onboarding", {}),

  updateOnboarding: (payload: {
    action: "complete_step" | "complete" | "dismiss" | "reset" | "arm";
    module?: string;
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

  getMyReviewAlerts: () =>
    rpc<{
      success: boolean;
      data: { count: number; items: ReviewAlertItem[] };
    }>("/api/my-review-alerts", {}),

  acknowledgeReviewDecision: (id: number) =>
    rpc<{ success: boolean; data?: { id: number; review_decision_unread: boolean } }>(
      "/api/document/acknowledge-review-decision",
      { id },
    ),

  getDocumentLifecycle: (lifecycle: "archived" | "recycle_bin") =>
    rpc<{ success: boolean; data: DocDocument[] }>(
      "/api/document-lifecycle",
      { lifecycle },
    ),

  getFolderLifecycle: (lifecycle: "archived" | "recycle_bin") =>
    rpc<{ success: boolean; data: any[] }>("/api/folder-lifecycle", { lifecycle }),

  getSettings: () =>
    rpc<{
      success: boolean;
      data: {
        settings: any;
        document_categories: any[];
        document_types: any[];
        approvers: any[];
      };
    }>("/api/settings", {},),

  getOrganizationalDefaults: () =>
    rpc<{
      success: boolean;
      data?: {
        default_org_access_scope: string;
        default_org_restricted_scope: string;
      };
    }>("/api/organizational/defaults", {}),

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

  saveSettingsDocumentCategory: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data?: any; message?: string }>(
      "/api/settings/document-category",
      payload,
    ),

  toggleSettingsDocumentType: (id: number) =>
    rpc<{ success: boolean; active?: boolean; message?: string }>(
      "/api/settings/document-type/toggle",
      { id },
    ),

  deleteSettingsDocumentType: (id: number) =>
    rpc<{ success: boolean; message?: string }>(
      "/api/settings/document-type/delete",
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
    ).then(unwrapCompliance),

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
    ).then(unwrapCompliance),

  rejectException: (id: number) =>
    rpc<{ success: boolean; status?: string; message?: string }>(
      `/api/compliance/exceptions/${id}/reject`,
      {},
    ).then(unwrapCompliance),

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

  getComplianceRun: (runId: number) =>
    rpc<{ success: boolean; data: any; message?: string }>(
      `/api/compliance/runs/${runId}`,
      {},
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Run could not be loaded.");
      return r.data;
    }),

  getComplianceRunEmployees: (runId: number, payload: Record<string, unknown> = {}) =>
    rpc<{ success: boolean; data: any[]; total: number; page: number; page_size: number; message?: string }>(
      `/api/compliance/runs/${runId}/employees`,
      payload,
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Employees could not be loaded.");
      return r;
    }),

  getComplianceRunEmployee: (runId: number, employeeId: number) =>
    rpc<{ success: boolean; data: any; message?: string }>(
      `/api/compliance/runs/${runId}/employees/${employeeId}`,
      {},
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Employee result could not be loaded.");
      return r.data;
    }),

  exportComplianceRun: (runId: number, payload: Record<string, unknown> = {}) =>
    rpc<{ success: boolean; run: any; data: any[]; message?: string }>(
      `/api/compliance/runs/${runId}/export`,
      payload,
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Export failed.");
      return r;
    }),

  sendComplianceRunRequest: (
    runId: number,
    payload: { employee_id: number; due_date: string; subject: string; message: string },
  ) =>
    rpc<{ success: boolean; message?: string }>(
      `/api/compliance/runs/${runId}/request`,
      payload,
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Request could not be sent.");
      return r;
    }),

  getComplianceReport: (reportKey: string, payload: Record<string, unknown> = {}) =>
    rpc<{ success: boolean; data: any[]; total: number; page: number; page_size: number; message?: string }>(
      `/api/compliance/reports/${reportKey}`,
      payload,
    ).then((r) => {
      if (!r.success) throw new Error(r.message || "Report could not be loaded.");
      return r;
    }),

  evaluatePolicy: (policyId: number) =>
    rpc<{ success: boolean; data: any[]; run?: any; message?: string }>(
      `/api/compliance/policies/${policyId}/evaluate`,
      {},
    ).then(unwrapCompliance),

  complianceRunPreflight: (policyId: number) =>
    rpc<{
      success: boolean;
      data?: { applicable: number; exempt: number; to_evaluate: number };
      message?: string;
    }>(`/api/compliance/policies/${policyId}/run-preflight`, {}),

  revokeComplianceException: (id: number, reason: string) =>
    rpc<{ success: boolean; message?: string }>(
      `/api/compliance/exceptions/${id}/revoke`,
      { reason },
    ),

  getMyTeamCompliance: () =>
    rpc<{
      success: boolean;
      data: { rows: Array<Record<string, unknown>>; attention_count: number };
    }>("/api/compliance/my-team", {}),

  getMyVerifications: () =>
    rpc<{
      success: boolean;
      data: import("./types").ComplianceVerificationItem[];
    }>("/api/compliance/my-verifications", {}),

  getComplianceVerificationDetail: (itemId: number) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./types").ComplianceVerificationItem;
    }>(`/api/compliance/verifications/${itemId}`, {}),

  approveComplianceVerification: (itemId: number) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: import("./types").ComplianceVerificationItem;
    }>(`/api/compliance/verifications/${itemId}/approve`, {}),

  rejectComplianceVerification: (
    itemId: number,
    payload: { reason_code: string; note?: string },
  ) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: import("./types").ComplianceVerificationItem;
    }>(`/api/compliance/verifications/${itemId}/reject`, payload),

  completeComplianceTask: (taskId: number, payload: Record<string, unknown>) =>
    rpc<{ success: boolean; data: Record<string, unknown>; message?: string }>(
      "/api/compliance/tasks/complete",
      { task_id: taskId, ...payload },
    ),

  getMyComplianceTasks: () =>
    rpc<{ success: boolean; data: Record<string, unknown>[] }>(
      "/api/compliance/my-tasks",
      {},
    ),

  listComplianceRequestLinkableContent: (payload: {
    search?: string;
    policy_id?: number;
    applies_to?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    work_location_ids?: number[];
    employment_type_ids?: number[];
    branch_ids?: number[];
    limit?: number;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: import("./complianceRequestTasks").ComplianceLinkableContentItem[]; count: number };
    }>("/api/compliance/request-linkable-content", payload),

  listComplianceRequestLinkableTree: (payload: {
    parent_folder_id?: number;
    search?: string;
    policy_id?: number;
    applies_to?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    work_location_ids?: number[];
    employment_type_ids?: number[];
    branch_ids?: number[];
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./complianceRequestTasks").ComplianceLinkableTreeLevel;
    }>("/api/compliance/request-linkable-tree", payload),

  listRetentionSettings: (document_type_ids?: number[]) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./types").RetentionSettingRule[];
    }>("/api/compliance/retention-settings", {
      document_type_ids: document_type_ids || [],
    }),

  saveRetentionSettings: (payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./types").RetentionSettingRule;
    }>(
      "/api/compliance/retention-settings/save",
      payload,
    ),

  retentionPreview: (payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      data: {
        archive_within_90_days: number;
        delete_within_90_days: number;
      };
    }>("/api/compliance/retention-preview", payload),

  listRetentionBatches: (policyId?: number) =>
    rpc<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("/api/compliance/retention-batches", {
      policy_id: policyId || false,
    }),

  approveRetentionBatch: (batchId: number) =>
    rpc<{ success: boolean; message?: string; state?: string }>(
      `/api/compliance/retention-batches/${batchId}/approve`,
      {},
    ),

  rejectRetentionBatch: (batchId: number) =>
    rpc<{ success: boolean; message?: string; state?: string }>(
      `/api/compliance/retention-batches/${batchId}/reject`,
      {},
    ),

  getMyComplianceReviews: () =>
    rpc<{ success: boolean; data: Array<Record<string, unknown>> }>(
      "/api/compliance/my-reviews",
      {},
    ),

  startComplianceReview: (reviewId: number) =>
    rpc<{ success: boolean; message?: string; data?: Record<string, unknown> }>(
      `/api/compliance/reviews/${reviewId}/start`,
      {},
    ),

  completeComplianceReview: (
    reviewId: number,
    payload: { outcome?: string; submission_id?: number },
  ) =>
    rpc<{ success: boolean; message?: string; data?: Record<string, unknown> }>(
      `/api/compliance/reviews/${reviewId}/complete`,
      payload,
    ),

  getComplianceAuditLog: (policyId?: number) =>
    rpc<{ success: boolean; data: Array<Record<string, unknown>> }>(
      "/api/compliance/audit-log",
      { policy_id: policyId || false },
    ),

  getPolicies: () =>
    rpc<{ success: boolean; count: number; data: CompliancePolicy[] }>(
      "/api/compliance/policies",
      { active_only: false },
    ).then((r) => r.data),

  createPolicy: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: CompliancePolicy }>(
      "/api/compliance/policies/create",
      payload,
    ).then(unwrapCompliance),

  updatePolicy: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: CompliancePolicy }>(
      "/api/compliance/policies/update",
      payload,
    ).then(unwrapCompliance),

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

  createDocumentType: (payload: Record<string, any>) =>
    rpc<{ success: boolean; data: DocumentType; message?: string }>(
      "/api/create-document-type",
      payload,
    ),

  getDocumentVersions: (documentId: number) =>
    rpc<{ success: boolean; count: number; data: import("./types").DocumentVersion[] }>(
      "/api/document-versions",
      { document_id: documentId },
    ),

  deleteDocumentVersion: (versionId: number) =>
    rpc<{ success: boolean; message: string; data?: { document_id: number } }>(
      "/api/delete-document-version",
      { version_id: versionId },
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

  getModuleRoleDefinitions: () =>
    rpc<{ success: boolean; data: ModuleRoleDefinition[] }>(
      "/api/document-management/roles/definitions",
    ).then((result) => result.data),

  getModuleRoleMembers: (search = "", page = 1, pageSize = 10) =>
    rpc<{ success: boolean; data: ModuleRoleMember[] | ModuleRoleMembersPayload }>(
      "/api/document-management/roles/members",
      { search, page, page_size: pageSize },
    ).then((result) => {
      const data = result.data;
      if (Array.isArray(data)) {
        return { members: data, total: data.length };
      }
      return {
        members: data.members || [],
        total: data.total ?? data.members?.length ?? 0,
        page: data.page,
        page_size: data.page_size,
      };
    }),

  assignModuleRoles: (
    employeeId: number,
    assignments: ModuleRoleAssignment[],
  ) =>
    rpc<{ success: boolean; data: ModuleRoleMember }>(
      "/api/document-management/roles/assign",
      {
        employee_id: employeeId,
        assignments,
      },
    ).then((result) => result.data),

  listEmployeeFilesRoles: () =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesRole[] }>(
      "/api/employee-files/roles",
    ).then((result) => result.data),

  saveEmployeeFilesRole: (role: import("./types").EmployeeFilesRole) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesRole }>(
      "/api/employee-files/roles/save",
      { role },
    ).then((result) => result.data),

  deleteEmployeeFilesRole: (roleId: number) =>
    rpc<{ success: boolean }>("/api/employee-files/roles/delete", {
      role_id: roleId,
    }),

  getEmployeeFilesRoleMembers: (search = "", page = 1, pageSize = 10) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesRoleMembersPayload }>(
      "/api/employee-files/roles/members",
      { search, page, page_size: pageSize },
    ).then((result) => {
      const data = result.data;
      return {
        roles: data.roles || [],
        members: data.members || [],
        total: data.total ?? data.members?.length ?? 0,
        page: data.page,
        page_size: data.page_size,
      };
    }),

  assignEmployeeFilesRoles: (userId: number, roleIds: number[]) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesRoleMember }>(
      "/api/employee-files/roles/assign",
      { user_id: userId, role_ids: roleIds },
    ).then((result) => result.data),

  listEmployeeFilesRoleDocumentTypes: () =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesDocumentTypeOption[] }>(
      "/api/employee-files/roles/document-types",
    ).then((result) => result.data),

  listOrganizationalApprovals: (
    state?: string,
    filters?: {
      action_key?: string;
      requested_by_id?: number;
      overdue_only?: boolean;
      limit?: number;
    },
  ) =>
    rpc<{ success: boolean; data: import("./types").OrganizationalApprovalRequest[] }>(
      "/api/organizational/approvals",
      { state, ...filters },
    ).then((result) => result.data),

  approveOrganizationalApproval: (requestId: number, note = "") =>
    rpc<{ success: boolean }>("/api/organizational/approvals/approve", {
      request_id: requestId,
      note,
    }),

  rejectOrganizationalApproval: (requestId: number, note = "") =>
    rpc<{ success: boolean }>("/api/organizational/approvals/reject", {
      request_id: requestId,
      note,
    }),

  withdrawOrganizationalApproval: (requestId: number) =>
    rpc<{ success: boolean }>("/api/organizational/approvals/withdraw", {
      request_id: requestId,
    }),

  bulkApproveOrganizationalApprovals: (requestIds: number[], note = "") =>
    rpc<{ success: boolean; data: import("./types").OrganizationalApprovalBulkResult }>(
      "/api/organizational/approvals/bulk-approve",
      { request_ids: requestIds, note },
    ).then((result) => result.data),

  bulkRejectOrganizationalApprovals: (requestIds: number[], note = "") =>
    rpc<{ success: boolean; data: import("./types").OrganizationalApprovalBulkResult }>(
      "/api/organizational/approvals/bulk-reject",
      { request_ids: requestIds, note },
    ).then((result) => result.data),

  listOrganizationalExternalShares: (documentId: number) =>
    rpc<{ success: boolean; data: Record<string, unknown>[] }>(
      "/api/organizational/documents/share-links",
      { document_id: documentId },
    ).then((result) => result.data),

  createOrganizationalExternalShare: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; data: Record<string, unknown> }>(
      "/api/organizational/documents/share-links/create",
      payload,
    ).then((result) => result.data),

  revokeOrganizationalExternalShare: (shareId: number) =>
    rpc<{ success: boolean }>("/api/organizational/documents/share-links/revoke", {
      share_id: shareId,
    }),

  listOrganizationalLegalHolds: (payload: { document_id?: number; folder_id?: number }) =>
    rpc<{ success: boolean; data: Record<string, unknown>[] }>(
      "/api/organizational/legal-holds",
      payload,
    ).then((result) => result.data),

  placeOrganizationalLegalHold: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; data: Record<string, unknown> }>(
      "/api/organizational/legal-holds/place",
      payload,
    ).then((result) => result.data),

  releaseOrganizationalLegalHold: (holdId: number) =>
    rpc<{ success: boolean }>("/api/organizational/legal-holds/release", {
      hold_id: holdId,
    }),

  getOrganizationalLibraryHome: () =>
    rpc<{
      success: boolean;
      data: {
        root_folder_count: number;
        recent_files: {
          id: number;
          name: string;
          folder_id: number;
          folder_name: string;
          mime_type?: string;
          updated_at?: string;
        }[];
        storage: { used_bytes: number; quota_bytes: number; quota_gb: number };
      };
    }>("/api/organizational/library-home", {}).then((result) => result.data),

  listOrganizationalRetentionReview: () =>
    rpc<{ success: boolean; data: import("./types").DocDocument[] }>(
      "/api/organizational/retention/review-queue",
    ).then((result) => result.data),

  disposeOrganizationalRetention: (documentId: number, action: "archive" | "delete") =>
    rpc<{ success: boolean }>("/api/organizational/retention/dispose", {
      document_id: documentId,
      action,
    }),

  getEmployeeFilesConfig: () =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesConfig }>(
      "/api/employee-files/config",
    ).then((r) => r.data),

  saveEmployeeFilesConfig: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesConfig }>(
      "/api/employee-files/config/save",
      payload,
    ).then((r) => r.data),

  saveEmployeeFilesHeaderFields: (headerFieldKeys: string[]) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesConfig }>(
      "/api/employee-files/config/header-fields",
      { header_field_keys: headerFieldKeys },
    ).then((r) => r.data),

  previewEmployeeFilesOrganizing: (payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFilesSetupPreview;
    }>("/api/employee-files/config/preview", payload).then((r) => r.data),

  getEmployeeFilesDimensions: () =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFileDimensionOption[];
    }>("/api/employee-files/dimensions").then((r) => r.data),

  listEmployeeFileExclusions: (reason?: string) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileExclusion[] }>(
      "/api/employee-files/exclusions",
      reason ? { reason } : {},
    ).then((r) => r.data),

  addEmployeeFileExclusions: (employeeIds: number[], justification?: string) =>
    rpc<{ success: boolean; ids: number[] }>("/api/employee-files/exclusions/add", {
      employee_ids: employeeIds,
      justification,
    }),

  importEmployeeFileExclusions: (employeeIds: number[]) =>
    rpc<{ success: boolean; ids: number[] }>("/api/employee-files/exclusions/import", {
      rows: employeeIds.map((employee_id) => ({ employee_id })),
    }),

  removeEmployeeFileExclusion: (id: number) =>
    rpc<{ success: boolean }>("/api/employee-files/exclusions/remove", { id }),

  listEmsEmployees: (search?: string, limit = 200) =>
    rpc<{ success: boolean; data: import("./types").EmsEmployeeOption[] }>(
      "/api/employee-files/ems-employees",
      { search, limit },
    ).then((r) => r.data),

  previewEmployeeFilesSetup: (payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFilesSetupPreview;
    }>("/api/employee-files/setup/preview", payload).then((r) => r.data),

  listEmployeeFilesSetupAttention: (
    payload: Record<string, unknown>,
    params?: {
      search?: string;
      limit?: number;
      offset?: number;
      issue_type?: string;
      issue_types?: string[];
    },
  ) =>
    rpc<{
      success: boolean;
      data: {
        items: import("./types").EmployeeFilesSetupAttentionEmployee[];
        total: number;
        categories: Array<{
          issue_type: string;
          label: string;
          count: number;
        }>;
      };
    }>("/api/employee-files/setup/preview/attention", {
      ...payload,
      search: params?.search ?? "",
      limit: params?.limit ?? 10,
      offset: params?.offset ?? 0,
      issue_type: params?.issue_type ?? "all",
      issue_types: params?.issue_types ?? [],
    }).then((r) => r.data),

  confirmEmployeeFilesSetup: (payload: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFilesSetupRun;
    }>("/api/employee-files/setup/confirm", payload).then((r) => r.data),

  getEmployeeFilesSetupStatus: (runId?: number) =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFilesSetupRun | null;
    }>("/api/employee-files/setup/status", runId ? { run_id: runId } : {}).then(
      (r) => r.data,
    ),

  getEmployeeFilesHomeStats: () =>
    rpc<{ success: boolean; data: import("./types").EmployeeFilesHomeStats }>(
      "/api/employee-files/home/stats",
    ).then((r) => r.data),

  listEmployeeFileGroups: (params: {
    group_kind?: string;
    dimension?: string;
    search?: string;
    for_home?: boolean;
    include_all_custom?: boolean;
  }) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup[] }>(
      "/api/employee-files/groups",
      params,
    ).then((r) => r.data),

  updateEmployeeFileGroup: (payload: {
    id: number;
    name?: string;
    description?: string;
    show_on_home?: boolean;
  }) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup }>(
      "/api/employee-files/group/update",
      payload,
    ).then((r) => r.data),

  getEmployeeFileGroup: (id: number) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup }>(
      "/api/employee-files/group",
      { id },
    ).then((r) => r.data),

  searchEmployeeFilesDocuments: (params: {
    query?: string;
    category?: string;
    document_type_id?: string | number;
    department_id?: string | number;
    source?: string;
    status?: string;
    limit?: number;
    offset?: number;
    order?: string;
  }) =>
    rpc<{
      success: boolean;
      data: {
        items: import("./types").DocDocument[];
        total: number;
        limit: number;
        offset: number;
      };
    }>("/api/employee-files/documents/search", params).then((r) => r.data),

  listEmployeeFileSummaries: (params?: {
    search?: string;
    limit?: number;
    offset?: number;
    department_id?: number | string;
    order?: string;
    attention_filter?: string;
  }) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileSummaryPage }>(
      "/api/employee-files/employee-files",
      params ?? {},
    ).then((r) => r.data),

  listEmployeeGroupMembers: (
    groupId: number,
    params?: {
      search?: string;
      limit?: number;
      offset?: number;
      order?: string;
      attention_filter?: string;
    },
  ) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileSummaryPage }>(
      "/api/employee-files/group/members",
      { id: groupId, ...(params ?? {}) },
    ).then((r) => r.data),

  getEmployeeFileSummary: (employeeId: number) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileSummary }>(
      "/api/employee-files/employee-file",
      { employee_id: employeeId },
    ).then((r) => r.data),

  getEmployeeFileDocuments: (employeeId: number) =>
    rpc<{ success: boolean; data: import("./types").DocDocument[] }>(
      "/api/employee-files/employee-file/documents",
      { employee_id: employeeId },
    ).then((r) => r.data),

  getEmployeeFileActivity: (employeeId: number) =>
    rpc<{ success: boolean; data: import("./types").WorkspaceActivityEvent[] }>(
      "/api/employee-files/employee-file/activity",
      { employee_id: employeeId },
    ).then((r) => r.data),

  listEmployeeFileIssues: (
    category = "all",
    params?: { search?: string; limit?: number; offset?: number },
  ) =>
    rpc<{
      success: boolean;
      data: import("./types").EmployeeFileIssue[];
      total: number;
      limit: number;
      offset: number;
      summary: { total: number; categories: Array<{ category: string; label: string; count: number }> };
    }>("/api/employee-files/issues", { category, ...(params ?? {}) }).then((r) => r),

  employeeFileIssueAction: (id: number, action?: string) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileIssue }>(
      "/api/employee-files/issues/action",
      { id, action },
    ).then((r) => r.data),

  downloadEmployeeFileIssuesReport: () =>
    triggerDownload("/api/employee-files/issues/export"),

  createCustomEmployeeGroup: (payload: {
    name: string;
    description?: string;
    icon?: string;
  }) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup }>(
      "/api/employee-files/group/create",
      payload,
    ).then((r) => r.data),

  addEmployeeFilesToGroup: (groupId: number, employeeFileIds: number[]) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup }>(
      "/api/employee-files/group/add-members",
      { id: groupId, employee_file_ids: employeeFileIds },
    ).then((r) => r.data),

  removeEmployeeFilesFromGroup: (groupId: number, employeeFileIds: number[]) =>
    rpc<{ success: boolean; data: import("./types").EmployeeFileGroup }>(
      "/api/employee-files/group/remove-members",
      { id: groupId, employee_file_ids: employeeFileIds },
    ).then((r) => r.data),

  employeeFilesGlobalSearch: (query: string, scope = "all") =>
    rpc<{
      success: boolean;
      data: { employees: import("./types").EmployeeFileSummary[]; documents: any[] };
    }>("/api/employee-files/search", { query, scope }).then((r) => r.data),

  toggleEmployeeFileFavorite: (id: number) =>
    rpc<{ success: boolean; favorite: boolean }>(
      "/api/employee-files/favorite",
      { id },
    ).then((r) => r.favorite),

  reclassifyEmployeeDocument: (documentId: number, documentTypeId: number) =>
    rpc<{ success: boolean }>("/api/employee-files/document/reclassify", {
      document_id: documentId,
      document_type_id: documentTypeId,
    }),

  requestDocumentSignature: (documentId: number, signerEmployeeId: number) =>
    rpc<{ success: boolean; data: { id: number; state: string } }>(
      "/api/employee-files/signature/request",
      { document_id: documentId, signer_employee_id: signerEmployeeId },
    ).then((r) => r.data),

  getEmployeeDocumentRelations: (documentId: number) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./types").DocDocumentRelation[];
    }>("/api/employee-files/document/relations", {
      document_id: documentId,
    }).then((r) => {
      if (!r.success) {
        throw new Error(r.message || "Could not load document relationships.");
      }
      return r.data;
    }),

  addEmployeeDocumentRelation: (payload: {
    source_document_id: number;
    target_document_id: number;
    relation_type: import("./types").DocumentRelationType;
  }) =>
    rpc<{
      success: boolean;
      message?: string;
      data: import("./types").DocDocumentRelation;
    }>("/api/employee-files/document/relation/add", payload).then((r) => {
      if (!r.success) {
        throw new Error(r.message || "Could not add document relationship.");
      }
      return r.data;
    }),

  removeEmployeeDocumentRelation: (relationId: number) =>
    rpc<{ success: boolean; message?: string }>(
      "/api/employee-files/document/relation/remove",
      { relation_id: relationId },
    ).then((r) => {
      if (!r.success) {
        throw new Error(r.message || "Could not remove document relationship.");
      }
      return r;
    }),

  workspaceAccessCatalog: () =>
    rpc<{ success: boolean; message?: string; data: { modules: WorkspaceModule[] } }>(
      "/api/workspace-access/modules/catalog",
      {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data.modules;
    }),

  workspaceAccessEligibleModules: () =>
    rpc<{ success: boolean; message?: string; data: { modules: WorkspaceModule[] } }>(
      "/api/workspace-access/modules/eligible",
      {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data.modules;
    }),

  workspaceAccessIncoming: () =>
    rpc<{ success: boolean; message?: string; data: { items: WorkspaceGrant[] } }>(
      "/api/workspace-access/invites/incoming",
      {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data.items;
    }),

  workspaceAccessOutgoing: () =>
    rpc<{ success: boolean; message?: string; data: { items: WorkspaceGrant[] } }>(
      "/api/workspace-access/invites/outgoing",
      {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data.items;
    }),

  workspaceAccessCreateInvite: (payload: {
    delegate_id?: number;
    valid_until: string;
    module_keys: string[];
    note?: string;
    generate_code?: boolean;
  }) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/invites/create",
      payload,
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessAccept: (grantId: number) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/invites/accept",
      { grant_id: grantId },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessAcceptCode: (code: string) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/invites/accept-code",
      { code },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessDecline: (grantId: number) =>
    rpc<{ success: boolean; message?: string }>(
      "/api/workspace-access/invites/decline",
      { grant_id: grantId },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r;
    }),

  workspaceAccessRevoke: (grantId: number) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/grants/revoke",
      { grant_id: grantId },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessCancel: (grantId: number) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/grants/cancel",
      { grant_id: grantId },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessDeactivate: (grantId: number) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/grants/deactivate",
      { grant_id: grantId },
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessUpdateGrant: (payload: {
    grant_id: number;
    module_keys: string[];
    valid_until: string;
  }) =>
    rpc<{ success: boolean; message?: string; data: WorkspaceGrant }>(
      "/api/workspace-access/grants/update",
      payload,
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data;
    }),

  workspaceAccessSearchUsers: (query: string) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: { id: number; name: string; email: string }[] };
    }>("/api/workspace-access/users/search", { query }, { skipWorkspaceGrant: true }).then(
      (r) => {
        if (r.success === false) throw new Error(r.message || "Request failed.");
        return r.data.items;
      },
    ),

  workspaceAccessSession: (grantId?: number) =>
    rpc<{ success: boolean; message?: string; data: { grant: WorkspaceGrant | null } }>(
      "/api/workspace-access/session",
      grantId ? { grant_id: grantId } : {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r.data.grant;
    }),

  workspaceAccessClearSession: () =>
    rpc<{ success: boolean; message?: string }>(
      "/api/workspace-access/session/clear",
      {},
      { skipWorkspaceGrant: true },
    ).then((r) => {
      if (r.success === false) throw new Error(r.message || "Request failed.");
      return r;
    }),
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
