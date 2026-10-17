"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  FileText,
  Hash,
  MapPin,
} from "lucide-react";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocFolder, OrganizationalPolicy, SuggestedPolicyFile } from "../../../lib/types";
import FormWindowShell from "./FormWindowShell";
import {
  ORG_FORM_INPUT_CLASS,
  ORG_FORM_SELECT_CLASS,
  ORG_FORM_TEXTAREA_CLASS,
} from "../../../lib/orgFormFieldStyles";
import PolicyCreateSelectExistingDialog from "./PolicyCreateSelectExistingDialog";
import PolicyFolderSelectExistingDialog from "./PolicyFolderSelectExistingDialog";
import PolicyFolderCreateCustomDialog from "./PolicyFolderCreateCustomDialog";
import DocumentUploadModal, {
  type DocumentUploadPayload,
} from "./DocumentUploadModal";
import PolicyPotentialFilesPanel from "./PolicyPotentialFilesPanel";
import PolicyDescriptionAssist from "./PolicyDescriptionAssist";
import { api } from "../../../lib/api";
import {
  QUERY_KEYS,
  useDocumentTypes,
  useSettings,
  useUploadDocument,
} from "../../../hooks/useDocuments";
import { useToast } from "../../../hooks/useToast";
import {
  isPendingApprovalResponse,
  notifyPendingApproval,
} from "../../../lib/pendingApproval";
import type { PolicyCreateDraft } from "./PolicyAdoptSuggestedFilesDialog";
import AppSelect from "./AppSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SMART_SELECTION_SECONDARY_HINT =
  "You chose files from smart suggestions—they will be added when you create the policy. Clear the selection to upload, pick more from the library, or write in the editor instead.";

function PolicyCreateSecondaryDocButton({
  label,
  disabled,
  blockedBySmartSelection,
  onClick,
}: {
  label: string;
  disabled: boolean;
  blockedBySmartSelection: boolean;
  onClick: () => void;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-slate-600"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );

  if (!blockedBySmartSelection) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex cursor-not-allowed rounded-md"
            tabIndex={0}
            aria-disabled="true"
          />
        }
      >
        {button}
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[120] max-w-[280px] text-left text-xs leading-relaxed">
        {SMART_SELECTION_SECONDARY_HINT}
      </TooltipContent>
    </Tooltip>
  );
}

const VISIBILITY_OPTIONS = [
  { value: "employees", label: "Visible to employees" },
  { value: "hr_only", label: "HR only" },
];

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

const REVIEW_CYCLE_OPTIONS = [
  { value: "3", label: "Every 3 months" },
  { value: "6", label: "Every 6 months" },
  { value: "12", label: "Every 12 months" },
  { value: "24", label: "Every 24 months" },
  { value: "36", label: "Every 36 months" },
];

function previewPolicyCode(categoryCode?: string, categoryName?: string) {
  const raw = (categoryCode || categoryName || "GEN").toUpperCase();
  const slug =
    raw
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 16) || "GEN";
  return `POL-${slug}-001`;
}

