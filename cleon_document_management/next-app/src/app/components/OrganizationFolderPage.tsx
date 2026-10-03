"use client";

import {
  Archive,
  ChevronDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Lock,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useCurrentUser,
  useDocumentTypes,
  useDocuments,
  useFolders,
} from "../../../hooks/useDocuments";
import {
  canAccessOrgArchived,
  canCreateOrgFolder,
  canCreateOrgPolicy,
  canManageOrgDocuments,
  canUploadOrgDocuments,
} from "../../../lib/organizationalFilesAccess";
import OrganizationalPolicyActions from "./OrganizationalPolicyActions";
import DocumentActions from "./DocumentActions";
import BulkDocumentActions from "./BulkDocumentActions";
import BulkFolderActions from "./BulkFolderActions";
import MoveDocumentsDialog from "./MoveDocumentsDialog";
import DocumentViewerDialog from "./DocumentViewerDialog";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import FolderPickerDialog from "./FolderPickerDialog";
import { folderIdsWithDescendants } from "./FolderTreePicker";

import DocumentFilterBar, {
  FilterState,
  INITIAL_FILTER_STATE,
  applyDocumentFilters,
} from "./DocumentFilterBar";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import OrgFolderIcon from "./OrgFolderIcon";
import OrganizationalNewMenu from "./OrganizationalNewMenu";
import FolderActions from "./FolderActions";
import StatusPill from "./StatusPill";
import { Button } from "@/components/ui/button";
import { sortLibraryFileRows } from "../../../lib/libraryTableSort";
import { isOrgDocumentLinkedToPolicy } from "../../../lib/policyDocumentName";

function folderKindLabel(kind?: string) {
  if (kind === "project") return "Project";
  if (kind === "vendor") return "Vendor";
  if (kind === "policy") return "Policy";
  return "Folder";
}

