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
};

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
  preview_url: string;
  fields: Array<{
    key: string;
    name: string;
    value: string;
    confidence: number;
    citation: string;
    required: boolean;
  }>;
  issues: Array<{
    id: number;
    field_key: string;
    severity: string;
    message: string;
    resolved: boolean;
  }>;
}
