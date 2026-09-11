export interface User {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  tz: string;
  is_admin?: boolean;
  is_document_manager?: boolean;
  is_document_admin?: boolean;
}

export interface ModuleRoleDefinition {
  id: number;
  role_key: "user" | "manager" | "admin";
  label: string;
  description: string;
  capabilities: string;
  assignable: boolean;
  group_id: number;
}

export interface ModuleRoleMember {
  employee_id: number;
  employee_name: string;
  department: string;
  job_title: string;
  user_id: number | false;
  user_name: string;
  user_login: string;
  has_login: boolean;
  roles: Partial<Record<"user" | "manager" | "admin", boolean>>;
}

export interface ModuleRoleAssignment {
  role_key: "manager" | "admin";
  enabled: boolean;
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
  department_ids?: number[];
  grade_ids?: number[];
  retention_period?: string;
  require_upload_approval?: boolean;
  approval_flow?: "sequential" | "random" | "any";
  approver_ids?: number[];
}

export interface UploadDuplicateMatch {
  filename: string;
  document_type_id: number;
  id: number;
  name: string;
  version_count?: number;
  latest_version_number?: number;
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
  approval_flow?: "sequential" | "random" | "any";
  can_review?: boolean;
  waiting_for_prior?: boolean;
  my_approval_state?: "pending" | "waiting" | "approved" | "rejected" | null;
  current_approver_id?: number | false;
  current_approver_name?: string | null;
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
  acknowledged_at?: string | false;
  pinned?: boolean;
  distribution_status?: "active" | "archived" | "deactivated";
  version_count?: number;
  current_version_number?: number;
}

export interface ExpiringDocument {
  id: number;
  name: string;
  document_type: string;
  expiry_date: string;
  folder_id: number;
  employee_id: number | false;
  folder_type: "employee" | "organizational";
}

export interface MyWorkspace {
  my_files: DocDocument[];
  shared_documents: DocDocument[];
  outstanding: DocDocument[];
  expiring_documents?: ExpiringDocument[];
  activity: { id: number; document_id: number; document: string; folder: string; event: string; occurred_at: string }[];
  dashboard: { total: number; expiring: number; states: Record<string, number> };
}

export interface AdminAttention {
  count: number;
  notifications: { id: number; document_id: number; employee_id?: number; document: string; employee: string; message: string; created_at: string }[];
}

export interface ApprovalInboxItem {
  id: number;
  approval_id: number;
  document_id: number;
  employee_id?: number;
  document: string;
  document_type: string;
  employee: string;
  folder_id: number;
  folder_type: "employee" | "organizational";
  sequence: number;
  state: "pending";
  message: string;
  created_at: string;
}

export interface ApprovalInbox {
  count: number;
  items: ApprovalInboxItem[];
}

export interface PendingEmployeeUpload {
  id: number;
  name: string;
  document_type: string;
  employee_id: number;
  employee_name: string;
  department: string;
  department_id?: number;
  approval_state: DocDocument["approval_state"];
  state: DocDocument["state"];
  status: "pending_review" | "awaiting_folder" | "awaiting_folder_restore";
  origin_folder_id?: number;
  origin_folder_name?: string;
  created_at: string;
}

export interface PendingEmployeeUploads {
  count: number;
  items: PendingEmployeeUpload[];
}

export interface MyPendingUpload {
  id: number;
  name: string;
  document_type: string;
  approval_state: DocDocument["approval_state"];
  state: DocDocument["state"];
  status: "pending_review" | "awaiting_folder" | "awaiting_folder_restore";
  status_label: string;
  origin_folder_name?: string;
  created_at: string;
}

export interface MyPendingUploads {
  count: number;
  items: MyPendingUpload[];
}

export interface MyComplianceEvaluation {
  id: number;
  policy_id: number;
  policy: string;
  policy_active: boolean;
  allow_waiver?: boolean;
  score: number;
  status: string;
  complete_count: number;
  missing_count: number;
  grace_count: number;
  evaluated_at: string;
  lines: Array<{
    id: number;
    requirement: string;
    document_type: string;
    status: string;
    required_count: number;
    matched_count: number;
  }>;
}

