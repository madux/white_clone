import { rpc } from "./api";

export type DmsSettingsRead = {
  version: string;
  general: Record<string, unknown>;
  approval_workflow: Record<string, unknown>;
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

  auditQuery: (filters?: Record<string, unknown>, page = 1) =>
    rpc<{ success: boolean; data: { items: unknown[]; total: number } }>(
      "/api/dms/audit/query",
      { filters: filters || {}, page, page_size: 50 },
    ),

  auditEvent: (id: number) =>
    rpc<{ success: boolean; data: Record<string, unknown> }>(
      "/api/dms/audit/event",
      { id },
    ),

  workItems: () =>
    rpc<{
      success: boolean;
      data: { items: unknown[]; total: number; source?: string };
    }>("/api/dms/work-items", {}),

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

  approvalWorkflowSave: (enabled: boolean) =>
    rpc<{ success: boolean }>("/api/dms/approval-workflow/save", { enabled }),

  generalSave: (payload: Record<string, unknown>) =>
    rpc<{ success: boolean }>("/api/dms/general/save", payload),
};
