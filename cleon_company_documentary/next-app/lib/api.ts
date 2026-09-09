import axios from "axios";
import type {
  AudienceOptions,
  DocumentaryAnalyticsDashboard,
  DocumentaryComment,
  DocumentaryFolder,
  DocumentaryMedia,
  DocumentarySettings,
  MediaFilters,
  RecycleBinData,
  Tag,
  UploadInit,
  User,
} from "./types";

interface JsonRpcResponse<T> {
  result?: T;
  error?: { message: string; data?: { message?: string } };
}

declare global {
  interface Window {
    __ODOO_USER__?: {
      user_id: number;
      user_name: string;
      user_email?: string;
      company_name?: string;
      is_admin?: boolean;
      is_document_manager?: boolean;
    };
  }
}

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ODOO_URL || "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

async function rpc<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await client.post<JsonRpcResponse<T>>(path, {
    jsonrpc: "2.0",
    method: "call",
    id: Date.now(),
    params,
  });
  if (response.data.error) {
    throw new Error(response.data.error.data?.message || response.data.error.message);
  }
  return response.data.result as T;
}

const unwrap = <D>(result: { success: boolean; message?: string; data?: D }): D => {
  if (!result.success) throw new Error(result.message || "The request could not be completed.");
  return result.data as D;
};

