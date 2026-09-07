export interface User {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  tz: string;
  is_admin?: boolean;
  is_document_manager?: boolean;
}

export interface DocFolder {
  id: number;
  folder_name: string;
  description: string;
  folder_type: "employee" | "organizational";
  owner_id: number;
  owner_name: string;
  document_count: number;
  last_modified: string;
  access_scope: string;
  is_locked: boolean;
  color: number;
  allow_download?: boolean;
  favorite?: boolean;
  acknowledged?: boolean;
  pinned?: boolean;
  locked?: boolean;
  active?: boolean;
  employee_ids?: number[];
  retention_period?: string;
  require_upload_approval?: boolean;
}

export interface DocDocument {
  id: number;
  name: string;
  description: string;
  folder_id: number;
  folder_name: string;
  employee_id: number | null;
  employee_name: string;
  document_type_id: number;
  document_type: string;
  state: "draft" | "processing" | "approved" | "rejected" | "expired" | "missing";
  approval_state: "not_required" | "pending" | "approved" | "rejected";
  ocr_state: "pending" | "processing" | "completed" | "failed";
  has_expiry: boolean;
  expiry_date: string | null;
  mime_type: string;
  file_size: number;
  attachment_id: number;
  created_at: string;
  write_date: string;
  allow_download?: boolean;
  active?: boolean;
  deleted_at?: string;
  recycle_bin_until?: string;
  favorite?: boolean;
  acknowledged?: boolean;
  pinned?: boolean;
  distribution_status?: "active" | "archived" | "deactivated";
}

export interface MyWorkspace {
  my_files: DocDocument[];
  shared_documents: DocDocument[];
  outstanding: DocDocument[];
  activity: { id: number; document_id: number; document: string; folder: string; event: string; occurred_at: string }[];
  dashboard: { total: number; expiring: number; states: Record<string, number> };
}

export interface AdminAttention {
  count: number;
  notifications: { id: number; document_id: number; employee_id?: number; document: string; employee: string; message: string; created_at: string }[];
  mailbox: { id: number; document_id: number; employee_id?: number; document: string; employee: string; message: string; created_at: string }[];
}

export interface QuickAccess { folders: DocFolder[]; documents: DocDocument[]; }

export interface DocumentType {
  id: number;
  name: string;
  category: string;
  is_mandatory_default: boolean;
  default_retention_years: number;
  active: boolean;
}

export interface ShareLink {
  id: number;
  token: string;
  permission: "viewer" | "editor";
  expiry_date: string;
  access_count: number;
  active: boolean;
  allow_download: boolean;
}

export interface CompliancePolicy {
  id: number;
  name: string;
  description: string;
  policy_type_id: number;
  policy_type: string;
  document_type_ids: number[];
  schedule: string;
  custom_schedule_days: number;
  applies_to: string;
  department_ids: number[];
  grade_ids: number[];
  employee_ids: number[];
  minimum_documents: number;
  grace_period_days: number;
  effective_date: string;
  active: boolean;
  evaluation_ids?: any[];
}

export interface ComplianceTargets {
  employees: {
    id: number;
    name: string;
    job_title: string;
    department: string;
    department_id: number | false;
    grade: string;
    grade_id: number | false;
    work_email: string;
    work_phone: string;
    location: string;
  }[];
  departments: { id: number; name: string }[];
  grades: { id: number; name: string }[];
}

export interface ComplianceException {
  id: number;
  employee_id: number;
  employee: string;
  policy_id: number;
  policy: string;
  reason: string;
  valid_until: string;
  status: string;
}

export interface ComplianceEvaluation {
  id: number;
  policy_id: number;
  policy: string;
  employee_id: number;
  employee: string;
  score: number;
  status: string;
  complete_count: number;
  missing_count: number;
  evaluated_at: string;
}

export interface DashboardStats {
  total_documents: number;
  total_folders: number;
  total_policies: number;
  total_exceptions: number;
  expiring_documents: number;
  pending_approvals: number;
}

export interface OdooRpcResult<T = any> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}
