import { rpc } from "./api";
import { multipartClient } from "./api";

export type MergeField = {
  key: string;
  label: string;
  source: "company" | "employee" | "department" | "user" | "manual";
  dataType: "text" | "longText" | "date" | "time" | "email" | "person" | "select";
  required?: boolean;
  options?: { label: string; value: string }[];
};

export type TemplateItem = {
  id: number;
  kind: "template" | "form";
  name: string;
  description: string;
  category_id: number;
  category: string;
  icon: string;
  status: string;
  file_name: string;
  file_size: number;
  favourite: boolean;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
  owner: string;
  current_version_id: number | false;
  merge_fields: MergeField[];
  processing_error: string;
};

export type TemplateCategory = {
  id: number;
  name: string;
  applies_to: "template" | "form" | "both";
};

export type LibraryQuery = {
  kind: "template" | "form";
  q?: string;
  sort?: string;
  dir?: string;
  favourite?: boolean;
  recent?: boolean;
  category_ids?: number[];
  cursor?: number;
  limit?: number;
};

type RpcList<T> = { success: boolean; message?: string; data?: T };

async function unwrap<T>(path: string, params: Record<string, unknown> = {}) {
  const result = await rpc<RpcList<T>>(path, params);
  if (!result?.success) {
    throw new Error(result?.message || "Request failed");
  }
  return result.data as T;
}

export const templatesFormsApi = {
  categories: () => unwrap<TemplateCategory[]>("/api/templates-forms/categories"),
  list: (query: LibraryQuery) =>
    unwrap<{
      items: TemplateItem[];
      counts: { templates: number; forms: number };
      next_cursor: number | false;
    }>("/api/templates-forms", query as unknown as Record<string, unknown>),
  get: (id: number) => unwrap<TemplateItem>(`/api/templates-forms/${id}`),
  patch: (id: number, payload: Record<string, unknown>) =>
    unwrap<TemplateItem>(`/api/templates-forms/${id}`, payload),
  upload: async (payload: {
    file: File;
    kind: "template" | "form";
    category_id: number;
    description: string;
    icon: string;
    name?: string;
  }) => {
    const form = new FormData();
    form.append("file", payload.file, payload.file.name);
    form.append("kind", payload.kind);
    form.append("category_id", String(payload.category_id));
    form.append("description", payload.description);
    form.append("icon", payload.icon);
    if (payload.name) form.append("name", payload.name);
    const { data } = await multipartClient.post<RpcList<TemplateItem>>(
      "/api/templates-forms/upload",
      form,
    );
    if (!data?.success || !data.data) {
      throw new Error(data?.message || "Upload failed.");
    }
    return data.data;
  },
  generate: (id: number, payload: Record<string, unknown> = {}) =>
    unwrap<Record<string, unknown>>(`/api/templates/${id}/generate`, payload),
  startAssignment: (id: number, clientToken?: string) =>
    unwrap<Record<string, unknown>>(`/api/templates/${id}/assignments`, {
      client_token: clientToken,
    }),
  assignment: (id: number, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(`/api/assignments/${id}`, payload),
  employees: (payload: Record<string, unknown> = {}) =>
    unwrap<{
      employees: Array<{
        id: number;
        name: string;
        email: string;
        department: string;
        role: string;
        grade: string;
        branch: string;
        initials: string;
      }>;
      departments: Array<{ id: number; name: string }>;
      jobs: Array<{ id: number; name: string }>;
    }>("/api/templates-forms/employees", payload),
  startSubmission: (id: number) =>
    unwrap<Record<string, unknown>>(`/api/forms/${id}/submissions`),
  submission: (id: number, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(`/api/submissions/${id}`, payload),
  getDocument: (id: number, payload: Record<string, unknown> = {}) =>
    unwrap<Record<string, unknown>>(`/api/documents/${id}`, payload),
  autosave: (id: number, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(`/api/documents/${id}/autosave`, payload),
  comment: (id: number, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(`/api/documents/${id}/comments`, payload),
  ai: (id: number, payload: Record<string, unknown>) =>
    unwrap<Record<string, unknown>>(`/api/documents/${id}/ai-actions`, payload),
  exportLibrary: (query: LibraryQuery & { email?: string; format?: string }) =>
    unwrap<{ csv: string; html: string; download_url: string; count: number }>(
      "/api/templates-forms/export",
      query as unknown as Record<string, unknown>,
    ),
};
