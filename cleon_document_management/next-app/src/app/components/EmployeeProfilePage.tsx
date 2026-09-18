"use client";

import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  FilePlus2,
  FileText,
  Upload,
  XCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useComplianceTargets,
  useCurrentUser,
  useDocumentTypes,
  useEvaluations,
  useReviewDocument,
  useUploadEmployeeDocument,
} from "../../../hooks/useDocuments";
import BulkDocumentActions from "./BulkDocumentActions";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import DocumentFilterBar, { FilterState, INITIAL_FILTER_STATE, applyDocumentFilters } from "./DocumentFilterBar";
import DocumentViewerDialog from "./DocumentViewerDialog";
import DocumentRelationsPanel from "./DocumentRelationsPanel";
import { documentPreviewUrl } from "../../../lib/documentPreviewUrls";
import BackButton from "./BackButton";
import EmployeeProfileDocumentTree from "./EmployeeProfileDocumentTree";
import UpdateDocumentModal from "./UpdateDocumentModal";
import type { DocDocument } from "../../../lib/types";
import { typeRequiresExpiry } from "./uploadExpiryHelpers";
import {
  firstUploadMetadataError,
  missingUploadMetadata,
  typeRequiresDescription,
  typeRequiresIssueDate,
} from "../../../lib/uploadMetadataHelpers";
import EmployeeUploadWizard from "./EmployeeUploadWizard";
import UploadConflictDialog from "./UploadConflictDialog";
import {
  buildAllowSeparateDuplicates,
  buildReplaceDocumentIdsFromConflicts,
  buildVersionChangeNotesFromConflicts,
  findUploadConflictsByFileIndex,
  hasResolvableConflicts,
  preventConflictMessage,
} from "../../../lib/uploadConflictHelpers";
import type { UploadConflict } from "../../../lib/types";
import { canReviewDocument } from "../../../lib/approvalHelpers";
import { groupEmployeeDocuments } from "../../../lib/groupEmployeeDocuments";
import SectionTabs from "./SectionTabs";
import {
  useEmployeeFileActivity,
  useEmployeeFileDocuments,
  useEmployeeFileSummary,
  useEmployeeFilesConfig,
  useRemoveEmployeeFilesFromGroup,
} from "../../../hooks/useEmployeeFiles";
import {
  buildProfileHeaderFields,
  EMS_HEADER_READ_ONLY_NOTE,
  normalizeHeaderFieldKeys,
} from "../../../lib/employeeFileHeaderFields";
import { documentViewHref } from "../../../lib/documentLinks";
import type { WorkspaceActivityEvent } from "../../../lib/types";

