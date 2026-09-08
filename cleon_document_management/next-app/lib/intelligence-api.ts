import { rpc } from "./api";

export interface IntelligenceDocumentType {
  id: number;
  name: string;
  description: string;
  category: string;
  intelligence_scope: "employee" | "organization";
  classification_labels: string;
  active: boolean;
  is_mandatory_default: boolean;
  default_retention_years: number;
  default_profile_id: number | false;
  default_profile: string;
}

export interface IntelligenceField {
  id?: number;
  name: string;
  key: string;
  field_type: string;
  required: boolean;
  description: string;
  example: string;
  sequence?: number;
  profile?: string;
  profile_version?: number;
}

export interface IntelligenceProfile {
  id: number;
  name: string;
  document_type_id: number;
  document_type: string;
  is_system: boolean;
  active: boolean;
  version: number;
  version_id: number | false;
  extraction_instructions: string;
  examples: string;
  fields: IntelligenceField[];
}

type RpcList<T> = { success: boolean; message?: string; data?: T };

async function unwrap<T>(path: string, params: Record<string, unknown> = {}) {
  const result = await rpc<RpcList<T>>(path, params);
  if (!result?.success) {
    throw new Error(result?.message || "Request failed");
  }
  return result.data as T;
}

export const intelligenceApi = {
  getDocumentTypes: (activeOnly = false) =>
    unwrap<IntelligenceDocumentType[]>(
      "/api/document-intelligence/document-types",
      { active_only: activeOnly },
    ),
  createDocumentType: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceDocumentType>(
      "/api/document-intelligence/document-types/create",
      payload,
    ),
  updateDocumentType: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceDocumentType>(
      "/api/document-intelligence/document-types/update",
      payload,
    ),
  getProfiles: (params: Record<string, unknown> = {}) =>
    unwrap<IntelligenceProfile[]>(
      "/api/document-intelligence/profiles",
      params,
    ),
  createProfile: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceProfile>(
      "/api/document-intelligence/profiles/create",
      payload,
    ),
  updateProfile: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceProfile>(
      "/api/document-intelligence/profiles/update",
      payload,
    ),
  archiveProfile: (id: number, active: boolean) =>
    unwrap<IntelligenceProfile>(
      "/api/document-intelligence/profiles/archive",
      { id, active },
    ),
  newProfileVersion: (id: number) =>
    unwrap<IntelligenceProfile>(
      "/api/document-intelligence/profiles/new-version",
      { id },
    ),
};

export interface IntelligenceJob {
  id: number;
  state: string;
  document_count: number;
  processed_count: number;
  progress: number;
  error_message: string;
  create_date: string;
  dataset_id?: number;
  dataset?: string;
  source?: string;
  owner_name?: string;
}

export interface IntelligenceDataset {
  id: number;
  name: string;
  source: string;
  processing_mode: string;
  scope_kind: string;
  scope_ids: number[];
  auto_classify: boolean;
  document_type_ids: number[];
  document_types: string[];
  field_keys: string[];
  field_count: number;
  confidence_preset: "relaxed" | "balanced" | "strict";
  auto_approve_threshold: number;
  review_below_threshold: number;
  ocr_fallback: boolean;
  deduplicate: boolean;
  masking: boolean;
  audit_logging: boolean;
  wizard_step: number;
  state: string;
  owner_id: number;
  owner_name: string;
  record_count: number;
  average_confidence: number;
  write_date: string;
  create_date: string;
  latest_job?: IntelligenceJob | false;
  run_queued?: boolean;
  message?: string;
}

