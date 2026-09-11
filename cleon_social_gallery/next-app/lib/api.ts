import axios from "axios";
import type {
  AuditLogEntry,
  DuplicateGroup,
  FlaggedReport,
  GalleryAlbum,
  GalleryComment,
  GalleryDashboard,
  GalleryMedia,
  GallerySettings,
  GalleryTag,
  LayoutMode,
  GalleryUserOption,
  TrustedUser,
  UploadHistoryEntry,
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
      is_gallery_manager?: boolean;
      is_gallery_admin?: boolean;
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
      is_gallery_manager: user.is_gallery_manager,
      is_gallery_admin: user.is_gallery_admin,
    };
  },

  async me(): Promise<User | null> {
    const injected = api.injectedUser();
    if (injected) return injected;
    const result = await rpc<{ success: boolean; data: User; message?: string }>("/api/social-gallery/me");
    return result.success ? result.data : null;
  },

  async albums(params: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: GalleryAlbum[]; message?: string }>("/api/social-gallery/albums", params));
  },

  async createAlbum(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GalleryAlbum; message?: string }>("/api/social-gallery/albums/create", payload));
  },

  async updateAlbum(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GalleryAlbum; message?: string }>("/api/social-gallery/albums/update", payload));
  },

  async albumAction(payload: { id: number; action: string }) {
    return unwrap(await rpc<{ success: boolean; data: GalleryAlbum; message?: string }>("/api/social-gallery/albums/action", payload));
  },

  async pinAlbum(payload: { id: number; pinned: boolean }) {
    return unwrap(await rpc<{ success: boolean; data: GalleryAlbum; message?: string }>("/api/social-gallery/albums/pin", payload));
  },

  async media(params: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/media", params));
  },

  async updateMedia(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia; message?: string }>("/api/social-gallery/media/update", payload));
  },

  async mediaAction(payload: { id: number; action: string }) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia; message?: string }>("/api/social-gallery/media/action", payload));
  },

  async mediaBatchAction(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: { count: number }; message?: string }>("/api/social-gallery/media/batch-action", payload));
  },

  async mediaApproval(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia; message?: string }>("/api/social-gallery/media/approval", payload));
  },

  async moveMedia(payload: { id: number; album_id: number }) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia; message?: string }>("/api/social-gallery/media/move", payload));
  },

  async reportMedia(payload: { id: number; reason: string; details?: string }) {
    return unwrap(await rpc<{ success: boolean; data: { id: number }; message?: string }>("/api/social-gallery/media/report", payload));
  },

  async similarMedia(id: number) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/media/similar", { id }));
  },

  async mediaVersions(id: number) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/media/versions", { id }));
  },

  async initiateUpload(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: UploadInit; message?: string }>("/api/social-gallery/uploads/initiate", payload));
  },

  async uploadPartUrl(payload: { session_id: number; part_number: number }) {
    return unwrap(await rpc<{ success: boolean; data: { url: string; part_number: number }; message?: string }>("/api/social-gallery/uploads/part-url", payload));
  },

  async recordUploadPart(payload: { session_id: number; part_number: number; etag: string }) {
    return unwrap(await rpc<{ success: boolean; data: { parts_recorded: number }; message?: string }>("/api/social-gallery/uploads/record-part", payload));
  },

  async completeUpload(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia & { duplicate_warning?: boolean; duplicate_id?: number }; message?: string }>("/api/social-gallery/uploads/complete", payload));
  },

  async abortUpload(session_id: number) {
    return unwrap(await rpc<{ success: boolean; data: { aborted: boolean }; message?: string }>("/api/social-gallery/uploads/abort", { session_id }));
  },

  async assetUrl(media_id: number, download = false) {
    return unwrap(await rpc<{ success: boolean; data: { url: string }; message?: string }>("/api/social-gallery/asset-url", { media_id, download }));
  },

  async thumbnailUrl(media_id: number) {
    return unwrap(await rpc<{ success: boolean; data: { url: string }; message?: string }>("/api/social-gallery/thumbnail-url", { media_id }));
  },

  async comments(media_id: number, action = "list", payload: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: GalleryComment[] | GalleryComment | { deleted: boolean }; message?: string }>("/api/social-gallery/comments", { media_id, action, ...payload }));
  },

  async likes(media_id: number, action = "toggle") {
    return unwrap(await rpc<{ success: boolean; data: { liked: boolean; like_count: number }; message?: string }>("/api/social-gallery/likes", { media_id, action }));
  },

  async share(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: { id: number; token: string; url: string }; message?: string }>("/api/social-gallery/share", payload));
  },

  async shareResolve(token: string, password?: string) {
    return unwrap(await rpc<{
      success: boolean;
      data: { type: "media"; media: GalleryMedia } | { type: "album"; album: GalleryAlbum; media: GalleryMedia[] };
      message?: string;
    }>("/api/social-gallery/share/resolve", { token, password }));
  },

  async pending() {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/pending"));
  },

  async pendingAi() {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/pending-ai"));
  },

  async flagged(action = "list", payload: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: FlaggedReport[] | { resolved: boolean }; message?: string }>("/api/social-gallery/flagged", { action, ...payload }));
  },

  async contributions(status = "") {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/contributions", { status }));
  },

  async uploadHistory() {
    return unwrap(await rpc<{ success: boolean; data: UploadHistoryEntry[]; message?: string }>("/api/social-gallery/upload-history"));
  },

  async recycleBin() {
    return unwrap(await rpc<{ success: boolean; data: GalleryMedia[]; message?: string }>("/api/social-gallery/recycle-bin"));
  },

  async recycleBinClear(ids: number[]) {
    return unwrap(await rpc<{ success: boolean; data: { purged: number }; message?: string }>("/api/social-gallery/recycle-bin/clear", { ids }));
  },

  async audit(params: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: AuditLogEntry[]; message?: string }>("/api/social-gallery/audit", params));
  },

  async settings(payload: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: GallerySettings; message?: string }>("/api/social-gallery/settings", payload));
  },

  async saveSettings(payload: Record<string, unknown>) {
    return unwrap(await rpc<{ success: boolean; data: GallerySettings; message?: string }>("/api/social-gallery/settings", { ...payload, save: true }));
  },

  async trustedUsers(action = "list", payload: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: TrustedUser[] | { id: number } | { removed: boolean }; message?: string }>("/api/social-gallery/trusted-users", { action, ...payload }));
  },

  async searchUsers(search = "", limit = 20) {
    return unwrap(await rpc<{ success: boolean; data: GalleryUserOption[]; message?: string }>("/api/social-gallery/users/search", { search, limit }));
  },

  async tags(action = "list", payload: Record<string, unknown> = {}) {
    return unwrap(await rpc<{ success: boolean; data: GalleryTag[] | GalleryTag; message?: string }>("/api/social-gallery/tags", { action, ...payload }));
  },

  async duplicateScan() {
    return unwrap(await rpc<{ success: boolean; data: DuplicateGroup[]; message?: string }>("/api/social-gallery/duplicates/scan"));
  },

  async duplicateAction(ids: number[], action = "delete") {
    return unwrap(await rpc<{ success: boolean; data: { count: number }; message?: string }>("/api/social-gallery/duplicates/action", { ids, action }));
  },

  async dashboard() {
    return unwrap(await rpc<{ success: boolean; data: GalleryDashboard; message?: string }>("/api/social-gallery/analytics/dashboard"));
  },

  async exportBrand(album_ids: number[]) {
    return unwrap(await rpc<{ success: boolean; data: Record<string, unknown>; message?: string }>("/api/social-gallery/export/brand", { album_ids }));
  },

  async storageConfig(check = false) {
    return unwrap(await rpc<{ success: boolean; data: { configured: boolean; reachable?: boolean; bucket?: string; endpoint_url?: string; credentials_present?: boolean; provider?: string; region?: string }; message?: string }>("/api/social-gallery/storage/config", { check }));
  },
};

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(value: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