export interface MyCompliance {
  employee_id?: number;
  evaluations: MyComplianceEvaluation[];
  outstanding: Array<{
    policy: string;
    document_type: string;
    status: string;
  }>;
  summary: {
    compliant: number;
    partial: number;
    non_compliant: number;
    outstanding_count: number;
  };
}

export interface OnboardingState {
  show: boolean;
  dismissed: boolean;
  completed: boolean;
  completed_steps: string[];
  is_admin: boolean;
}

export interface QuickAccess { folders: DocFolder[]; documents: DocDocument[]; }

export interface DocumentType {
  id: number;
  name: string;
  category: string;
  description?: string;
  is_mandatory_default: boolean;
  default_retention_years: number;
  expiry_applicable?: boolean;
  active: boolean;
}

export interface DocumentVersion {
  id: number;
  version_number: number;
  uploaded_by: string;
  upload_date: string;
  change_note: string;
  file_size: number;
  mime_type: string;
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
  policy_type_code?: string;
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
  last_run_at: string;
  next_run_at: string;
  evaluation_ids?: any[];
  // Type-specific fields
  allow_waiver?: boolean;
  alert_schedule_days?: string;
  escalate_manager_days?: number;
  escalate_hr_days?: number;
  auto_request_renewal?: boolean;
  event_trigger?: string;
  due_days?: number;
  reminder_frequency_days?: number;
  assigned_reviewer_id?: number | false;
  assigned_reviewer?: string;
  audit_frequency?: string;
  sample_pct?: number;
  assigned_auditor_id?: number | false;
  assigned_auditor?: string;
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
  users?: { id: number; name: string; email: string }[];
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
  active: boolean;
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
  grace_count: number;
  evaluated_at: string;
  policy_active?: boolean;
  lines?: {
    id: number;
    requirement_id: number;
    requirement: string;
    document_type_id?: number;
    document_type?: string;
    document_ids: number[];
    required_count: number;
    matched_count: number;
    status: string;
  }[];
}

export interface ComplianceEvaluationRun {
  id: number;
  policy_id: number;
  policy: string;
  run_type: "manual" | "automatic";
  evaluated_at: string;
  employee_count: number;
  compliant_count: number;
  partial_count: number;
  non_compliant_count: number;
  excepted_count: number;
}

export interface WorkspaceActivityEvent {
  id: number;
  kind: "acknowledgement" | "approval" | "update" | "upload";
  message: string;
  document_id: number;
  document_name: string;
  folder_id: number;
  folder_name: string;
  folder_type: "employee" | "organizational";
  employee_id?: number | false;
  actor_name: string;
  occurred_at: string;
}

export interface WorkspaceAcknowledgement {
  id: number;
  document_id: number;
  document_name: string;
  folder_id: number;
  folder_name: string;
  employee_id?: number | false;
  employee_name: string;
  acknowledged_at: string;
}

export interface WorkspacePendingAcknowledgement {
  document_id: number;
  document_name: string;
  document_type: string;
  folder_id: number;
  folder_name: string;
  audience_count: number;
  acknowledged_count: number;
  pending_employees: { id: number; name: string; user_id: number }[];
}

export interface WorkspaceActivity {
  activity_log: WorkspaceActivityEvent[];
  recent_acknowledgements: WorkspaceAcknowledgement[];
  pending_acknowledgements: WorkspacePendingAcknowledgement[];
  summary: {
    activity_count: number;
    pending_acknowledgement_count: number;
    recent_acknowledgement_count: number;
  };
}

export interface DashboardStats {
  total_documents: number;
  total_folders: number;
  total_policies: number;
  total_exceptions: number;
  expiring_documents: number;
  expiring_items?: ExpiringDocument[];
  pending_approvals: number;
}

export interface OdooRpcResult<T = any> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}