export const api = {
  injectedUser(): User | null {
    if (typeof window === "undefined" || !window.__ODOO_USER__) return null;
    const user = window.__ODOO_USER__;
    return {
      id: user.user_id,
      name: user.user_name,
      email: user.user_email || "",
      company_name: user.company_name,
      is_admin: user.is_admin,
      is_document_manager: user.is_document_manager,
    };
  },

  async me(): Promise<User | null> {
    const injected = api.injectedUser();
    if (injected) return injected;
    const result = await rpc<{ success: boolean; data: User; message?: string }>("/api/company-documentary/me");
    return result.success ? result.data : null;
  },

  async folders(params: { parent_id?: number; search?: string; include_archived?: boolean } = {}) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder[]; message?: string }>("/api/company-documentary/folders", params));
  },

  async media(params: { folder_id?: number; search?: string; include_archived?: boolean } & MediaFilters = {}) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia[]; message?: string }>("/api/company-documentary/media", params as Record<string, unknown>));
  },

  async createFolder(payload: { name: string; description?: string; parent_id?: number | false; access_scope?: string; department_ids?: number[]; grade_ids?: number[]; employee_ids?: number[]; editor_ids?: number[]; allow_download?: boolean }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder; message?: string }>("/api/company-documentary/folders/create", payload));
  },

  async updateFolder(payload: { id: number; name?: string; description?: string; parent_id?: number | false; access_scope?: string; department_ids?: number[]; grade_ids?: number[]; employee_ids?: number[]; editor_ids?: number[]; allow_download?: boolean }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder; message?: string }>("/api/company-documentary/folders/update", payload));
  },

  async folderAction(payload: { id: number; action: "archive" | "restore" | "delete" | "purge" }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder | { purged: boolean; id: number }; message?: string }>("/api/company-documentary/folders/action", payload));
  },

  async mediaAction(payload: { id: number; action: "favorite" | "archive" | "restore" | "delete" | "purge" }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia | { purged: boolean; id: number }; message?: string }>("/api/company-documentary/media/action", payload));
  },

  async updateMedia(payload: {
    id: number;
    name?: string;
    description?: string;
    mandatory?: boolean;
    completion_threshold?: number;
    comments_enabled?: boolean;
    download_policy?: "inherit" | "allow" | "deny";
    scope_mode?: "inherited" | "override";
    access_scope?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    tag_ids?: number[];
    transcript?: string;
    chapters?: Array<{ title: string; start_seconds: number }>;
    publish_at?: string | false;
    is_official?: boolean;
  }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia; message?: string }>("/api/company-documentary/media/update", payload));
  },

  async mediaBatchAction(payload: { ids: number[]; action: "favorite" | "archive" | "restore" | "delete" | "move" | "purge"; target_folder_id?: number }) {
    return unwrap(await rpc<{ success: boolean; data: { updated_ids: number[]; action: string }; message?: string }>("/api/company-documentary/media/batch-action", payload));
  },

  async mediaBatchUpdate(payload: {
    ids: number[];
    mandatory?: boolean;
    comments_enabled?: boolean;
    download_policy?: "inherit" | "allow" | "deny";
    scope_mode?: "inherited" | "override";
    access_scope?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    tag_ids?: number[];
  }) {
    return unwrap(await rpc<{ success: boolean; data: { updated_ids: number[] }; message?: string }>("/api/company-documentary/media/batch-update", payload));
  },

  async streamUrl(id: number, quality?: string) {
    return unwrap(await rpc<{ success: boolean; data: { url: string; quality?: string }; message?: string }>("/api/company-documentary/media/stream-url", { id, quality }));
  },

  async downloadUrl(id: number) {
    return unwrap(await rpc<{ success: boolean; data: { url: string }; message?: string }>("/api/company-documentary/media/download-url", { id }));
  },

  async tags(search = "") {
    return unwrap(await rpc<{ success: boolean; data: Tag[]; message?: string }>("/api/company-documentary/tags", { search }));
  },

  async createTag(name: string, color = 0) {
    return unwrap(await rpc<{ success: boolean; data: Tag; message?: string }>("/api/company-documentary/tags", { create: true, name, color }));
  },

  async audience(search = "") {
    return unwrap(await rpc<{ success: boolean; data: AudienceOptions; message?: string }>("/api/company-documentary/audience", { search }));
  },

  async comments(
    media_id: number,
    action: "list" | "create" | "delete" = "list",
    body?: string,
    comment_id?: number,
    parent_id?: number,
  ) {
    return unwrap(
      await rpc<{ success: boolean; data: DocumentaryComment[] | DocumentaryComment | { deleted: boolean }; message?: string }>(
        "/api/company-documentary/comments",
        { media_id, action, body, comment_id, parent_id },
      ),
    );
  },

  async likes(media_id: number, action: "toggle" | "status" = "toggle") {
    return unwrap(
      await rpc<{ success: boolean; data: { liked: boolean; like_count: number }; message?: string }>(
        "/api/company-documentary/likes",
        { media_id, action },
      ),
    );
  },

  async subtitle(media_id: number, payload: { name: string; language: string; format: "vtt" | "srt"; filename: string; mime_type: string }) {
    return unwrap(await rpc<{ success: boolean; data: { id: number; url: string; storage_key: string }; message?: string }>("/api/company-documentary/media/subtitles", { media_id, ...payload }));
  },

  async assetUrl(id: number, asset_type: "thumbnail" | "subtitle", filename: string, mime_type: string) {
    return unwrap(await rpc<{ success: boolean; data: { url: string; storage_key: string }; message?: string }>("/api/company-documentary/media/asset-url", { id, asset_type, filename, mime_type }));
  },

  async assetReadUrl(id: number, asset_type: "thumbnail" | "subtitle", subtitle_id?: number) {
    return unwrap(await rpc<{ success: boolean; data: { url: string }; message?: string }>("/api/company-documentary/media/asset-read-url", { id, asset_type, subtitle_id }));
  },

  async watchProgress(payload: { media_id: number; position_seconds: number; watched_seconds: number; completion_percent: number; completed?: boolean; session_id?: string; event_type?: "start" | "progress" | "complete"; delta_seconds?: number }) {
    return unwrap(await rpc<{ success: boolean; data: unknown; message?: string }>("/api/company-documentary/watch-progress", payload));
  },

  async continueWatching() {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia[]; message?: string }>("/api/company-documentary/continue-watching"));
  },

  async recycleBin() {
    return unwrap(await rpc<{ success: boolean; data: RecycleBinData; message?: string }>("/api/company-documentary/recycle-bin"));
  },

  async clearRecycleBin() {
    return unwrap(await rpc<{ success: boolean; data: { purged_count: number }; message?: string }>("/api/company-documentary/recycle-bin/clear"));
  },

  async settings() {
    return unwrap(await rpc<{ success: boolean; data: DocumentarySettings; message?: string }>("/api/company-documentary/settings"));
  },

  async saveSettings(values: Partial<DocumentarySettings>) {
    return unwrap(await rpc<{ success: boolean; data: DocumentarySettings; message?: string }>("/api/company-documentary/settings", { save: true, ...values }));
  },

  async pinFolder(payload: { id: number; pinned: boolean }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder; message?: string }>("/api/company-documentary/folders/pin", payload));
  },

  async favoriteFolder(payload: { id: number; favorite: boolean }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryFolder; message?: string }>("/api/company-documentary/folders/favorite", payload));
  },

  async mediaApproval(payload: { id: number; action: "approve" | "reject" | "submit" | "cancel_schedule"; comment?: string; publish_at?: string }) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia; message?: string }>("/api/company-documentary/media/approval", payload));
  },

  async mediaShare(id: number) {
    return unwrap(await rpc<{ success: boolean; data: { url: string; token: string }; message?: string }>("/api/company-documentary/media/share", { id }));
  },

  async captionEvent(media_id: number) {
    return unwrap(await rpc<{ success: boolean; data: { recorded: boolean }; message?: string }>("/api/company-documentary/media/caption-event", { media_id }));
  },

  async analytics(filters: { date_from?: string; date_to?: string; department_id?: number; folder_id?: number; media_id?: number } = {}) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryAnalyticsDashboard; message?: string }>("/api/company-documentary/analytics/summary", filters));
  },

  async storageConfig(check = false) {
    return unwrap(await rpc<{ success: boolean; data: { configured: boolean; reachable?: boolean; bucket?: string; endpoint_url?: string; credentials_present?: boolean; provider?: string; region?: string }; message?: string }>("/api/company-documentary/storage/config", { check }));
  },

  async initiateUpload(payload: {
    folder_id: number;
    filename: string;
    mime_type: string;
    file_size: number;
    title?: string;
    description?: string;
    mandatory?: boolean;
    completion_threshold?: number;
    comments_enabled?: boolean;
    scope_mode?: "inherited" | "override";
    access_scope?: string;
    department_ids?: number[];
    grade_ids?: number[];
    employee_ids?: number[];
    tag_ids?: number[];
    download_policy?: "inherit" | "allow" | "deny";
    publish_at?: string;
    is_official?: boolean;
    replaces_media_id?: number;
  }) {
    return unwrap(await rpc<{ success: boolean; data: UploadInit; message?: string }>("/api/company-documentary/uploads/initiate", payload));
  },

  async partUrl(upload_id: number, part_number: number) {
    return unwrap(await rpc<{ success: boolean; data: { url: string; part_number: number }; message?: string }>("/api/company-documentary/uploads/part-url", { upload_id, part_number }));
  },

  async completeUpload(upload_id: number, parts: Array<{ PartNumber: number; ETag: string }>) {
    return unwrap(await rpc<{ success: boolean; data: DocumentaryMedia; message?: string }>("/api/company-documentary/uploads/complete", { upload_id, parts }));
  },

  async abortUpload(upload_id: number) {
    return unwrap(await rpc<{ success: boolean; message?: string }>("/api/company-documentary/uploads/abort", { upload_id }));
  },

  async uploadSession(upload_id: number) {
    return unwrap(await rpc<{ success: boolean; data: { upload_id: number; media_id: number; state: string; part_size: number; total_parts: number; uploaded_parts: Array<{ PartNumber: number; ETag: string }> }; message?: string }>("/api/company-documentary/uploads/session", { upload_id }));
  },

  async recordUploadPart(upload_id: number, part: { PartNumber: number; ETag: string }) {
    return unwrap(await rpc<{ success: boolean; data: unknown; message?: string }>("/api/company-documentary/uploads/record-part", { upload_id, part_number: part.PartNumber, etag: part.ETag }));
  },
};