export const intelligenceDatasetApi = {
  list: () =>
    unwrap<IntelligenceDataset[]>("/api/document-intelligence/datasets"),
  get: (id: number) =>
    unwrap<IntelligenceDataset>("/api/document-intelligence/datasets/get", {
      id,
    }),
  save: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceDataset>(
      "/api/document-intelligence/datasets/save",
      payload,
    ),
  run: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceDataset>(
      "/api/document-intelligence/datasets/run",
      payload,
    ),
  reviewQueue: (datasetId?: number) =>
    unwrap<IntelligenceExtractionRecord[]>(
      "/api/document-intelligence/review-queue",
      datasetId ? { dataset_id: datasetId } : {},
    ),
  approveRecord: (id: number, reason = "") =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/approve",
      { id, reason },
    ),
  rejectRecord: (id: number, reason: string) =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/reject",
      { id, reason },
    ),
  overrideRecord: (id: number, reason: string) =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/override",
      { id, reason },
    ),
  correctField: (payload: {
    id: number;
    field_key: string;
    value: string;
    reason: string;
  }) =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/correct",
      payload,
    ),
  resolveIssue: (payload: { id: number; issue_id: number; reason?: string }) =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/resolve-issue",
      payload,
    ),
  commentRecord: (id: number, comment: string) =>
    unwrap<IntelligenceExtractionRecord>(
      "/api/document-intelligence/records/comment",
      { id, comment },
    ),
  bulkApproveSafe: (ids?: number[]) =>
    unwrap<{ approved_count: number; ids: number[] }>(
      "/api/document-intelligence/records/bulk-approve",
      ids ? { ids } : {},
    ),
  ask: (question: string) =>
    unwrap<{
      answer: string;
      insufficient_evidence: boolean;
      model: string;
      citations: Array<{
        document_id: number;
        document: string;
        employee: string;
        page: number;
        field?: string;
        snippet: string;
      }>;
      fact_based?: boolean;
      intent?: string;
    }>("/api/document-intelligence/ask", { question }),
  settingsHealth: () =>
    unwrap<{
      groq_configured: boolean;
      pgvector: boolean;
      llm_model: string;
      vision_model: string;
      embedding_model: string;
      extraction: string;
    }>("/api/document-intelligence/settings/health"),
  overview: () =>
    unwrap<IntelligenceOverview>("/api/document-intelligence/overview"),
  pauseJob: (id: number) =>
    unwrap<IntelligenceJob>("/api/document-intelligence/jobs/pause", { id }),
  resumeJob: (id: number) =>
    unwrap<IntelligenceJob>("/api/document-intelligence/jobs/resume", { id }),
  retryJob: (id: number) =>
    unwrap<IntelligenceJob>("/api/document-intelligence/jobs/retry", { id }),
  auditLogs: (params: Record<string, unknown> = {}) =>
    unwrap<IntelligenceAuditEvent[]>(
      "/api/document-intelligence/audit-logs",
      params,
    ),
  askHistory: () =>
    unwrap<
      Array<{
        id: number;
        question: string;
        answer: string;
        create_date: string;
        user: string;
      }>
    >("/api/document-intelligence/ask/history"),
  conversations: (params: Record<string, unknown> = {}) =>
    unwrap<{
      indexed_count: number;
      conversations: IntelligenceConversation[];
    }>("/api/document-intelligence/conversations", params),
  conversationGet: (id: number) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/get",
      { id },
    ),
  conversationCreate: (payload: Record<string, unknown> = {}) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/create",
      payload,
    ),
  conversationSave: (id: number, saved: boolean) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/save",
      { id, saved },
    ),
  conversationUpdate: (payload: Record<string, unknown>) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/update",
      payload,
    ),
  conversationAsk: (payload: {
    id?: number;
    question: string;
    dataset_id?: number;
  }) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/ask",
      payload,
    ),
  conversationDelete: (id: number) =>
    unwrap<{ id: number }>("/api/document-intelligence/conversations/delete", {
      id,
    }),
  conversationAskStream: async (
    payload: { id?: number; question: string; dataset_id?: number },
    onEvent: (event: Record<string, unknown>) => void,
  ) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_ODOO_URL || ""}/api/document-intelligence/conversations/ask-stream`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok || !response.body) {
      throw new Error("The answer could not be streamed.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        onEvent(JSON.parse(line) as Record<string, unknown>);
      }
    }
    if (buffer.trim()) {
      onEvent(JSON.parse(buffer) as Record<string, unknown>);
    }
  },
  conversationAttachLibrary: (payload: { id?: number; document_id: number }) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/attach-library",
      payload,
    ),
  conversationAttachUrl: (payload: { id?: number; url: string }) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/attach-url",
      payload,
    ),
  conversationAttachUpload: (payload: {
    id?: number;
    name: string;
    mimetype: string;
    data: string;
  }) =>
    unwrap<IntelligenceConversation>(
      "/api/document-intelligence/conversations/attach-upload",
      payload,
    ),
  libraryDocuments: (search = "") =>
    unwrap<
      Array<{
        id: number;
        name: string;
        document_type: string;
        employee: string;
      }>
    >("/api/document-intelligence/library-documents", { search }),
};

export interface IntelligenceChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Array<{
    document_id: number;
    document: string;
    employee: string;
    page: number;
    field?: string;
    snippet: string;
  }>;
  intent: string;
  fact_based: boolean;
  model: string;
  insufficient_evidence: boolean;
  create_date: string;
}

export interface IntelligenceConversation {
  id: number;
  name: string;
  saved: boolean;
  dataset_id: number | false;
  dataset: string;
  write_date: string;
  preview: string;
  sources: Array<{
    id: number;
    kind: string;
    name: string;
    url: string;
    document_id: number;
  }>;
  messages?: IntelligenceChatMessage[];
}

export interface IntelligenceAuditEvent {
  id: number;
  user: string;
  company: string;
  category: string;
  action: string;
  target_model: string;
  target_id: number;
  target_name: string;
  detail: string;
  severity: string;
  correlation_id: string;
  before_value: string;
  after_value: string;
  create_date: string;
}

export interface IntelligenceOverview {
  queue_count: number;
  reviewed_count: number;
  approved_count: number;
  metrics: {
    extraction_accuracy: number | null;
    extraction_source: "none" | "reviewed";
    classification_accuracy: number | null;
    classification_source: "none" | "estimated";
    data_quality: number | null;
    data_quality_source: "none" | "approved";
  };
  jobs: IntelligenceJob[];
  attention: {
    failed: Array<{ id: number; dataset: string; reason: string }>;
    expiring: Array<{
      record_id: number;
      document: string;
      employee: string;
      date: string;
      field: string;
    }>;
    probation: Array<{
      record_id: number;
      document: string;
      employee: string;
      date: string;
    }>;
  };
}

export interface IntelligenceExtractionRecord {
  id: number;
  dataset_id: number;
  dataset: string;
  job_id: number;
  document_id: number;
  document_name: string;
  employee: string;
  document_type: string;
  review_status: string;
  validation_status: string;
  document_confidence: number;
  classification_confidence: number;
  used_ocr: boolean;
  text_source: string;
  extracted_text: string;
  preview_url: string;
  reviewer: string;
  reviewed_at: string;
  review_comment: string;
  fields: Array<{
    id?: number;
    key: string;
    name: string;
    value: string;
    confidence: number;
    citation: string;
    page?: number;
    required: boolean;
  }>;
  issues: Array<{
    id: number;
    field_key: string;
    severity: string;
    message: string;
    resolved: boolean;
  }>;
  review_actions: Array<{
    id: number;
    action: string;
    field_key: string;
    before_value: string;
    after_value: string;
    reason: string;
    comment: string;
    user: string;
    create_date: string;
  }>;
}