export default function EmployeeProfilePage() {
  const params = useSearchParams();
  const router = useRouter();
  const employeeId = Number(params.get("employee"));
  const queryClient = useQueryClient();
  const fileDocuments = useEmployeeFileDocuments(employeeId);
  const fileActivity = useEmployeeFileActivity(employeeId);
  const complianceEvaluations = useEvaluations(employeeId || undefined);
  const targets = useComplianceTargets();
  const currentUser = useCurrentUser();
  const review = useReviewDocument();
  const availableDocumentTypes = useDocumentTypes();
  const uploadEmployeeDocument = useUploadEmployeeDocument();
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [viewing, setViewing] = useState<any>(null);
  const [viewingVersionId, setViewingVersionId] = useState<number | null>(null);
  const [updatingDocument, setUpdatingDocument] = useState<DocDocument | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [profileTab, setProfileTab] = useState<
    "overview" | "documents" | "compliance" | "activity" | "groups"
  >("documents");
  const [reviewError, setReviewError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadConflictWarning, setUploadConflictWarning] = useState<{
    conflicts: UploadConflict[];
    perFile: Array<UploadConflict | null>;
    proceedUpdate: () => Promise<void>;
    proceedSeparate: () => Promise<void>;
  } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTypes, setUploadTypes] = useState<string[]>([]);
  const [uploadExpiryDates, setUploadExpiryDates] = useState<string[]>([]);
  const [uploadIssueDates, setUploadIssueDates] = useState<string[]>([]);
  const [uploadDescriptions, setUploadDescriptions] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"wizard" | "bulk">("wizard");
  const [bulkUploadType, setBulkUploadType] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [removingGroupId, setRemovingGroupId] = useState<number | null>(null);
  const employeeDocuments = useMemo(
    () => fileDocuments.data ?? [],
    [fileDocuments.data],
  );
  const employeeRecord = targets.data?.employees.find(
    (item) => item.id === employeeId,
  );
  const employeeFileSummary = useEmployeeFileSummary(employeeId);
  const employeeFilesConfig = useEmployeeFilesConfig();
  const headerFields = useMemo(() => {
    const fromSummary = employeeFileSummary.data?.header_fields;
    if (fromSummary?.length) return fromSummary;
    const keys = normalizeHeaderFieldKeys(
      employeeFilesConfig.data?.header_field_keys,
    );
    if (!keys.length) return [];
    return buildProfileHeaderFields(
      keys,
      employeeId,
      employeeRecord,
      employeeFileSummary.data,
      employeeFilesConfig.data?.available_header_fields,
    );
  }, [
    employeeFileSummary.data,
    employeeFilesConfig.data,
    employeeId,
    employeeRecord,
  ]);
  const emsReadOnlyNote =
    employeeFileSummary.data?.ems_read_only_note ?? EMS_HEADER_READ_ONLY_NOTE;
  const removeFromGroup = useRemoveEmployeeFilesFromGroup();
  const relatedGroups = useMemo(() => {
    const seen = new Set<number>();
    return (employeeFileSummary.data?.related_groups ?? []).filter((group) => {
      if (!group?.id || seen.has(group.id)) return false;
      seen.add(group.id);
      return true;
    });
  }, [employeeFileSummary.data?.related_groups]);
  const employeeFileId = employeeFileSummary.data?.id;
  const isDocumentManager =
    currentUser.data?.is_document_manager === true ||
    currentUser.data?.employee_files_permissions?.can_access_ef_home === true;
  const canReviewEmployeeDocuments =
    currentUser.data?.employee_files_permissions?.can_approve === true ||
    currentUser.data?.is_document_manager === true ||
    currentUser.data?.is_document_admin === true;
  const approved = employeeDocuments.filter(
    (document) => document.approval_state === "approved",
  ).length;
  const currentEvaluations = (complianceEvaluations.data ?? []).filter(
    (evaluation) => evaluation.policy_active !== false,
  );
  const complianceScore = currentEvaluations.length
    ? Math.round(currentEvaluations.reduce((total, evaluation) => total + evaluation.score, 0) / currentEvaluations.length)
    : null;
  const complianceState = currentEvaluations.some((item) => item.status === "non_compliant")
    ? "Needs attention"
    : currentEvaluations.some((item) => item.status === "grace" || item.status === "partial")
      ? "In progress"
      : currentEvaluations.length
        ? "Complete"
        : "No evaluations";
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [expandedDocuments, setExpandedDocuments] = useState<number[]>([]);
  const documentTypes = [
    ...new Set(employeeDocuments.map((document) => document.document_type)),
  ];
  const filteredEmployeeDocuments = useMemo(
    () => applyDocumentFilters(employeeDocuments, filters),
    [employeeDocuments, filters]
  );
  const groupedEmployeeDocuments = useMemo(
    () => groupEmployeeDocuments(filteredEmployeeDocuments),
    [filteredEmployeeDocuments],
  );
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    if (autoExpandedRef.current || !groupedEmployeeDocuments.length) return;
    const expandable = groupedEmployeeDocuments
      .filter((group) => group.historyCount > 0)
      .map((group) => group.primary.id);
    if (expandable.length) {
      setExpandedDocuments(expandable);
      autoExpandedRef.current = true;
    }
  }, [groupedEmployeeDocuments]);

  useEffect(() => {
    const docId = Number(params.get("doc") || 0);
    if (!docId || !employeeDocuments.length) return;
    const match = employeeDocuments.find((document) => document.id === docId);
    if (match) setViewing(match);
  }, [employeeDocuments, params]);
  const visibleIds = groupedEmployeeDocuments.map((group) => group.primary.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const name =
    employeeFileSummary.data?.employee_name ??
    employeeRecord?.name ??
    "Employee profile";
  const employmentState = employeeFileSummary.data?.state ?? "active";
  const statusLabel = employmentState === "inactive" ? "Inactive" : "Active";
  const statusClass =
    employmentState === "inactive"
      ? "bg-slate-100 text-slate-700"
      : "bg-emerald-50 text-emerald-700";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const toggleExpanded = (documentId: number) => {
    setExpandedDocuments((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const handleReview = async (
    document: any,
    action: "approve" | "reject",
    reason = "",
  ) => {
    setReviewError("");
    try {
      const result = await review.mutateAsync({
        id: document.id,
        action,
        ...(action === "reject" ? { reason } : {}),
      });
      if (!result.success) {
        throw new Error(
          (result as { message?: string }).message ||
            "The document review could not be completed.",
        );
      }
      setViewing(null);
      setRejecting(null);
      setRejectReason("");
      void queryClient.invalidateQueries({
        queryKey: ["employee-files", "file-documents", employeeId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["employee-files", "file-activity", employeeId],
      });
    } catch (error: any) {
      setReviewError(error?.message || "The document review could not be completed.");
    }
  };

  const runUploadConflictPreflight = async (
    typeIds: string[],
    upload: (extras?: {
      replace_document_ids?: Array<number | null>;
      change_notes?: string[];
      allow_separate_duplicates?: boolean[];
    }) => Promise<void>,
  ) => {
    if (!employeeId) {
      await upload();
      return;
    }
    try {
      const perFile = await findUploadConflictsByFileIndex(employeeId, typeIds);
      const preventMessage = preventConflictMessage(perFile);
      if (preventMessage) {
        setUploadError(preventMessage);
        return;
      }
      if (!hasResolvableConflicts(perFile)) {
        await upload();
        return;
      }
      const conflicts = perFile.filter(Boolean) as UploadConflict[];
      setUploadConflictWarning({
        conflicts,
        perFile,
        proceedUpdate: async () => {
          setUploadConflictWarning(null);
          await upload({
            replace_document_ids: buildReplaceDocumentIdsFromConflicts(perFile),
            change_notes: buildVersionChangeNotesFromConflicts(perFile),
          });
        },
        proceedSeparate: async () => {
          setUploadConflictWarning(null);
          await upload({
            allow_separate_duplicates: buildAllowSeparateDuplicates(perFile),
          });
        },
      });
    } catch (error: any) {
      setUploadError(error?.message || "Could not check for upload conflicts.");
    }
  };

  const performUpload = async (extras?: {
    replace_document_ids?: Array<number | null>;
    change_notes?: string[];
    allow_separate_duplicates?: boolean[];
  }) => {
    const types = availableDocumentTypes.data ?? [];
    const metadataError = firstUploadMetadataError(
      uploadTypes,
      uploadExpiryDates,
      uploadIssueDates,
      uploadDescriptions,
      types,
    );
    if (
      !uploadFiles.length ||
      uploadTypes.some((id) => !id) ||
      !employeeId ||
      metadataError
    ) {
      if (metadataError) setUploadError(metadataError);
      return;
    }
    setUploadError("");
    try {
      const response = await uploadEmployeeDocument.mutateAsync({
        files: uploadFiles,
        employee_id: employeeId,
        document_type_ids: uploadTypes.map(Number),
        expiry_dates: uploadExpiryDates,
        issue_dates: uploadIssueDates,
        descriptions: uploadDescriptions,
        replace_document_ids: extras?.replace_document_ids,
        change_notes: extras?.change_notes,
        allow_separate_duplicates: extras?.allow_separate_duplicates,
      });
      if (!response.success || !response.data?.id) {
        throw new Error(response.message || "The document could not be uploaded.");
      }
      setUploadFiles([]);
      setUploadTypes([]);
      setUploadExpiryDates([]);
      setUploadIssueDates([]);
      setUploadDescriptions([]);
      setBulkUploadType("");
      setShowUpload(false);
    } catch (error: any) {
      setUploadError(error?.message || "The document could not be uploaded.");
    }
  };

  const handleWizardUpload = async (payload: {
    files: File[];
    documentTypeId: number;
    metadata: Record<string, string>;
  }) => {
    if (!employeeId) return;
    setUploadError("");
    const file = payload.files[0];
    const typeId = String(payload.documentTypeId);
    const expiry = payload.metadata.expiry_date ?? "";
    const issue = payload.metadata.issue_date ?? "";
    const description = payload.metadata.description ?? "";
    const types = availableDocumentTypes.data ?? [];
    const metadataError = firstUploadMetadataError(
      [typeId],
      [expiry],
      [issue],
      [description],
      types,
    );
    if (metadataError) {
      throw new Error(metadataError);
    }
    const uploadWizard = async (extras?: {
      replace_document_ids?: Array<number | null>;
      change_notes?: string[];
      allow_separate_duplicates?: boolean[];
    }) => {
      const response = await uploadEmployeeDocument.mutateAsync({
        files: [file],
        employee_id: employeeId,
        document_type_ids: [payload.documentTypeId],
        expiry_dates: [expiry],
        issue_dates: [issue],
        descriptions: [description],
        replace_document_ids: extras?.replace_document_ids,
        change_notes: extras?.change_notes,
        allow_separate_duplicates: extras?.allow_separate_duplicates,
      });
      if (!response.success) {
        throw new Error(response.message || "The document could not be uploaded.");
      }
      setShowUpload(false);
    };
    await runUploadConflictPreflight([typeId], uploadWizard);
  };

  const handleUploadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !uploadFiles.length ||
      uploadTypes.some((id) => !id) ||
      !employeeId ||
      missingUploadMetadata(
        uploadTypes,
        uploadExpiryDates,
        uploadIssueDates,
        uploadDescriptions,
        availableDocumentTypes.data ?? [],
      )
    )
      return;
    await runUploadConflictPreflight(uploadTypes, performUpload);
  };

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <BackButton variant="page" />
      {reviewError && !rejecting && (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {reviewError}
        </p>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-pink-50 text-2xl font-bold text-brand-pink ring-4 ring-pink-50">
              {name !== "Employee profile" ? initials : <UserRound className="h-8 w-8" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {name}
              </h1>
              {headerFields.length ? (
                <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {headerFields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {field.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-medium text-slate-800">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : employeeFilesConfig.isLoading || employeeFileSummary.isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Loading header fields…</p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No header fields selected. Add fields under Settings → Employee Files →
                  Employee information.
                </p>
              )}
              {emsReadOnlyNote && headerFields.some((field) => field.ems_managed) ? (
                <p className="mt-4 max-w-2xl text-xs leading-relaxed text-slate-500">
                  {emsReadOnlyNote}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${statusClass}`}
            >
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                setUploadError("");
                setShowUpload(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
            >
              <FilePlus2 className="h-4 w-4" />
              Upload document
            </button>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <SectionTabs
            items={[
              { id: "overview", label: "Overview" },
              { id: "documents", label: "Documents" },
              { id: "compliance", label: "Compliance" },
              { id: "activity", label: "Activity" },
              { id: "groups", label: "Related groups" },
            ]}
            value={profileTab}
            onChange={setProfileTab}
            ariaLabel="Employee file sections"
          />
        </div>
      </section>
      {profileTab === "overview" ? (
        <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-text to-brand-pink p-5 text-white shadow-lg shadow-pink-200">
          <p className="text-sm text-white/80">Total documents</p>
          <p className="mt-3 text-3xl font-bold">{employeeDocuments.length}</p>
          <p className="mt-1 text-xs text-white/80">
            Across this employee record
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Approved documents</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{approved}</p>
          <p className="mt-1 text-xs text-slate-400">
            Active and verified records
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Document types</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{documentTypes.length}</p>
          <p className="mt-1 text-xs text-slate-400">
            Classified categories
          </p>
        </div>
        </div>
        </div>
      ) : null}
      {profileTab === "documents" ? (
        <>
      <DocumentFilterBar
        filters={filters}
        onChange={setFilters}
        availableTypes={availableDocumentTypes.data ?? []}
        showDepartmentFilter={false}
        totalCount={employeeDocuments.length}
        filteredCount={filteredEmployeeDocuments.length}
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 pt-4">
          <BulkDocumentActions
            selected={selected}
            onClear={() => setSelected([])}
            documents={filteredEmployeeDocuments}
            groups={groupedEmployeeDocuments}
          />
        </div>
        {fileDocuments.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : groupedEmployeeDocuments.length ? (
          <EmployeeProfileDocumentTree
            groups={groupedEmployeeDocuments}
            selected={selected}
            expandedDocuments={expandedDocuments}
            allSelected={allSelected}
            onToggleAll={() => setSelected(allSelected ? [] : visibleIds)}
            onToggleSelect={toggleSelected}
            onToggleExpand={toggleExpanded}
            onView={(document) => {
              setViewing(document);
              setViewingVersionId(null);
            }}
            onOpenDocument={(document) => {
              setViewing(document);
              setViewingVersionId(null);
            }}
            onViewVersion={(document, versionId) => {
              setViewing(document);
              setViewingVersionId(versionId);
            }}
            onApprove={(document) => void handleReview(document, "approve")}
            onReject={(document) => {
              setRejecting(document);
              setRejectReason("");
              setReviewError("");
            }}
            reviewPending={review.isPending}
            showReviewActions={canReviewEmployeeDocuments}
            isDocumentManager={isDocumentManager}
            showUpdateAction={isDocumentManager}
            onUpdate={setUpdatingDocument}
          />
        ) : filteredEmployeeDocuments.length < employeeDocuments.length ? (
          <p className="p-10 text-center text-sm text-slate-500">
            No documents match the current filters.
            <button
              type="button"
              onClick={() => setFilters(INITIAL_FILTER_STATE)}
              className="mt-2 block w-full text-sm font-semibold text-brand-pink hover:underline"
            >
              Clear filters
            </button>
          </p>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            No documents uploaded for this employee yet.
          </p>
        )}
      </section>
        </>
      ) : null}
      {profileTab === "compliance" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Compliance status:{" "}
            {complianceScore === null
              ? "Not evaluated"
              : `${complianceScore}% · ${complianceState}`}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {currentEvaluations.map((evaluation) => (
              <li key={evaluation.id} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                <span>{evaluation.policy_name}</span>
                <span className="font-medium">{evaluation.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {profileTab === "activity" ? (
        <EmployeeFileActivityPanel
          loading={fileActivity.isLoading}
          events={fileActivity.data ?? []}
          employeeId={employeeId}
        />
      ) : null}
      {profileTab === "groups" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {relatedGroups.length ? (
            <ul className="space-y-2 text-sm">
              {relatedGroups.map((group) => (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 pt-1"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pages/employee/group?id=${group.id}`}
                      className="font-medium text-brand-pink no-underline hover:no-underline hover:text-brand-text"
                    >
                      {group.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.group_kind === "system_managed"
                        ? group.parent_group_name
                          ? `${group.parent_group_name} · System-managed`
                          : "System-managed"
                        : "Custom group"}
                    </p>
                  </div>
                  {group.group_kind === "custom" && isDocumentManager ? (
                    <button
                      type="button"
                      disabled={!employeeFileId || removingGroupId === group.id}
                      className="shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={async () => {
                        if (!employeeFileId) return;
                        if (
                          !window.confirm(
                            `Remove ${name} from "${group.name}"? This only removes the group membership; their employee file and documents are unchanged.`,
                          )
                        ) {
                          return;
                        }
                        setRemovingGroupId(group.id);
                        try {
                          await removeFromGroup.mutateAsync({
                            groupId: group.id,
                            employeeFileIds: [employeeFileId],
                          });
                        } finally {
                          setRemovingGroupId(null);
                        }
                      }}
                    >
                      {removingGroupId === group.id ? "Removing…" : "Remove"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {group.group_kind === "system_managed"
                        ? "Managed by EMS"
                        : null}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No related groups yet.</p>
          )}
          {isDocumentManager ? (
            <p className="mt-4 text-xs text-slate-500">
              To add this employee to a custom group, open the group from Employee Files
              home and use Add employee files.
            </p>
          ) : null}
        </section>
      ) : null}
      {showUpload && (
        <ModalDialog
          title="Upload documents"
          eyebrow="Employee files"
          description="Upload with the guided wizard or add several files at once. Required metadata depends on the document type."
          onClose={() => setShowUpload(false)}
          size="lg"
          titleClassName="text-xl"
        >
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                uploadMode === "wizard"
                  ? "bg-brand-pink text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setUploadMode("wizard")}
            >
              Guided upload
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                uploadMode === "bulk"
                  ? "bg-brand-pink text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setUploadMode("bulk")}
            >
              Bulk upload
            </button>
          </div>
          {uploadMode === "wizard" ? (
            <EmployeeUploadWizard
              documentTypes={availableDocumentTypes.data ?? []}
              onClose={() => setShowUpload(false)}
              onSubmit={handleWizardUpload}
            />
          ) : null}
          {uploadMode === "bulk" ? (
          <form onSubmit={(event) => void handleUploadSubmit(event)}>
            <label className="block">
              <span className="label">Files</span>
              <span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-6 text-sm font-semibold text-brand-text">
                <Upload className="h-5 w-5" />{uploadFiles.length ? `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} selected` : "Choose files from your computer"}
                <input
                  required
                  multiple
                  type="file"
                  onChange={(event) => {
                    const next = Array.from(event.target.files ?? []);
                    setUploadFiles(next);
                    setUploadTypes(next.map((_, index) => uploadTypes[index] ?? ""));
                    setUploadExpiryDates(
                      next.map((_, index) => uploadExpiryDates[index] ?? ""),
                    );
                    setUploadIssueDates(
                      next.map((_, index) => uploadIssueDates[index] ?? ""),
                    );
                    setUploadDescriptions(
                      next.map((_, index) => uploadDescriptions[index] ?? ""),
                    );
                  }}
                  className="hidden"
                />
              </span>
            </label>
            {uploadFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(160px,200px)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(0,1fr)] gap-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <span>File name</span>
                  <span>Document type</span>
                  <span>Issue date</span>
                  <span>Expiry date</span>
                  <span>Description</span>
                </div>
                {uploadFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(160px,200px)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2"
                  >
                    <span
                      title={file.name}
                      className="min-w-0 truncate text-sm font-medium text-slate-700"
                    >
                      {file.name}
                    </span>
                    <ThemedSelect
                      value={uploadTypes[index] ?? ""}
                      onChange={(value) =>
                        setUploadTypes((current) =>
                          current.map((item, i) => (i === index ? value : item)),
                        )
                      }
                      placeholder="Document type"
                      options={(availableDocumentTypes.data ?? []).map((type) => ({
                        value: String(type.id),
                        label: type.name,
                      }))}
                    />
                    {typeRequiresIssueDate(
                      uploadTypes[index] ?? "",
                      availableDocumentTypes.data ?? [],
                    ) ? (
                      <input
                        required
                        type="date"
                        className="field"
                        value={uploadIssueDates[index] ?? ""}
                        onChange={(event) =>
                          setUploadIssueDates((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        type="date"
                        className="field"
                        value={uploadIssueDates[index] ?? ""}
                        onChange={(event) =>
                          setUploadIssueDates((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    )}
                    {typeRequiresExpiry(
                      uploadTypes[index] ?? "",
                      availableDocumentTypes.data ?? [],
                    ) ? (
                      <input
                        required
                        type="date"
                        className="field"
                        value={uploadExpiryDates[index] ?? ""}
                        onChange={(event) =>
                          setUploadExpiryDates((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                    <input
                      type="text"
                      className="field min-w-0"
                      required={typeRequiresDescription(
                        uploadTypes[index] ?? "",
                        availableDocumentTypes.data ?? [],
                      )}
                      placeholder={
                        typeRequiresDescription(
                          uploadTypes[index] ?? "",
                          availableDocumentTypes.data ?? [],
                        )
                          ? "Required"
                          : "Optional"
                      }
                      value={uploadDescriptions[index] ?? ""}
                      onChange={(event) =>
                        setUploadDescriptions((current) =>
                          current.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                {uploadFiles.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-bold text-brand-pink"
                    onClick={() => {
                      const value = uploadTypes[0] ?? "";
                      setUploadTypes(uploadFiles.map(() => value));
                    }}
                  >
                    Apply first type to all
                  </button>
                ) : null}
              </div>
            )}
            {uploadFiles.length > 1 ? (
              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-700">Advanced configuration</summary>
                <div className="mt-3 flex items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="label">Use one document type for all files</span>
                    <ThemedSelect value={bulkUploadType} onChange={setBulkUploadType} placeholder="Select a type" options={(availableDocumentTypes.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))} />
                  </label>
                  <InlineDocumentTypeCreator onCreated={(type) => setBulkUploadType(String(type.id))} />
                  <button type="button" disabled={!bulkUploadType} onClick={() => setUploadTypes(uploadFiles.map(() => bulkUploadType))} className="rounded-xl bg-pink-50 px-3 py-2.5 text-xs font-bold text-brand-pink disabled:opacity-50">Apply to all</button>
                </div>
              </details>
            ) : null}
            {uploadError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{uploadError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowUpload(false)} className="rounded-full px-4 py-2.5 font-semibold text-slate-500">Cancel</button>
              <button
                disabled={
                  uploadEmployeeDocument.isPending ||
                  !uploadFiles.length ||
                  uploadTypes.some((id) => !id) ||
                  missingUploadMetadata(
                    uploadTypes,
                    uploadExpiryDates,
                    uploadIssueDates,
                    uploadDescriptions,
                    availableDocumentTypes.data ?? [],
                  )
                }
                className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadEmployeeDocument.isPending ? "Uploading..." : "Upload documents"}
              </button>
            </div>
          </form>
          ) : null}
        </ModalDialog>
      )}
      {viewing && (
        <DocumentViewerDialog
          title={viewing.name}
          eyebrow={
            viewing && canReviewDocument(viewing)
              ? "Admin review"
              : "Document viewer"
          }
          description={viewing.document_type}
          onClose={() => {
            setViewing(null);
            setViewingVersionId(null);
          }}
          documentId={viewing.id}
          currentVersionNumber={viewing.current_version_number}
          initialVersionId={viewingVersionId}
          previewUrl={documentPreviewUrl(viewing.id, {
            variant:
              canReviewDocument(viewing) && viewing.approval_state === "pending"
                ? "pending"
                : "current",
          })}
          footer={
            viewing ? (
              <>
                {canReviewDocument(viewing) ? (
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-sm font-semibold text-slate-700">
                      This document is awaiting your approval.
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={review.isPending}
                        onClick={() => {
                          setRejecting(viewing);
                          setViewing(null);
                          setRejectReason("");
                          setReviewError("");
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={review.isPending}
                        onClick={() => void handleReview(viewing, "approve")}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-sm font-bold text-white"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                    </div>
                  </div>
                ) : null}
                <DocumentRelationsPanel
                  documentId={viewing.id}
                  employeeId={employeeId}
                  pickerDocuments={employeeDocuments}
                  isManager={isDocumentManager}
                  onOpenRelated={(relatedDocumentId, relatedEmployeeId) => {
                    if (relatedEmployeeId === employeeId) {
                      const match = employeeDocuments.find(
                        (doc) => doc.id === relatedDocumentId,
                      );
                      if (match) {
                        setViewing(match);
                        setViewingVersionId(null);
                      }
                      return;
                    }
                    router.push(
                      `/pages/employee/profile?employee=${relatedEmployeeId}&doc=${relatedDocumentId}`,
                    );
                  }}
                />
              </>
            ) : undefined
          }
        />
      )}
      {uploadConflictWarning ? (
        <UploadConflictDialog
          conflicts={uploadConflictWarning.conflicts}
          onCancel={() => setUploadConflictWarning(null)}
          onUpdateExisting={() => void uploadConflictWarning.proceedUpdate()}
          onUploadSeparate={() => void uploadConflictWarning.proceedSeparate()}
          pending={uploadEmployeeDocument.isPending}
          canUpdateExisting={uploadConflictWarning.conflicts.some(
            (conflict) => conflict.enable_versioning,
          )}
          requireConfirmForSeparate={uploadConflictWarning.conflicts.some(
            (conflict) => conflict.policy === "allow_confirm",
          )}
        />
      ) : null}
      {updatingDocument ? (
        <UpdateDocumentModal
          document={updatingDocument}
          employeeId={employeeId}
          mode="employee_file"
          onClose={() => setUpdatingDocument(null)}
          onSuccess={() => {
            void fileDocuments.refetch();
            void fileActivity.refetch();
          }}
        />
      ) : null}
      {rejecting && (
        <ModalDialog
          title="Explain what needs to change"
          eyebrow="Reject document"
          description="The requester will see this reason when they review the rejected document."
          onClose={() => setRejecting(null)}
          size="sm"
          titleClassName="text-xl"
          backdropClassName="bg-slate-950/45"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!rejectReason.trim()) {
                setReviewError("Add a reason before rejecting this document.");
                return;
              }
              void handleReview(rejecting, "reject", rejectReason.trim());
            }}
          >
            <label className="block">
              <span className="label">Reason</span>
              <textarea
                autoFocus
                required
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setReviewError("");
                }}
                rows={4}
                placeholder="Explain what needs to be corrected..."
                className="field min-h-28 resize-none"
              />
            </label>
            {reviewError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {reviewError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={review.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {review.isPending ? "Rejecting..." : "Reject document"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}

function formatActivityWhen(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(String(value).replace(" ", "T")));
}

function activityEventIcon(kind: WorkspaceActivityEvent["kind"]) {
  if (kind === "acknowledgement") return CheckCircle2;
  if (kind === "approval") return AlertCircle;
  if (kind === "upload") return FileText;
  return Activity;
}

function EmployeeFileActivityPanel({
  loading,
  events,
  employeeId,
}: {
  loading: boolean;
  events: WorkspaceActivityEvent[];
  employeeId: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {loading ? (
        <div className="space-y-3 py-8">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : !events.length ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No activity recorded for this employee file yet.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {events.map((event) => {
            const Icon = activityEventIcon(event.kind);
            return (
              <div
                key={`${event.id}-${event.occurred_at}`}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{event.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.actor_name}
                      {event.folder_name ? ` · ${event.folder_name}` : ""}
                    </p>
                    {event.document_id ? (
                      <Link
                        href={documentViewHref(
                          {
                            id: event.document_id,
                            folder_id: event.folder_id,
                            employee_id: employeeId,
                            folder_type: event.folder_type,
                          },
                          true,
                        )}
                        className="mt-2 inline-flex text-xs font-bold text-brand-pink hover:underline"
                      >
                        View document
                      </Link>
                    ) : null}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {formatActivityWhen(event.occurred_at)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
