import { rpc } from "./api";

export type ApprovalWorkflowExceptionRow = {
  id: number;
  scope: "folder" | "category";
  folder_id: number | false;
  category_id: number | false;
  approver_mode: string;
  role_id: number | false;
  user_ids: number[];
  applies_to_label?: string;
  who_approves_label?: string;
};

export type ApprovalWorkflowSettings = {
  require_approval: boolean;
  default_approver_mode: string;
  default_role_id: number | false;
  default_user_ids: number[];
  respond_working_days: number;
  fallback_mode: string;
  fallback_role_id: number | false;
  fallback_user_ids: number[];
  exceptions: ApprovalWorkflowExceptionRow[];
  options: {
    roles: { id: number; name: string }[];
    users: { id: number; name: string; email?: string }[];
    folders: { id: number; name: string; path?: string }[];
    categories: { id: number; name: string }[];
  };
};

export type DmsSettingsRead = {
  version: string;
  general: Record<string, unknown>;
  approval_workflow: ApprovalWorkflowSettings;
  files_and_uploads: Record<string, unknown>;
  document_types: unknown[];
  retention_summary: Record<string, unknown>;
  notification_rules: NotificationRuleRow[];
  modules: Record<string, boolean>;
  registry_index: Record<string, number>;
};

export type NotificationRuleRow = {
  id: number;
  name: string;
  event_type: string;
  event_label: string;
  module: string;
  who_is_told: string;
  active: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  required: boolean;
  timing: string;
  preference_group: string;
  compliance_read_only: boolean;
  recipient_mode: string;
  user_ids: number[];
  sequence: number;
};

export type NotificationInboxItem = {
  id: number;
  title: string;
  body: string;
  event_type: string;
  href: string;
  read_at: string | false;
  created_at: string;
};

export const dmsContractsApi = {
  settingsRead: () =>
    rpc<{ success: boolean; data: DmsSettingsRead }>("/api/dms/settings/read", {}),

  registrySearch: (query: string, filters?: Record<string, unknown>, page = 1) =>
    rpc<{ success: boolean; data: { items: unknown[]; total: number } }>(
      "/api/dms/registry/search",
      { query, filters: filters || {}, page, page_size: 25 },
    ),

  registryIndexStatus: () =>
    rpc<{ success: boolean; data: Record<string, number> }>(
      "/api/dms/registry/index-status",
      {},
    ),

  registryReindex: (module?: string) =>
    rpc<{ success: boolean; data: { synced: number } }>(
      "/api/dms/registry/reindex",
      module ? { module } : {},
    ),

  auditQuery: (filters?: Record<string, unknown>, page = 1, pageSize = 50) =>
    rpc<{
      success: boolean;
      message?: string;
      data: { items: unknown[]; total: number; page: number; page_size: number };
    }>("/api/dms/audit/query", {
      filters: filters || {},
      page,
      page_size: pageSize,
    }),

  auditMeta: () =>
    rpc<{
      success: boolean;
      data: {
        allowed: boolean;
        can_export?: boolean;
        modules?: { value: string; label: string }[];
        timezone?: string;
      };
    }>("/api/dms/audit/meta", {}),

  auditMetrics: (filters?: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      message?: string;
      data: {
        events_in_period?: number;
        access_denied?: number;
        access_denied_people?: number;
        settings_changes?: number;
        exports?: number;
      };
    }>("/api/dms/audit/metrics", { filters: filters || {} }),

  auditExport: (filters?: Record<string, unknown>) =>
    rpc<{
      success: boolean;
      message?: string;
      data: {
        async?: boolean;
        job_id?: number;
        filename?: string;
        content?: string;
        row_count?: number;
        message?: string;
      };
    }>("/api/dms/audit/export", { filters: filters || {} }),

  auditExportJob: (jobId: number) =>
    rpc<{
      success: boolean;
      message?: string;
      data: {
        id: number;
        state: string;
        row_count: number;
        filename: string;
        error_message?: string;
        download_ready?: boolean;
        content?: string;
      };
    }>("/api/dms/audit/export-job", { job_id: jobId }),

  auditLogView: (documentId: number, source = "search_result") =>
    rpc<{ success: boolean; message?: string }>("/api/dms/audit/log-view", {
      document_id: documentId,
      source,
    }),

  auditEvent: (id: number) =>
    rpc<{ success: boolean; data: Record<string, unknown> }>(
      "/api/dms/audit/event",
      { id },
    ),

  workItems: (search = "") =>
    rpc<{
      success: boolean;
      data: import("./workspaceWorkItems").WorkspaceWorkItemsPayload;
    }>("/api/dms/work-items", { search }),

  notificationInbox: (limit = 50, tab: "all" | "unread" = "all") =>
    rpc<{
      success: boolean;
      data: { items: NotificationInboxItem[]; unread_count: number; tab: string };
    }>("/api/dms/notifications/inbox", { limit, tab }),

  notificationMarkRead: (ids: number[], all = false) =>
    rpc<{ success: boolean }>("/api/dms/notifications/mark-read", {
      ids,
      all,
    }),

  notificationOpen: (id: number) =>
    rpc<{
      success: boolean;
      data: { permission_denied?: boolean; href?: string; message?: string };
    }>("/api/dms/notifications/open", { id }),

  notificationPreferences: (save?: {
    digest_enabled?: boolean;
    groups?: Record<string, boolean>;
  }) =>
    rpc<{
      success: boolean;
      data: {
        digest_enabled: boolean;
        groups: {
          code: string;
          label: string;
          email_enabled: boolean;
          locked: boolean;
        }[];
      };
    }>("/api/dms/notifications/preferences", save ? { save: true, ...save } : {}),

  notificationRulesSave: (rules: Partial<NotificationRuleRow>[]) =>
    rpc<{ success: boolean; updated?: number }>(
      "/api/dms/notification-rules/save",
      { rules },
    ),

  notificationDeliveryLog: (page = 1) =>
    rpc<{
      success: boolean;
      data: { items: unknown[]; total: number; page: number };
    }>("/api/dms/notifications/delivery-log", { page, page_size: 50 }),

  generalTestEmail: (toEmail?: string) =>
    rpc<{ success: boolean; message?: string }>("/api/dms/general/test-email", {
      to_email: toEmail,
    }),

  approvalWorkflowSave: (payload: Record<string, unknown> | { enabled: boolean }) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: ApprovalWorkflowSettings;
    }>("/api/dms/approval-workflow/save", payload),

  generalSave: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; message?: string }>("/api/dms/general/save", payload),

  tenantModulesSave: (modules: Record<string, boolean>) =>
    rpc<{
      success: boolean;
      message?: string;
      data?: { modules: Record<string, boolean>; notes: string[] };
    }>("/api/dms/modules/save", { modules }),

  generalHolidaysList: (year: number) =>
    rpc<{ success: boolean; message?: string; year?: number; holidays?: unknown[] }>(
      "/api/dms/general/holidays/list",
      { year },
    ),

  generalHolidaySave: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean; message?: string; holidays?: unknown[] }>(
      "/api/dms/general/holiday/save",
      payload,
    ),

  generalHolidayDelete: (payload: { id: number }) =>
    rpc<{ success: boolean; message?: string; holidays?: unknown[] }>(
      "/api/dms/general/holiday/delete",
      payload,
    ),

  generalHolidaysCopyLastYear: (payload: { year: number }) =>
    rpc<{ success: boolean; message?: string; holidays?: unknown[] }>(
      "/api/dms/general/holidays/copy-last-year",
      payload,
    ),
};