export default function CreatePolicyFolderDialog({
  parentFolder = null,
  onClose,
}: {
  parentFolder?: DocFolder | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const upload = useUploadDocument();
  const types = useDocumentTypes();
  const settings = useSettings();
  const { showAlert, showConfirm } = useAppDialog();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("employees");
  const [reviewMonths, setReviewMonths] = useState("12");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [unassignedSuggestions, setUnassignedSuggestions] = useState<SuggestedPolicyFile[]>(
    [],
  );
  const [namedSuggestions, setNamedSuggestions] = useState<SuggestedPolicyFile[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(true);
  const [namedLoading, setNamedLoading] = useState(false);
  const policyNameTyped = Boolean(name.trim());
  const suggested = policyNameTyped ? namedSuggestions : unassignedSuggestions;
  const suggestedLoading = policyNameTyped ? namedLoading : unassignedLoading;
  const [pending, setPending] = useState(false);
  const [createdFolderId, setCreatedFolderId] = useState<number | null>(null);
  const [createdPolicy, setCreatedPolicy] = useState<OrganizationalPolicy | null>(null);
  const [showCreateSelectExisting, setShowCreateSelectExisting] = useState(false);
  const [showFolderSelectExisting, setShowFolderSelectExisting] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const categories = useMemo(() => {
    const rows = settings.data?.document_categories ?? [];
    return rows.filter((item: { active?: boolean }) => item.active !== false);
  }, [settings.data?.document_categories]);

  const categoryOptions = useMemo(
    () =>
      categories.map((item: { id: number; name: string }) => ({
        value: String(item.id),
        label: item.name,
      })),
    [categories],
  );

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (item: { id: number }) => String(item.id) === categoryId,
      ) as { id: number; name: string; code?: string } | undefined,
    [categories, categoryId],
  );

  const locationLabel = parentFolder
    ? parentFolder.folder_name
    : "Library root (/)";

  const pathPreview = useMemo(() => {
    const base = parentFolder
      ? `Organizational files / ${parentFolder.folder_name}`
      : "Organizational files";
    const leaf = name.trim() || "New policy";
    return `${base} / ${leaf}`;
  }, [name, parentFolder]);

  const policyCodePreview = previewPolicyCode(
    selectedCategory?.code,
    selectedCategory?.name,
  );

  const draft = (): PolicyCreateDraft => ({
    name: name.trim(),
    parent_folder_id: parentFolder?.id,
    category: selectedCategory?.name,
    category_id: selectedCategory?.id,
    visibility,
    effective_date: effectiveDate || undefined,
    description: description.trim() || undefined,
    review_interval_months: Number(reviewMonths) || 12,
  });

  useEffect(() => {
    setUnassignedLoading(true);
    void api
      .suggestedPolicyFiles({ unassigned_policy_files: true })
      .then((result) => {
        if (!result.success) {
          setUnassignedSuggestions([]);
          return;
        }
        setUnassignedSuggestions(result.data?.items ?? []);
      })
      .finally(() => setUnassignedLoading(false));
  }, []);

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNamedSuggestions([]);
      setNamedLoading(false);
      return;
    }
    setNamedLoading(true);
    const handle = window.setTimeout(() => {
      void api
        .suggestedPolicyFiles({
          name: trimmed,
          preview_suggestions: true,
        })
        .then((result) => {
          if (!result.success) {
            setNamedSuggestions([]);
            return;
          }
          setNamedSuggestions(result.data?.items ?? []);
        })
        .finally(() => setNamedLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [name]);

  const goToPolicyFolder = (folderId: number) => {
    router.push(`/pages/organization/folder?folder=${folderId}`);
  };

  const finish = (folderId: number) => {
    onClose();
    goToPolicyFolder(folderId);
  };

  const handleDuplicateName = async (
    result: { data?: { policy?: OrganizationalPolicy } },
  ): Promise<number | null> => {
    const folderId = result.data?.policy?.folder_id;
    if (!folderId) return null;
    const openExisting = await showConfirm(
      "A policy with this name already exists. Open the existing policy folder?",
      {
        title: "Duplicate policy name",
        confirmLabel: "Open existing policy",
        cancelLabel: "Stay here",
      },
    );
    return openExisting ? folderId : null;
  };

  const createPolicy = async (
    documentIds: number[],
    options?: { openAfter?: "upload" | "custom" | "select" },
  ): Promise<number | null> => {
    if (!name.trim()) {
      await showAlert("Enter a policy name.", { title: "Unable to create" });
      return null;
    }
    if (!categoryId) {
      await showAlert("Choose a document category from Settings.", {
        title: "Category required",
      });
      return null;
    }
    setPending(true);
    try {
      const result = await api.createPolicyFolder({
        name: draft().name,
        parent_folder_id: draft().parent_folder_id,
        document_ids: documentIds,
        category: draft().category,
        category_id: draft().category_id,
        visibility: draft().visibility,
        effective_date: draft().effective_date,
        description: draft().description,
        review_interval_months: draft().review_interval_months,
      });
      if (!result.success) {
        if (result.code === "duplicate_name") {
          const existingId = await handleDuplicateName(result);
          if (existingId) finish(existingId);
          return null;
        }
        await showAlert(result.message || "Unable to create this policy.", {
          title: "Unable to create",
        });
        return null;
      }
      const folderId = result.data?.folder?.id;
      if (!folderId) {
        await showAlert("Policy was created but the folder could not be opened.", {
          title: "Unable to open folder",
        });
        return null;
      }
      setCreatedFolderId(folderId);
      if (result.data?.policy) {
        setCreatedPolicy(result.data.policy);
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
      await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
      if (documentIds.length) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(folderId) });
      }
      if (options?.openAfter === "upload") {
        setShowUpload(true);
        return folderId;
      }
      if (options?.openAfter === "custom") {
        setShowCreateCustom(true);
        return folderId;
      }
      if (options?.openAfter === "select" && result.data?.policy) {
        setShowFolderSelectExisting(true);
        return folderId;
      }
      finish(folderId);
      return folderId;
    } finally {
      setPending(false);
    }
  };

  const openSecondary = async (mode: "upload" | "custom" | "select") => {
    if (!name.trim()) {
      await showAlert("Enter a policy name.", { title: "Unable to continue" });
      return;
    }
    if (!categoryId) {
      await showAlert("Choose a document category from Settings.", {
        title: "Category required",
      });
      return;
    }
    if (mode === "select") {
      if (createdPolicy) {
        setShowFolderSelectExisting(true);
        return;
      }
      setShowCreateSelectExisting(true);
      return;
    }
    if (createdFolderId) {
      if (mode === "upload") setShowUpload(true);
      if (mode === "custom") setShowCreateCustom(true);
      return;
    }
    await createPolicy(selectedDocumentIds, { openAfter: mode });
  };

  const performUpload = async (payload: DocumentUploadPayload) => {
    const folderId = createdFolderId;
    if (!folderId) return;
    if (!payload.files.length || payload.documentTypeIds.some((id) => !id)) {
      await showAlert("Choose files and a document type for each file.", {
        title: "Unable to upload",
      });
      return;
    }
    const result = await upload.mutateAsync({
      files: payload.files,
      folder_id: folderId,
      document_type_ids: payload.documentTypeIds.map(Number),
      expiry_dates: payload.expiryDates,
      issue_dates: payload.issueDates,
      descriptions: payload.descriptions,
    });
    if (isPendingApprovalResponse(result)) {
      notifyPendingApproval(result, showToast);
      setShowUpload(false);
      onClose();
      return;
    }
    setShowUpload(false);
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(folderId) });
    finish(folderId);
  };

  const canCreate =
    Boolean(name.trim()) && Boolean(categoryId) && !pending && !upload.isPending;
  const hasSmartSelection = selectedDocumentIds.length > 0;
  const secondaryDocActionsDisabled =
    pending || !name.trim() || !categoryId || hasSmartSelection;

  const submitCreate = useCallback(() => {
    void createPolicy(selectedDocumentIds);
  }, [selectedDocumentIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!pending) onClose();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canCreate) submitCreate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canCreate, onClose, pending, submitCreate]);

  return (
    <>
      <FormWindowShell
        title="Create policy"
        eyebrow="Organizational files · Library management"
        description={
          parentFolder
            ? `Creates a policy inside ${parentFolder.folder_name}.`
            : "Creates a policy at the library root."
        }
        onClose={onClose}
        closeDisabled={pending}
        modalClassName="max-w-3xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <p className="hidden text-xs text-slate-400 lg:block">
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                to cancel ·{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘ Enter
                </kbd>{" "}
                to create
              </p>
              <div className="flex flex-wrap gap-1">
                <PolicyCreateSecondaryDocButton
                  label="Upload file"
                  disabled={secondaryDocActionsDisabled}
                  blockedBySmartSelection={hasSmartSelection}
                  onClick={() => void openSecondary("upload")}
                />
                <PolicyCreateSecondaryDocButton
                  label="From library"
                  disabled={secondaryDocActionsDisabled}
                  blockedBySmartSelection={hasSmartSelection}
                  onClick={() => void openSecondary("select")}
                />
                <PolicyCreateSecondaryDocButton
                  label="Write in editor"
                  disabled={secondaryDocActionsDisabled}
                  blockedBySmartSelection={hasSmartSelection}
                  onClick={() => void openSecondary("custom")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled={!canCreate} onClick={submitCreate}>
                {pending ? "Creating…" : "Create policy"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="policy-create-name">
                Policy name <span className="text-brand-pink">*</span>
              </label>
              <span className="text-xs text-slate-400">
                {name.trim().length}/{NAME_MAX} characters
              </span>
            </div>
            <div className="relative">
              <FileText
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-pink"
                aria-hidden
              />
              <Input
                id="policy-create-name"
                autoFocus
                maxLength={NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Remote work policy"
                className={cn(ORG_FORM_INPUT_CLASS, "pl-11")}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-semibold text-slate-900">Policy location</p>
              <p className="text-xs text-slate-500">Destination</p>
              <div
                className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800"
                aria-readonly="true"
              >
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-pink" aria-hidden />
                  {locationLabel}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </div>
              <p className="text-xs text-brand-pink">
                <span className="font-semibold">Path:</span> {pathPreview}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="policy-create-category">
                Category <span className="text-brand-pink">*</span>
              </label>
              <p className="text-xs text-slate-500">From Settings → Categories & types</p>
              <AppSelect
                value={categoryId}
                onChange={setCategoryId}
                options={categoryOptions}
                placeholder={
                  categoryOptions.length
                    ? "Select a category"
                    : "No categories configured"
                }
                size="lg"
                className={ORG_FORM_SELECT_CLASS}
                ariaLabel="Policy category"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="policy-create-code">
                Policy code
              </label>
              <p className="text-xs text-slate-500">Assigned automatically on create</p>
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id="policy-create-code"
                  value={policyCodePreview}
                  readOnly
                  tabIndex={-1}
                  className={cn(ORG_FORM_INPUT_CLASS, "bg-slate-50 pl-11 text-slate-600")}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="policy-create-desc">
                Description
              </label>
              <span className="text-xs text-slate-400">(optional)</span>
            </div>
            <div className="mb-2 flex justify-end">
              <PolicyDescriptionAssist
                name={name}
                description={description}
                onDescriptionChange={setDescription}
                maxLength={DESCRIPTION_MAX}
              />
            </div>
            <textarea
              id="policy-create-desc"
              maxLength={DESCRIPTION_MAX}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Brief summary for reviewers and staff…"
              className={ORG_FORM_TEXTAREA_CLASS}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="policy-effective-date">
                Effective date
              </label>
              <p className="text-xs text-slate-500">(optional)</p>
              <div className="relative">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id="policy-effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  className={cn(ORG_FORM_INPUT_CLASS, "pl-11")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Review cycle</p>
              <p className="text-xs text-slate-500">How often this policy should be reviewed</p>
              <AppSelect
                value={reviewMonths}
                onChange={setReviewMonths}
                options={REVIEW_CYCLE_OPTIONS}
                size="lg"
                className={ORG_FORM_SELECT_CLASS}
                ariaLabel="Review cycle"
              />
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <label className="text-sm font-semibold text-slate-900" htmlFor="policy-create-visibility">
              Visibility
            </label>
            <AppSelect
              value={visibility}
              onChange={setVisibility}
              options={VISIBILITY_OPTIONS}
              size="lg"
              className={ORG_FORM_SELECT_CLASS}
              ariaLabel="Policy visibility"
            />
          </div>

          <PolicyPotentialFilesPanel
            policyName={name}
            items={suggested}
            loading={suggestedLoading}
            selectedIds={selectedDocumentIds}
            onSelectedIdsChange={setSelectedDocumentIds}
            disabled={pending}
          />
        </div>
      </FormWindowShell>

      {showCreateSelectExisting ? (
        <PolicyCreateSelectExistingDialog
          draft={draft()}
          eyebrow={locationLabel}
          onClose={() => setShowCreateSelectExisting(false)}
          onCreated={(folderId) => {
            setShowCreateSelectExisting(false);
            finish(folderId);
          }}
        />
      ) : null}
      {showFolderSelectExisting && createdPolicy ? (
        <PolicyFolderSelectExistingDialog
          policy={createdPolicy}
          onClose={() => {
            setShowFolderSelectExisting(false);
            if (createdFolderId) finish(createdFolderId);
          }}
        />
      ) : null}
      {showCreateCustom && createdFolderId ? (
        <PolicyFolderCreateCustomDialog
          folderId={createdFolderId}
          onClose={() => {
            setShowCreateCustom(false);
            finish(createdFolderId);
          }}
        />
      ) : null}
      {showUpload && createdFolderId ? (
        <DocumentUploadModal
          draftKey={`policy-create-upload-${createdFolderId}`}
          zIndex={95}
          title="Upload document"
          eyebrow={draft().name}
          description="Files uploaded here are classified as policy documents."
          documentTypes={types.data ?? []}
          pending={upload.isPending}
          onClose={() => {
            setShowUpload(false);
            finish(createdFolderId);
          }}
          onSubmit={performUpload}
          submitLabel="Add to policy"
        />
      ) : null}
    </>
  );
}
