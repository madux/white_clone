export interface User {
  id: number;
  name: string;
  email: string;
  company_name?: string;
  is_admin?: boolean;
  is_document_manager?: boolean;
}

export interface WatchProgress {
  position_seconds: number;
  completion_percent: number;
  completed: boolean;
  last_watched_at?: string;
}

export interface DocumentaryFolder {
  id: number;
  name: string;
  description: string;
  parent_id: number | false;
  access_scope: "company" | "department" | "grade" | "employee";
  allow_download: boolean;
  archived: boolean;
  deleted_at: string | false;
  media_count: number;
  can_edit: boolean;
  is_pinned?: boolean;
  department_ids?: number[];
  grade_ids?: number[];
  employee_ids?: number[];
  editor_ids?: number[];
}

export interface DocumentaryChapter {
  title: string;
  start_seconds: number;
}

export interface DocumentaryMedia {
  id: number;
  title: string;
  description: string;
  folder_id: number;
  folder_name: string;
  owner_id: number;
  original_filename: string;
  mime_type: string;
  file_size: number;
  duration_seconds: number;
  processing_state: "uploading" | "processing" | "ready" | "failed";
  processing_error: string;
  deleted_at: string | false;
  thumbnail_available: boolean;
  variants: Record<string, string>;
  tag_ids: number[];
  tags: string[];
  download_allowed: boolean;
  mandatory: boolean;
  completion_threshold: number;
  comments_enabled: boolean;
  scope_mode: "inherited" | "override";
  access_scope: "company" | "department" | "grade" | "employee";
  department_ids?: number[];
  grade_ids?: number[];
  employee_ids?: number[];
  favorite: boolean;
  view_count: number;
  unique_viewer_count: number;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  subtitles?: DocumentarySubtitle[];
  approval_status?: "draft" | "pending" | "approved" | "rejected" | "scheduled";
  publish_at?: string | false;
  published_at?: string | false;
  transcript?: string;
  chapters?: DocumentaryChapter[];
  share_token?: string | false;
  is_official?: boolean;
  replaces_media_id?: number | false;
  approver_comment?: string;
  approved_by_name?: string | false;
  approved_at?: string | false;
  purge_date?: string | false;
  watch_progress?: WatchProgress | null;
}

export interface DocumentarySubtitle {
  id: number;
  name: string;
  language: string;
  format: "vtt" | "srt";
  is_default: boolean;
}

export interface DocumentaryComment {
  id: number;
  body: string;
  user_id: number;
  user_name: string;
  created_at: string;
  mentioned_user_ids?: number[];
  mentioned_names?: string[];
}

export interface AudienceOptions {
  departments: { id: number; name: string }[];
  grades: { id: number; name: string }[];
  employees: {
    id: number;
    name: string;
    email: string;
    department_id: number | false;
    department: string;
    grade_id: number | false;
    grade: string;
  }[];
}

export interface DocumentarySettings {
  require_upload_approval: boolean;
  default_mandatory: boolean;
  default_comments_enabled: boolean;
  default_allow_download: boolean;
  default_completion_threshold: number;
  deleted_retention_days: number;
  auto_transcription: boolean;
}

export interface RecycleBinData {
  media: DocumentaryMedia[];
  folders: DocumentaryFolder[];
}

export interface MediaFilters {
  mandatory?: boolean;
  processing_state?: string;
  approval_status?: string;
  date_from?: string;
  date_to?: string;
  recycle_bin?: boolean;
}

export interface DocumentaryAnalytics {
  media_id?: number;
  video_count?: number;
  total_views?: number;
  unique_viewers?: number;
  average_completion_percent?: number;
  completed_viewers?: number;
  mandatory_video_count?: number;
  completion_rate?: number;
}

export interface DocumentaryAnalyticsDashboard {
  period: { from: string; to: string };
  overview: {
    total_views: number;
    unique_viewers: number;
    eligible_employees: number;
    viewer_rate: number;
    total_watch_seconds: number;
    average_watch_seconds: number;
    median_watch_seconds: number;
    completion_rate: number;
    average_completion: number;
    engagement_rate: number;
    mandatory_assignments: number;
    mandatory_completed: number;
    compliance_rate: number;
  };
  views_over_time: { date: string; views: number; unique_viewers: number; watch_seconds: number; average_completion: number }[];
  engagement_over_time: { date: string; views: number; unique_viewers: number; watch_seconds: number; average_completion: number }[];
  department_chart: { name: string; views: number; viewer_rate: number; completion: number }[];
  departments: {
    id: number | false;
    name: string;
    eligible_employees: number;
    unique_viewers: number;
    viewer_rate: number;
    total_views: number;
    average_watch_seconds: number;
    average_completion: number;
    performance_score: number;
    performance: string;
  }[];
  engagement_distribution: { strong: number; developing: number; at_risk: number };
  content_performance: { id: number; title: string; folder_name: string; mandatory: boolean; total_views: number; unique_viewers: number; watch_seconds: number; average_completion: number; completion_rate: number }[];
  trends: { period_change_percent: number; rising: DocumentaryAnalyticsDashboard["content_performance"]; declining: DocumentaryAnalyticsDashboard["content_performance"]; at_risk: DocumentaryAnalyticsDashboard["content_performance"] };
  caption_usage?: { events: number; unique_viewers: number; usage_rate: number };
  completion_bands?: { under_25: number; between_25_75: number; over_75: number };
  recent_viewers?: { user_name: string; employee_name: string; media_title: string; happened_at: string }[];
  approval_compliance?: { pending_count: number; approved_count: number };
}

export interface Tag {
  id: number;
  name: string;
  color: number;
}

export interface UploadInit {
  media: DocumentaryMedia;
  upload_id: number;
  provider: string;
  part_size: number;
  total_parts: number;
  expires_at: string;
}
