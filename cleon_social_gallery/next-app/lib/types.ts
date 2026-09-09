export type GalleryView =
  | "dashboard"
  | "albums"
  | "gallery"
  | "pending"
  | "pending-ai"
  | "flagged"
  | "recycle"
  | "contributions"
  | "upload-history"
  | "duplicates"
  | "audit"
  | "settings";

export type LayoutMode = "grid" | "list" | "masonry";

export interface User {
  id: number;
  name: string;
  email: string;
  company_name?: string;
  is_admin?: boolean;
  is_gallery_manager?: boolean;
  is_gallery_admin?: boolean;
}

export interface GalleryAlbum {
  id: number;
  name: string;
  description: string;
  company_id: number;
  created_by: number;
  created_by_name: string;
  cover_available: boolean;
  preview_media_id?: number | false;
  preview_media_type?: "image" | "video" | false;
  visibility: "public" | "private";
  access_scope: string;
  department_ids: number[];
  branch_ids: number[];
  employee_ids: number[];
  status: string;
  is_pinned: boolean;
  event_name: string;
  media_count: number;
  photo_count: number;
  video_count: number;
  total_size: number;
  create_date: string;
  can_edit: boolean;
}

export interface GalleryMedia {
  id: number;
  display_name: string;
  description: string;
  album_id: number | false;
  album_name: string;
  media_type: "image" | "video";
  uploaded_by: number;
  uploaded_by_name: string;
  department_id: number | false;
  branch_id: number | false;
  file_name: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  accessible_description: string;
  tag_ids: number[];
  tags: string[];
  approval_status: string;
  approver_comment: string;
  ai_review_status: string;
  ai_moderation_flags: string[];
  ai_moderation_note: string;
  deleted_at: string | false;
  purge_date: string | false;
  is_pinned: boolean;
  comments_enabled: boolean;
  share_token: string;
  replaces_media_id: number | false;
  version: number;
  edit_metadata: Record<string, unknown>;
  view_count: number;
  download_count: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  thumbnail_available: boolean;
  create_date: string;
  can_edit: boolean;
  can_moderate: boolean;
}

export interface GalleryComment {
  id: number;
  media_id: number;
  user_id: number;
  user_name: string;
  body: string;
  parent_id: number | false;
  mentioned_user_ids: number[];
  is_hidden: boolean;
  is_edited: boolean;
  create_date: string;
  replies: GalleryComment[];
}

export interface GallerySettings {
  default_visibility: string;
  default_destination_album_id: number | false;
  auto_approve_trusted: boolean;
  auto_create_monthly_album: boolean;
  max_upload_mb: number;
  default_layout: LayoutMode;
  theme_color: string;
  deleted_retention_days: number;
  notify_new_upload: boolean;
  notify_approval_request: boolean;
  notify_comments: boolean;
  notify_likes: boolean;
  like_batch_size: number;
  weekly_digest: boolean;
  allow_external_share: boolean;
  ai_moderation_enabled: boolean;
}

export interface DashboardAlbum extends GalleryAlbum {
  preview_media_id?: number | false;
}

export interface DashboardActivity {
  event_type: string;
  entity_type: string;
  user_name: string;
  details: string;
  album_id?: number | false;
  media_id?: number | false;
  create_date: string;
}

export interface DepartmentEngagement {
  department: string;
  uploads: number;
  likes: number;
  comments: number;
  engagement_score: number;
  rank: number;
  score_share: number;
  gap_to_leader: number;
  is_user_department?: boolean;
}

export interface GalleryDashboard {
  total_albums: number;
  total_media: number;
  photo_count: number;
  video_count: number;
  storage_used: number;
  today_uploads: number;
  week_uploads: number;
  pending_approvals: number;
  total_likes: number;
  total_comments: number;
  total_views: number;
  upload_trend: Array<{ date: string; label: string; count: number }>;
  user_department?: string | false;
  leaderboard_period?: string;
  department_engagement: DepartmentEngagement[];
  top_contributors: Array<{ name: string; uploads: number }>;
  recent_albums: DashboardAlbum[];
  trending_media: GalleryMedia[];
  recent_media: GalleryMedia[];
  recent_activity: DashboardActivity[];
}

export interface UploadInit {
  session_id: number;
  object_key: string;
  upload_id: string;
  part_size: number;
  part_count: number;
}

export interface GalleryTag {
  id: number;
  name: string;
  color: string;
}

export interface FlaggedReport {
  id: number;
  media_id: number;
  media: GalleryMedia;
  reason: string;
  details: string;
  reporter_name: string;
  create_date: string;
}

export interface AuditLogEntry {
  id: number;
  event_type: string;
  entity_type: string;
  album_id: number | false;
  media_id: number | false;
  user_name: string;
  details: string;
  create_date: string;
}

export interface UploadHistoryEntry {
  id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: string;
  error_message: string;
  media_id: number | false;
  create_date: string;
}

export interface DuplicateGroup {
  checksum: string;
  count: number;
  items: GalleryMedia[];
}

export interface TrustedUser {
  id: number;
  user_id: number;
  user_name: string;
  notes: string;
}

export interface GalleryUserOption {
  id: number;
  name: string;
  email: string;
}
