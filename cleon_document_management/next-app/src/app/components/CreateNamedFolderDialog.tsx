"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Folder } from "lucide-react";
import { api } from "../../../lib/api";
import {
  QUERY_KEYS,
  useCreateFolder,
  useFolders,
} from "../../../hooks/useDocuments";
import { useComplianceTargets } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { DocFolder, SuggestedCollectionFile } from "../../../lib/types";
import FormWindowShell from "./FormWindowShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FolderDescriptionAssist from "./FolderDescriptionAssist";
import CollectionPotentialFilesPanel from "./CollectionPotentialFilesPanel";
import OrgFolderLocationPickerDialog from "./OrgFolderLocationPickerDialog";
import OrgFolderAccessChoiceCards from "./OrgFolderAccessChoiceCards";
import OrganizationalAccessScopeFields from "./OrganizationalAccessScopeFields";
import {
  validateOrganizationalVisibility,
  visibilityToAccessScope,
} from "./OrganizationalVisibilityFields";
import { formatFieldLabel } from "../../../lib/formatLabel";
import {
  allowedAccessScopes,
  coerceVisibilityMode,
  type OrgVisibilityMode,
} from "../../../lib/organizationalFolderScope";
import {
  DEFAULT_ORG_FOLDER_ACCENT,
  ORG_FOLDER_ACCENT_COLORS,
  orgFolderAccentLabel,
} from "../../../lib/orgFolderAccentColors";
import { ORG_FOLDER_NAME_SUGGESTIONS } from "../../../lib/orgFolderNameSuggestions";
import {
  ORG_PROJECT_NAME_SUGGESTIONS,
  ORG_VENDOR_NAME_SUGGESTIONS,
} from "../../../lib/orgCollectionNameSuggestions";
import { parentFolderId } from "../../../lib/organizationalFolderDetails";
import { cn } from "@/lib/utils";
import { ORG_FORM_INPUT_CLASS } from "../../../lib/orgFormFieldStyles";

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

function buildFolderPath(
  folders: DocFolder[],
  parentId: number | null,
  draftName: string,
) {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const segments: string[] = [];
  let current = parentId ? byId.get(parentId) : undefined;
  while (current) {
    segments.unshift(current.folder_name);
    const parent = parentFolderId(current);
    current = parent ? byId.get(parent) : undefined;
  }
  const trail = segments.length ? segments.join(" / ") : "Root";
  const leaf = draftName.trim() || "New folder";
  return `${trail} / ${leaf}`;
}

