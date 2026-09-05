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
  QuickAccess,
  DashboardStats,
  DocumentType,
  ShareLink,
} from "./types";
import {
  TEST_DOCUMENTS,
  TEST_DOCUMENT_TYPES,
  TEST_COMPLIANCE_TARGETS,
  TEST_EXCEPTIONS,
  TEST_EVALUATIONS,
  TEST_FOLDERS,
  TEST_POLICIES,
  TEST_POLICY_TYPES,
  TEST_SHARE_LINKS,
  TEST_STATS,
  TEST_USER,
} from "./mock-data";

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { message: string; data?: any };
}

let testPolicies = [...TEST_POLICIES];

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

export const useTestData =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_TEST_DATA === "true";

async function rpc<T = any>(
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
    if (useTestData) return TEST_USER;
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
    if (useTestData) return TEST_USER;

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
    useTestData
      ? Promise.resolve(TEST_STATS)
      : rpc<DashboardStats>("/api/dashboard-stats"),

  getFolders: () =>
    (useTestData
      ? Promise.resolve({
          data: {
            data: TEST_FOLDERS.filter((folder) => folder.active !== false),
          },
        })
      : rpc<{
          success: boolean;
          count: number;
          data: { data: DocFolder[]; total_count: number };
        }>("/api/get-folder", {})
    ).then((r) => r.data.data),

  getQuickAccess: () => useTestData
    ? Promise.resolve({ data: { folders: TEST_FOLDERS.filter((folder) => folder.pinned), documents: TEST_DOCUMENTS.filter((document) => document.pinned) } as QuickAccess })
    : rpc<{ success: boolean; data: QuickAccess }>("/api/quick-access", {}),

  getFolder: (id: number) =>
    rpc<{ success: boolean; data: { data: DocFolder } }>(
      `/api/view-folder/${id}`,
      {},
    ).then((r) => r.data.data),

  createFolder: (payload: Record<string, any>) =>
    useTestData
      ? Promise.resolve().then(() => {
          const id = Math.max(...TEST_FOLDERS.map((folder) => folder.id), 0) + 1;
          const folder = { id, folder_name: payload.nameElm, description: payload.descriptionElm || "", folder_type: payload.folder_type || "organizational", owner_id: TEST_USER.id, owner_name: TEST_USER.name, document_count: 0, last_modified: new Date().toISOString(), access_scope: payload.access_scope || "all_staff", is_locked: false, color: 4, employee_ids: payload.employee_ids || [] } as DocFolder;
          TEST_FOLDERS.push(folder);
          return { success: true, message: "Folder created successfully.", data: folder };
        })
      : rpc<{ success: boolean; message: string; data: DocFolder }>("/api/create-folder", payload),

  addEmployeesToFolder: (payload: { id: number; employee_ids: number[] }) =>
    useTestData
      ? Promise.resolve().then(() => {
          const folder = TEST_FOLDERS.find((item) => item.id === payload.id);
          if (folder) folder.employee_ids = [...new Set([...(folder.employee_ids || []), ...payload.employee_ids])];
          return { success: true, employee_ids: payload.employee_ids };
        })
      : rpc<{ success: boolean; employee_ids: number[] }>("/api/folder/add-employees", payload),

  updateFolder: (payload: {
    id: number;
    name: string;
    description?: string;
  }) =>
    useTestData
      ? Promise.resolve().then(() => {
          const folder = TEST_FOLDERS.find((item) => item.id === payload.id);
          if (folder) {
            folder.folder_name = payload.name;
            folder.description = payload.description || "";
          }
          return { success: true, message: "Folder updated successfully." };
        })
      : rpc<{ success: boolean; message: string }>("/api/update-folder", {
          id: payload.id,
          folder_name: payload.name,
          description: payload.description,
        }),

  deleteFolder: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => {
          const index = TEST_FOLDERS.findIndex((item) => item.id === id);
          if (index >= 0) TEST_FOLDERS.splice(index, 1);
          return { success: true, message: "Folder deleted successfully." };
        })
      : rpc<{ success: boolean; message: string }>("/api/delete-folder", {
          id,
        }),

  archiveFolder: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => {
          const folder = TEST_FOLDERS.find((item) => item.id === id);
          if (folder) folder.active = false;
          return { success: true, message: "Folder archived successfully." };
        })
      : rpc<{ success: boolean; message: string }>("/api/archive-folder", {
          id,
        }),

  folderAction: (payload: {
    id: number;
    action: string;
    permission?: string;
    expiry_option?: string;
    allow_download?: boolean;
    allow_printing?: boolean;
  }) =>
    useTestData
      ? Promise.resolve().then(() => {
          const folder = TEST_FOLDERS.find((item) => item.id === payload.id);
          if (folder && payload.action === "favorite")
            folder.favorite = !folder.favorite;
          if (folder && payload.action === "pin")
            folder.pinned = !folder.pinned;
          if (folder && payload.action === "lock") folder.locked = true;
          if (folder && payload.action === "unlock") folder.locked = false;
          if (folder && payload.action === "archive") folder.active = false;
          return {
            success: true,
            data: {
              token: `test-folder-${payload.id}`,
              url: `/document-management/shared/folder/test-folder-${payload.id}`,
            },
          };
        })
      : rpc<{ success: boolean; data: { token?: string; url?: string } }>(
          "/api/folder-action",
          payload,
        ),

  getDocuments: (folderId?: number | null, includeInactive = false) =>
    (useTestData
      ? Promise.resolve({
          data: {
            data: folderId
              ? TEST_DOCUMENTS.filter((doc) => doc.folder_id === folderId && (includeInactive || doc.active !== false))
              : TEST_DOCUMENTS.filter((doc) => includeInactive || doc.active !== false),
          },
        })
      : rpc<{
          success: boolean;
          count: number;
          data: { data: DocDocument[]; total_count: number };
        }>("/api/get-document", { folder_id: folderId || false, include_inactive: includeInactive })
    ).then((r) => r.data.data),

  getMyDocuments: () =>
    useTestData
      ? Promise.resolve({ data: TEST_DOCUMENTS.filter((document) => document.employee_id === TEST_USER.id) })
      : rpc<{ success: boolean; data: DocDocument[] }>("/api/my-documents", {}),

  getMyWorkspace: () => {
    if (useTestData) {
      const myFiles = TEST_DOCUMENTS.filter((document) => document.employee_id === TEST_USER.id);
      const sharedDocuments = TEST_DOCUMENTS.filter((document) => document.folder_id === 2 && document.state !== "draft");
      const combined = [...myFiles, ...sharedDocuments];
      return Promise.resolve({
        data: {
          my_files: myFiles,
          shared_documents: sharedDocuments,
          outstanding: [{ ...TEST_DOCUMENTS[0], id: -4, name: "Training Certificate", description: "Required document not yet submitted.", document_type: "Training Certificate", document_type_id: 4, state: "missing" } as DocDocument],
          activity: combined.slice(0, 20).map((document) => ({ id: document.id, document_id: document.id, document: document.name, folder: document.folder_name, event: "Updated", occurred_at: document.write_date })),
          dashboard: { total: combined.length, expiring: combined.filter((document) => document.has_expiry).length, states: Object.fromEntries(["approved", "processing", "draft", "rejected", "expired"].map((state) => [state, combined.filter((document) => document.state === state).length])) },
        } as MyWorkspace,
      });
    }
    return rpc<{ success: boolean; data: MyWorkspace }>("/api/my-workspace", {});
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

  uploadDocument: (payload: { file: File; folder_id: number; document_type_id: number }) => {
    if (useTestData) {
      const id = Math.max(...TEST_DOCUMENTS.map((document) => document.id), 0) + 1;
      const document = {
        ...TEST_DOCUMENTS[0], id, name: payload.file.name, folder_id: payload.folder_id,
        folder_name: TEST_FOLDERS.find((folder) => folder.id === payload.folder_id)?.folder_name ?? "Organization",
        employee_id: null, employee_name: "N/A", document_type_id: payload.document_type_id,
        document_type: TEST_DOCUMENT_TYPES.find((type) => type.id === payload.document_type_id)?.name ?? "Document",
        file_size: payload.file.size, mime_type: payload.file.type || "application/octet-stream",
      } as DocDocument;
      TEST_DOCUMENTS.push(document);
      return Promise.resolve({ success: true, data: document });
    }
    const form = new FormData();
    form.append("file", payload.file);
    form.append("folder_id", String(payload.folder_id));
    form.append("document_type_id", String(payload.document_type_id));
    return client.post<{ success: boolean; data: DocDocument }>("/api/upload-document", form).then((response) => response.data);
  },

  updateDocument: (payload: { id: number; [key: string]: any }) =>
    rpc<{ success: boolean; message: string }>("/api/update-document", payload),

  deleteDocument: (id: number) =>
    rpc<{ success: boolean; message: string }>("/api/delete-document", { id }),

  documentAction: (payload: {
    id: number;
    action: "favorite" | "pin" | "delete" | "archive" | "restore" | "activate" | "deactivate" | "permanent_delete";
  }) =>
    useTestData
      ? Promise.resolve({
          success: true,
          data: { id: payload.id, action: payload.action },
        }).then((result) => {
          const document = TEST_DOCUMENTS.find((item) => item.id === payload.id) as (DocDocument & { deleted_at?: string; recycle_bin_until?: string }) | undefined;
          if (document && payload.action === "delete") {
            document.active = false;
            document.deleted_at = new Date().toISOString();
            document.recycle_bin_until = new Date(Date.now() + 30 * 86400000).toISOString();
          }
          if (document && payload.action === "archive") {
            document.active = false;
            document.distribution_status = "archived";
            delete document.deleted_at;
          }
          if (document && payload.action === "deactivate") { document.active = false; document.distribution_status = "deactivated"; }
          if (document && payload.action === "activate") { document.active = true; document.distribution_status = "active"; }
          if (document && payload.action === "pin") document.pinned = !document.pinned;
          if (document && payload.action === "restore") {
            document.active = true;
            delete document.deleted_at;
            delete document.recycle_bin_until;
          }
          if (document && payload.action === "permanent_delete") {
            const index = TEST_DOCUMENTS.findIndex((item) => item.id === payload.id);
            if (index >= 0) TEST_DOCUMENTS.splice(index, 1);
          }
          return result;
        })
      : rpc<{ success: boolean; data: { id: number; action: string } }>(
          "/api/document-action",
          payload,
      ),

  acknowledgeDocument: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => { const document = TEST_DOCUMENTS.find((item) => item.id === id); if (document) document.acknowledged = true; return { success: true, data: { acknowledged: true } }; })
      : rpc<{ success: boolean; data: { acknowledged: boolean } }>("/api/document/acknowledge", { id }),

  getAdminAttention: () =>
    useTestData
      ? Promise.resolve().then(() => { const items = TEST_DOCUMENTS.filter((document) => document.approval_state === "pending").map((document) => ({ id: document.id, document_id: document.id, employee_id: document.employee_id || 0, document: document.name, employee: document.employee_name, message: `Hello ${TEST_USER.name}, your attention is required to approve or reject ${document.employee_name} file they just uploaded.`, created_at: document.created_at })); return { data: { count: items.length, notifications: items, mailbox: items } as AdminAttention }; })
      : rpc<{ success: boolean; data: AdminAttention }>("/api/admin-attention", {}),

  reviewDocument: (payload: { id: number; action: "approve" | "reject"; reason?: string }) =>
    useTestData
      ? Promise.resolve({ success: true, data: { id: payload.id, state: payload.action === "approve" ? "approved" : "rejected", approval_state: payload.action === "approve" ? "approved" : "rejected" } })
      : rpc<{ success: boolean; data: any }>("/api/document-review", payload),

  getDocumentLifecycle: (lifecycle: "archived" | "recycle_bin") =>
    useTestData
      ? Promise.resolve({
          data: TEST_DOCUMENTS.filter((document) =>
            lifecycle === "archived"
              ? document.active === false && !(document as any).deleted_at
              : Boolean((document as any).deleted_at),
          ),
        })
      : rpc<{ success: boolean; data: DocDocument[] }>("/api/document-lifecycle", {
          lifecycle,
        }),

  getPolicyTypes: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_POLICY_TYPES })
      : rpc<{ success: boolean; data: any[] }>(
          "/api/compliance/policy-types",
          {},
        )
    ).then((r) => r.data),

  getComplianceTargets: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_COMPLIANCE_TARGETS })
      : rpc<{ success: boolean; data: ComplianceTargets }>(
          "/api/compliance/targets",
          {},
        )
    ).then((r) => r.data),

  getExceptions: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_EXCEPTIONS })
      : rpc<{ success: boolean; data: any[] }>("/api/compliance/exceptions", {})
    ).then((r) => r.data),

  createException: (payload: Record<string, any>) =>
    useTestData
      ? Promise.resolve({
          success: true,
          data: {
            ...payload,
            id: Date.now(),
            employee:
              TEST_COMPLIANCE_TARGETS.employees.find(
                (item) => item.id === payload.employee_id,
              )?.name ?? "Employee",
            policy:
              testPolicies.find((item) => item.id === payload.policy_id)
                ?.name ?? "Policy",
            status: "pending",
          },
        })
      : rpc<{ success: boolean; data: any }>(
          "/api/compliance/exceptions/create",
          payload,
        ),

  deactivateException: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => {
          const exception = TEST_EXCEPTIONS.find((item) => item.id === id);
          if (exception) (exception as any).active = false;
          return { success: true, active: false };
        })
      : rpc<{ success: boolean; active: boolean }>(`/api/compliance/exceptions/${id}/deactivate`, {}),

  reactivateException: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => {
          const exception = TEST_EXCEPTIONS.find((item) => item.id === id);
          if (exception) (exception as any).active = true;
          return { success: true, active: true };
        })
      : rpc<{ success: boolean; active: boolean }>(`/api/compliance/exceptions/${id}/reactivate`, {}),

  deleteException: (id: number) =>
    useTestData
      ? Promise.resolve().then(() => {
          const index = TEST_EXCEPTIONS.findIndex((item) => item.id === id);
          if (index >= 0) TEST_EXCEPTIONS.splice(index, 1);
          return { success: true, message: "Exception deleted." };
        })
      : rpc<{ success: boolean; message: string }>(`/api/compliance/exceptions/${id}/delete`, {}),

  getEvaluations: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_EVALUATIONS })
      : rpc<{ success: boolean; data: any[] }>(
          "/api/compliance/evaluations",
          {},
        )
    ).then((r) => r.data),

  evaluatePolicy: (policyId: number) =>
    useTestData
      ? Promise.resolve({
          success: true,
          data: TEST_EVALUATIONS.filter((item) => item.policy_id === policyId),
        })
      : rpc<{ success: boolean; data: any[] }>(
          `/api/compliance/policies/${policyId}/evaluate`,
          {},
        ),

  getPolicies: () =>
    (useTestData
      ? Promise.resolve({ data: testPolicies })
      : rpc<{ success: boolean; count: number; data: CompliancePolicy[] }>(
          "/api/compliance/policies",
          { active_only: true },
        )
    ).then((r) => r.data),

  createPolicy: (payload: Record<string, any>) =>
    useTestData
      ? Promise.resolve({
          success: true,
          data: {
            ...payload,
            id: Math.max(...testPolicies.map((policy) => policy.id), 0) + 1,
            policy_type:
              TEST_POLICY_TYPES.find(
                (type) => type.id === payload.policy_type_id,
              )?.name ?? "Policy",
            schedule: payload.schedule || "manual",
            active: payload.active ?? true,
          } as CompliancePolicy,
        }).then((result) => {
          testPolicies = [...testPolicies, result.data];
          return result;
        })
      : rpc<{ success: boolean; data: CompliancePolicy }>(
          "/api/compliance/policies/create",
          payload,
        ),

  updatePolicy: (payload: Record<string, any>) =>
    useTestData
      ? Promise.resolve({ success: true, data: Object.assign(testPolicies.find((policy) => policy.id === payload.id) ?? {}, payload) as CompliancePolicy })
      : rpc<{ success: boolean; data: CompliancePolicy }>("/api/compliance/policies/update", payload),

  deletePolicy: (id: number) =>
    useTestData
      ? Promise.resolve({ success: true, message: "Policy deleted." }).then((result) => { testPolicies = testPolicies.filter((policy) => policy.id !== id); return result; })
      : rpc<{ success: boolean; message: string }>("/api/compliance/policies/delete", { id }),

  getDocumentTypes: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_DOCUMENT_TYPES })
      : rpc<{ success: boolean; data: DocumentType[] }>(
          "/api/get-document-type",
          {},
        )
    ).then((r) => r.data),

  getShareLinks: () =>
    (useTestData
      ? Promise.resolve({ data: TEST_SHARE_LINKS })
      : rpc<{ success: boolean; data: ShareLink[] }>("/api/share-links", {})
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
  const backendUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");
  link.href = `${backendUrl}${url}`;
  link.download = "";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