export default function OrganizationFolderPage() {
  const params = useSearchParams();
  const router = useRouter();
  const folderId = Number(params.get("folder"));
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined, true);
  const types = useDocumentTypes();
  const currentUser = useCurrentUser();
  const { showAlert } = useAppDialog();
  const canUpload = canUploadOrgDocuments(currentUser.data);
  const canCreateFolder = canCreateOrgFolder(currentUser.data);
  const canManagePolicy = canManageOrgDocuments(currentUser.data);
  const canViewArchived = canAccessOrgArchived(currentUser.data);
  const folder = folders.data?.find((item) => item.id === folderId);
  const policyRegistry = useQuery({
    queryKey: ["organizational-policy-by-folder", folderId],
    enabled: Boolean(folderId) && folder?.folder_kind === "policy",
    queryFn: async () => {
      const result = await api.listOrganizationalPolicies({});
      if (!result.success) {
        throw new Error(result.message || "Unable to load policy.");
      }
      return (result.data?.items ?? []).find((item) => item.folder_id === folderId);
    },
  });
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [librarySortKey, setLibrarySortKey] = useState("name asc");
  const [viewing, setViewing] = useState<any>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [movingIds, setMovingIds] = useState<number[] | null>(null);
  const [movingFolders, setMovingFolders] = useState(false);
  const [movingFoldersPending, setMovingFoldersPending] = useState(false);
  const folderLocked = Boolean(folder?.locked);
  const canUploadHere = canUpload && !folderLocked;
  const visibleDocuments = useMemo(
    () => applyDocumentFilters(documents.data ?? [], filters),
    [documents.data, filters],
  );
  const childFolders = useMemo(
    () =>
      (folders.data ?? []).filter(
        (item) =>
          item.folder_type === "organizational" &&
          Number(item.parent_id || 0) === folderId,
      ),
    [folderId, folders.data],
  );

  useEffect(() => {
    const docId = Number(params.get("doc") || 0);
    if (!docId || !documents.data?.length) return;
    const match = documents.data.find((document) => document.id === docId);
    if (match) setViewing(match);
  }, [documents.data, params]);

  const query = filters.search.trim().toLowerCase();
  const visibleChildFolders = childFolders.filter((item) => {
    if (!query) return true;
    return `${item.folder_name} ${item.description || ""}`.toLowerCase().includes(query);
  });
  const visibleIds = visibleDocuments.map((document) => document.id);
  const visibleFolderIds = visibleChildFolders.map((item) => item.id);
  const allSelected =
    visibleIds.length + visibleFolderIds.length > 0 &&
    visibleIds.every((id) => selectedDocumentIds.includes(id)) &&
    visibleFolderIds.every((id) => selectedFolderIds.includes(id));
  const toggleSelectedDocument = (id: number) =>
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const toggleSelectedFolder = (id: number) =>
    setSelectedFolderIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  const childFolderCountByParent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of folders.data ?? []) {
      if (entry.folder_type !== "organizational") continue;
      const parentId = Number(entry.parent_id || 0);
      if (!parentId) continue;
      counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    }
    return counts;
  }, [folders.data]);

  const folderRows: LibraryFileRow[] = visibleChildFolders.map((item) => {
    const itemCount =
      (item.document_count || 0) + (childFolderCountByParent.get(item.id) ?? 0);
    return {
      id: `folder-${item.id}`,
      kind: "folder",
      folderPreview: { hasContent: itemCount > 0, documents: [] },
      folderKind: item.folder_kind,
      name: item.folder_name,
      subtitle: `${folderKindLabel(item.folder_kind)}${item.collection_code ? ` · ${item.collection_code}` : ""} · ${itemCount} items`,
      href: `/pages/organization/folder?folder=${item.id}`,
      extra: item.locked ? (
        <Lock className="size-3.5 text-muted-foreground" />
      ) : null,
      selected: selectedFolderIds.includes(item.id),
      onSelectChange: () => toggleSelectedFolder(item.id),
      description: item.description || "",
      documentsCount: itemCount,
    owner: item.owner_name || "—",
    modified: formatDocumentDate(item.last_modified),
    modifiedRaw: item.last_modified || undefined,
    status: <StatusPill label={item.locked ? "Locked" : "Active"} />,
      actions: (
        <FolderActions
          folderId={item.id}
          folderName={item.folder_name}
          description={item.description}
          locked={item.locked}
          folderType={item.folder_type}
          accessScope={item.access_scope}
          departmentIds={item.department_ids}
          gradeIds={item.grade_ids}
          employeeIds={item.employee_ids}
          colorHex={item.color_hex}
          folderKind={item.folder_kind}
          organizeBy={item.organize_by}
          requireUploadApproval={item.require_upload_approval}
          approvalFlow={item.approval_flow}
        />
      ),
    };
  });

  const fileRows: LibraryFileRow[] = visibleDocuments.map((document) => ({
    id: String(document.id),
    kind: "file",
    isShortcut: Boolean(document.is_shortcut),
    fileMeta: {
      name: document.name,
      mime_type: document.mime_type,
      document_type: document.document_type,
      source_url: document.source_url,
    },
    name: document.name,
    subtitle: [
      document.source_url
        ? `Link · ${document.document_type || "URL"}`
        : document.document_type || document.description || "",
      document.organizational_policy_name
        ? `Policy: ${document.organizational_policy_name}`
        : document.is_policy
          ? "Policy document"
          : "",
    ]
      .filter(Boolean)
      .join(" · ") || undefined,
    onOpen: () => {
      if (document.source_url) {
        window.open(document.source_url, "_blank", "noopener,noreferrer");
        return;
      }
      const editorId = Number(document.policy_editor_document_id || 0);
      if (editorId > 0) {
        const qs = new URLSearchParams({
          document: String(editorId),
          hr_document: String(document.id),
          folder: String(folderId),
        });
        router.push(`/pages/organization/policy-editor?${qs.toString()}`);
        return;
      }
      setViewing(document);
    },
    owner: folder?.owner_name || "—",
    modified: formatDocumentDate(document.write_date),
    modifiedRaw: document.write_date || undefined,
    selected: selectedDocumentIds.includes(document.id),
    onSelectChange: () => toggleSelectedDocument(document.id),
    extra: folderLocked ? <Lock className="size-3.5 text-muted-foreground" /> : null,
    description: document.description || "",
    status: (
      <div className="flex flex-wrap items-center gap-1">
        {document.is_shortcut ? (
          <StatusPill label="Shortcut" tone="info" />
        ) : null}
        {isOrgDocumentLinkedToPolicy(document) ? (
          <StatusPill label="Linked to policy" tone="info" />
        ) : null}
        <StatusPill
          label={
            document.link_status === "broken"
              ? "Broken link"
              : document.active === false
                ? "Inactive"
                : "Active"
          }
          tone={document.link_status === "broken" ? "danger" : undefined}
        />
      </div>
    ),
    actions: (
      <DocumentActions
        documentId={document.id}
        documentName={document.name}
        document={document}
        active={document.active !== false}
        organizational
        folderId={folderId}
        folderLocked={folderLocked}
        sourceUrl={document.source_url}
        linkStatus={document.link_status}
        orgUseFolderAccess={document.org_use_folder_access !== false}
        orgAccessScope={document.org_access_scope}
        orgDepartmentIds={document.org_department_ids ?? []}
        orgGradeIds={document.org_grade_ids ?? []}
        orgEmployeeIds={document.org_employee_ids ?? []}
        onMove={() => setMovingIds([document.id])}
      />
    ),
  }));

  const mixedRows = sortLibraryFileRows(
    [...folderRows, ...fileRows],
    librarySortKey,
  );

  return (
    <div className="app-page space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        {folder ? (
          <OrgFolderIcon
            className="h-10 w-10 shrink-0"
            folderKind={folder.folder_kind}
            hasContent={
              (documents.data?.length ?? 0) > 0 || visibleChildFolders.length > 0
            }
            documents={documents.data ?? []}
          />
        ) : null}
        <LibraryBreadcrumb
          items={[
            { label: "Organizational Files", href: "/pages/organization" },
            {
              label: folder?.collection_code
                ? `${folder.folder_name} (${folder.collection_code})`
                : folder?.folder_name || "Folder",
            },
          ]}
        />
      </div>
      {folder?.folder_kind === "policy" &&
      policyRegistry.data?.lifecycle_status === "draft" &&
      canManagePolicy ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>
            <strong className="font-semibold text-slate-900">Draft policy.</strong>{" "}
            Hidden from Shared Documents until you activate it.
          </p>
          <OrganizationalPolicyActions
            policy={policyRegistry.data}
            canManage={canManagePolicy}
            minimal
            onChanged={() => void policyRegistry.refetch()}
          />
        </div>
      ) : null}
      <section className="app-table-well app-page-body">
        <DocumentFilterBar
          filters={filters}
          onChange={setFilters}
          availableTypes={types.data ?? []}
          showDepartmentFilter={false}
          showOrgPolicyFilter
          totalCount={(documents.data?.length ?? 0) + childFolders.length}
          filteredCount={mixedRows.length}
          extras={null}
          actions={
            <>
              {canViewArchived ? (
                <Button variant="outline" render={<Link href={myWorkspaceHref("archived")} />}>
                  Archived
                </Button>
              ) : null}
              <OrganizationalNewMenu
                parentFolder={folder}
                folderLocked={folderLocked}
                canUpload={canUploadHere}
                canCreateFolder={canCreateFolder && !folderLocked}
                canCreatePolicy={canCreateOrgPolicy(currentUser.data)}
                folderDocuments={documents.data ?? []}
              />
            </>
          }
        />
        <div className="space-y-2">
          <BulkFolderActions
            selected={selectedFolderIds}
            onClear={() => setSelectedFolderIds([])}
            organizational
            onMove={folderLocked ? undefined : () => setMovingFolders(true)}
          />
          <BulkDocumentActions
            selected={selectedDocumentIds}
            onClear={() => setSelectedDocumentIds([])}
            documents={visibleDocuments}
            organizational
            onMove={folderLocked ? undefined : () => setMovingIds(selectedDocumentIds)}
          />
        </div>
        <LibraryFileTable
          rows={mixedRows}
          sortKey={librarySortKey}
          onSortChange={setLibrarySortKey}
          loading={documents.isLoading || folders.isLoading}
          selectable
          showOwner
          allSelected={allSelected}
          onToggleAll={(checked) => {
            setSelectedFolderIds(checked ? visibleFolderIds : []);
            setSelectedDocumentIds(checked ? visibleIds : []);
          }}
          showStatus
          showDescription
          showDocuments
          emptyTitle={
            folder?.folder_kind === "policy" ? "No policy documents yet" : "This folder is empty"
          }
          emptyDescription={
            folder?.folder_kind === "policy"
              ? "Use + New to upload, add from the library, or create a custom policy file."
              : "Upload a document, add a link, or create a subfolder."
          }
          emptyAction={
            canUploadHere || canCreateFolder ? (
              <OrganizationalNewMenu
                parentFolder={folder}
                folderLocked={folderLocked}
                canUpload={canUploadHere}
                canCreateFolder={canCreateFolder && !folderLocked}
                canCreatePolicy={canCreateOrgPolicy(currentUser.data)}
                folderDocuments={documents.data ?? []}
              />
            ) : undefined
          }
        />
      </section>
      {viewing && (
        <DocumentViewerDialog
          title={viewing.name}
          description={[
            viewing.document_type,
            viewing.id ? `ID ${viewing.id}` : "",
            viewing.owner_name || folder?.owner_name,
            viewing.folder_path?.map((item: { name: string }) => item.name).join(" / "),
            viewing.source_url ? `Source ${viewing.source_url}` : "",
            viewing.linked_template_document_id ? "Created from template" : "",
            viewing.imported_from ? `Imported from ${viewing.imported_from}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={() => setViewing(null)}
          documentId={viewing.id}
          linkedPolicyId={viewing.linked_policy_id}
          linkedPolicyName={viewing.linked_policy_name}
          isShortcut={viewing.is_shortcut}
          shortcutOfId={viewing.shortcut_of_id}
          shortcutOfName={viewing.shortcut_of_name}
          shortcutOfFolderId={viewing.shortcut_of_folder_id}
          currentVersionNumber={viewing.version_number}
          previewUrl={`${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`}
          size="5xl"
          backdropClassName="bg-slate-900/40"
          iframeMinHeight="min-h-[65vh]"
          enableAiSummary
          headerActions={
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/pages/document-intelligence/ask?document=${viewing.id}`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-brand-pink px-3 py-2 text-xs font-bold text-brand-pink hover:bg-pink-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </button>
            </>
          }
        />
      )}
      {movingIds && (
        <MoveDocumentsDialog
          documentIds={movingIds}
          folders={folders.data ?? []}
          folderType="organizational"
          onClose={() => setMovingIds(null)}
          onMoved={() => {
            setMovingIds(null);
            setSelectedDocumentIds([]);
          }}
        />
      )}
      {movingFolders ? (
        <FolderPickerDialog
          title="Move folders"
          folders={folders.data ?? []}
          excludeIds={folderIdsWithDescendants(folders.data ?? [], selectedFolderIds)}
          allowRoot
          confirmLabel="Move"
          pending={movingFoldersPending}
          onClose={() => setMovingFolders(false)}
          onPick={async (parentId) => {
            setMovingFoldersPending(true);
            try {
              for (const id of selectedFolderIds) {
                const result = await api.moveOrganizationalFolder({
                  folder_id: id,
                  parent_id: parentId || false,
                });
                if (!result.success) {
                  await showAlert(result.message || "Unable to move this folder.", {
                    title: "Move folders",
                  });
                  return;
                }
              }
              setMovingFolders(false);
              setSelectedFolderIds([]);
            } finally {
              setMovingFoldersPending(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