export default function CreateNamedFolderDialog({
  kind,
  parentFolder,
  onClose,
}: {
  kind: "folder" | "project" | "vendor";
  parentFolder?: DocFolder | null;
  onClose: () => void;
}) {
  const create = useCreateFolder();
  const queryClient = useQueryClient();
  const foldersQuery = useFolders();
  const targets = useComplianceTargets();
  const { showAlert } = useAppDialog();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState(DEFAULT_ORG_FOLDER_ACCENT);
  const [destinationParentId, setDestinationParentId] = useState<number | null>(
    parentFolder?.id ?? null,
  );
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<OrgVisibilityMode>("public");
  const [restrictedScope, setRestrictedScope] = useState("department");
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
  const [suggested, setSuggested] = useState<SuggestedCollectionFile[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [selectedShortcutIds, setSelectedShortcutIds] = useState<number[]>([]);

  const titles = {
    folder: "Create folder",
    project: "Create project",
    vendor: "Create vendor",
  };
  const isCollection = kind === "project" || kind === "vendor";
  const isOrgFolder = kind === "folder";
  const orgFolders = useMemo(
    () => (foldersQuery.data ?? []).filter((item) => item.folder_type === "organizational"),
    [foldersQuery.data],
  );
  const destinationParent = useMemo(
    () =>
      destinationParentId
        ? orgFolders.find((item) => item.id === destinationParentId)
        : undefined,
    [destinationParentId, orgFolders],
  );
  const departments = targets.data?.departments ?? [];
  const grades = targets.data?.grades ?? [];
  const employees = targets.data?.employees ?? [];
  const parentAccessScope = destinationParent?.access_scope;
  const pathPreview = useMemo(
    () => buildFolderPath(orgFolders, destinationParentId, name),
    [destinationParentId, name, orgFolders],
  );

  const visibility = coerceVisibilityMode(visibilityMode, parentAccessScope);
  const accessScope = isOrgFolder
    ? visibilityToAccessScope(visibility, restrictedScope)
    : destinationParent?.access_scope || "all_staff";
  const nameValid = name.trim().length > 0 && name.trim().length <= NAME_MAX;
  const scopeError = isOrgFolder
    ? validateOrganizationalVisibility(visibility, restrictedScope, scopeIds)
    : null;

  useEffect(() => {
    setVisibilityMode((current) => coerceVisibilityMode(current, parentAccessScope));
  }, [parentAccessScope]);
  const canSubmit =
    nameValid && !scopeError && !create.isPending && (!isOrgFolder || !scopeError);

  useEffect(() => {
    if (!isCollection || name.trim().length < 2) {
      setSuggested([]);
      setSuggestedLoading(false);
      return;
    }
    setSuggestedLoading(true);
    const handle = window.setTimeout(() => {
      void api
        .suggestedOrganizationalFiles({
          name: name.trim(),
          folder_id: destinationParentId ?? undefined,
          folder_kind: kind,
        })
        .then((result) => setSuggested(result.data?.items ?? []))
        .finally(() => setSuggestedLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [destinationParentId, isCollection, kind, name]);

  useEffect(() => {
    setSelectedShortcutIds((prev) =>
      prev.filter((id) => suggested.some((item) => item.id === id)),
    );
  }, [suggested]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert("Enter a name.", { title: "Unable to create" });
      return;
    }
    if (isOrgFolder) {
      const scopeMessage = validateOrganizationalVisibility(
        visibility,
        restrictedScope,
        scopeIds,
      );
      if (scopeMessage) {
        await showAlert(scopeMessage, { title: "Unable to create" });
        return;
      }
    }

    const inheritedParent = destinationParent;
    const resolvedScope = isOrgFolder
      ? accessScope
      : inheritedParent?.access_scope || "all_staff";
    const result = await create.mutateAsync({
      nameElm: trimmed,
      descriptionElm: isOrgFolder ? description.trim() : undefined,
      folder_type: "organizational",
      folder_kind: kind,
      parent_id: destinationParentId || false,
      access_scope: resolvedScope,
      department_ids: isOrgFolder
        ? resolvedScope === "department"
          ? scopeIds
          : []
        : inheritedParent?.department_ids ?? [],
      grade_ids: isOrgFolder
        ? resolvedScope === "grade"
          ? scopeIds
          : []
        : inheritedParent?.grade_ids ?? [],
      employee_ids: isOrgFolder
        ? resolvedScope === "individual"
          ? scopeIds
          : []
        : inheritedParent?.employee_ids ?? [],
      organize_by: "none",
      color_hex: isOrgFolder ? colorHex : undefined,
    });
    if (!result.success) {
      await showAlert(result.message || "Unable to create this item.", {
        title: "Unable to create",
      });
      return;
    }

    const newFolderId = result.data?.id;
    if (newFolderId && selectedShortcutIds.length) {
      const failures: string[] = [];
      for (const documentId of selectedShortcutIds) {
        const shortcut = await api.createOrganizationalShortcut({
          document_id: documentId,
          folder_id: newFolderId,
        });
        if (!shortcut.success) {
          failures.push(shortcut.message || `Document #${documentId}`);
        }
      }
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(newFolderId),
      });
      if (failures.length) {
        await showAlert(
          `Created ${kind}, but some shortcuts could not be added:\n${failures.join("\n")}`,
          { title: "Shortcuts partially added" },
        );
      }
    }

    onClose();
  }, [
    accessScope,
    colorHex,
    create,
    description,
    destinationParent,
    destinationParentId,
    isCollection,
    isOrgFolder,
    kind,
    name,
    onClose,
    queryClient,
    restrictedScope,
    scopeIds,
    selectedShortcutIds,
    showAlert,
    visibility,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canSubmit) void submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSubmit, onClose, submit]);

  const locationLabel = destinationParent
    ? destinationParent.folder_name
    : "Library root (/)";

  return (
    <>
      <FormWindowShell
        title={titles[kind]}
        eyebrow="Organizational files · Library management"
        description={
          destinationParent
            ? `Creates a ${kind} inside ${destinationParent.folder_name}.`
            : `Creates a ${kind} at the library root.`
        }
        onClose={onClose}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden text-xs text-slate-400 sm:block">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              to cancel ·{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                ⌘ Enter
              </kbd>{" "}
              to create
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => void submit()}
              >
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label className="text-sm font-semibold text-slate-900" htmlFor="org-folder-name">
                Name <span className="text-brand-pink">*</span>
              </label>
              <span className="text-xs text-slate-400">
                {name.trim().length}/{NAME_MAX} characters
              </span>
            </div>
            <div className="relative">
              <Folder
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-pink"
                aria-hidden
              />
              <Input
                id="org-folder-name"
                autoFocus
                maxLength={NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Legal & Statutory Onboarding"
                className={cn(ORG_FORM_INPUT_CLASS, "pl-11")}
              />
            </div>
            {isOrgFolder ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">Suggestions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ORG_FOLDER_NAME_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setName(suggestion)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-pink/40 hover:bg-pink-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {kind === "project" ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">Suggestions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ORG_PROJECT_NAME_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setName(suggestion)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-pink/40 hover:bg-pink-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {kind === "vendor" ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500">Suggestions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ORG_VENDOR_NAME_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setName(suggestion)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-pink/40 hover:bg-pink-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {isOrgFolder ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Folder location</p>
                <p className="text-xs text-slate-500">Destination</p>
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800 transition hover:border-slate-300"
                >
                  <span className="truncate">{locationLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
                <p className="text-xs text-brand-pink">
                  <span className="font-semibold">Path:</span> {pathPreview}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Folder color accent</p>
                  <span className="text-xs font-medium text-slate-500">
                    {orgFolderAccentLabel(colorHex)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ORG_FOLDER_ACCENT_COLORS.map((swatch) => {
                    const selected = colorHex === swatch.hex;
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        aria-label={swatch.label}
                        aria-pressed={selected}
                        onClick={() => setColorHex(swatch.hex)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition",
                          selected ? "border-slate-900" : "border-white shadow-sm",
                        )}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {selected ? (
                          <Check className="h-4 w-4 text-white drop-shadow" aria-hidden />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  Colors help team members visually identify folders across lists.
                </p>
              </div>
            </div>
          ) : null}

          {isOrgFolder ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-900" htmlFor="org-folder-desc">
                  Description & scope
                </label>
                <span className="text-xs text-slate-400">(optional)</span>
              </div>
              <div className="mb-2 flex justify-end">
                <FolderDescriptionAssist
                  name={name}
                  visibility={
                    visibility === "public"
                      ? "Public, visible to all staff"
                      : visibility === "private"
                        ? "Private — only the folder creator"
                        : visibility === "company_owned"
                          ? "Company owned"
                          : `Restricted (${formatFieldLabel(restrictedScope)})`
                  }
                  description={description}
                  onDescriptionChange={setDescription}
                />
              </div>
              <textarea
                id="org-folder-desc"
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Briefly state what documents belong in this folder for staff and reviewers…"
                className="min-h-[6.5rem] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-pink focus:outline-none focus:ring-2 focus:ring-brand-pink/20"
              />
            </div>
          ) : null}

          {isOrgFolder ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Access & visibility permissions
              </p>
              <OrgFolderAccessChoiceCards
                value={visibility}
                parentAccessScope={parentAccessScope}
                onChange={(mode) => {
                  setVisibilityMode(mode);
                  if (mode !== "restricted") setScopeIds([]);
                }}
              />
              {visibility === "restricted" ? (
                <OrganizationalAccessScopeFields
                  accessScope={restrictedScope}
                  onAccessScopeChange={(value) => {
                    setRestrictedScope(value);
                    setScopeIds([]);
                    setScopeSearch("");
                  }}
                  scopeIds={scopeIds}
                  onScopeIdsChange={setScopeIds}
                  scopeSearch={scopeSearch}
                  onScopeSearchChange={setScopeSearch}
                  departments={departments}
                  grades={grades}
                  employees={employees}
                  allowedScopes={allowedAccessScopes(parentAccessScope).filter(
                    (scope) => !["all_staff", "private"].includes(scope),
                  )}
                />
              ) : null}
            </div>
          ) : null}

          {isCollection ? (
            <CollectionPotentialFilesPanel
              collectionKind={kind}
              query={name.trim()}
              items={suggested}
              loading={suggestedLoading}
              selectedIds={selectedShortcutIds}
              onSelectedIdsChange={setSelectedShortcutIds}
            />
          ) : null}
        </div>
      </FormWindowShell>

      {showLocationPicker ? (
        <OrgFolderLocationPickerDialog
          folders={foldersQuery.data ?? []}
          allowRoot
          initialFolderId={destinationParentId}
          onClose={() => setShowLocationPicker(false)}
          onPick={(folderId) => {
            setDestinationParentId(folderId ? Number(folderId) : null);
            setShowLocationPicker(false);
          }}
        />
      ) : null}
    </>
  );
}
