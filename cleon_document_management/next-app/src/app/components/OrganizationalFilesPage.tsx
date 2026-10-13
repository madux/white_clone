"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCurrentUser,
  useDocumentTypes,
  useDocuments,
  useFolders,
} from "../../../hooks/useDocuments";
import { canCreateOrgFolder } from "../../../lib/organizationalFilesAccess";
import {
  computeOrgLibraryStats,
  type OrgLibraryKindFilter,
} from "../../../lib/orgLibraryStats";
import {
  INITIAL_ORG_DOCUMENT_TAB_FILTERS,
  INITIAL_ORG_FOLDER_FILTERS,
  INITIAL_ORG_POLICY_TAB_FILTERS,
  orgFolderTreeVisibleIds,
  uniqueOrgFolderOptions,
  type OrgDocumentTabFilters,
  type OrgFolderFilters,
  type OrgPolicyTabFilters,
} from "../../../lib/orgLibraryFilters";
import LibraryBreadcrumb, { type LibraryCrumb } from "./LibraryBreadcrumb";
import OrgLibrarySummaryCards from "./OrgLibrarySummaryCards";
import OrgFolderNavTree from "./OrgFolderNavTree";
import OrgFolderInspector from "./OrgFolderInspector";
import OrgLibraryRootContents from "./OrgLibraryRootContents";
import OrgLibraryDocumentsContents from "./OrgLibraryDocumentsContents";
import OrganizationFolderPage from "./OrganizationFolderPage";
import OrganizationalPoliciesPanel from "./OrganizationalPoliciesPanel";
import OrganizationalLibraryAdminLinks from "./OrganizationalLibraryAdminLinks";
import OrgLibraryFilterBar from "./OrgLibraryFilterBar";
import AppToolbar from "./AppToolbar";

type ContentViewMode = "list" | "card";

export default function OrganizationalFilesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const folders = useFolders();
  const documentTypes = useDocumentTypes();
  const currentUser = useCurrentUser();

  const folderIdParam = Number(params.get("folder") || 0);
  const activeFolderId = folderIdParam > 0 ? folderIdParam : null;
  const [kindFilter, setKindFilter] = useState<OrgLibraryKindFilter>(() =>
    params.get("tab") === "policies" ? "policy" : "all",
  );

  useEffect(() => {
    const wantsPolicies = params.get("tab") === "policies";
    setKindFilter((prev) => {
      if (wantsPolicies && prev !== "policy") return "policy";
      if (!wantsPolicies && prev === "policy") return "all";
      return prev;
    });
  }, [params]);

  const [treeSearch, setTreeSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [viewMode, setViewMode] = useState<ContentViewMode>("card");
  const [folderViewMode, setFolderViewMode] = useState<"list" | "cards">("cards");
  const [folderFilters, setFolderFilters] = useState<OrgFolderFilters>(
    INITIAL_ORG_FOLDER_FILTERS,
  );
  const [documentTabFilters, setDocumentTabFilters] = useState<OrgDocumentTabFilters>(
    INITIAL_ORG_DOCUMENT_TAB_FILTERS,
  );
  const [policyTabFilters, setPolicyTabFilters] = useState<OrgPolicyTabFilters>(
    INITIAL_ORG_POLICY_TAB_FILTERS,
  );
  const [policyCategories, setPolicyCategories] = useState<
    { value: string; label: string }[]
  >([{ value: "all", label: "All categories" }]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const canCreateFolder = canCreateOrgFolder(currentUser.data);

  useEffect(() => {
    setFiltersExpanded(false);
  }, [kindFilter, activeFolderId]);

  const stats = useMemo(
    () => computeOrgLibraryStats(folders.data ?? []),
    [folders.data],
  );

  const activeFolder = useMemo(
    () =>
      activeFolderId
        ? (folders.data ?? []).find((item) => item.id === activeFolderId)
        : undefined,
    [activeFolderId, folders.data],
  );

  const folderDocuments = useDocuments(activeFolderId ?? undefined, true);

  const folderOptions = useMemo(
    () => uniqueOrgFolderOptions(folders.data ?? []),
    [folders.data],
  );

  const treeVisibleIds = useMemo(
    () =>
      orgFolderTreeVisibleIds(folders.data ?? [], kindFilter, folderFilters),
    [folderFilters, folders.data, kindFilter],
  );

  const basePath = pathname?.includes("/folder")
    ? "/pages/organization/folder"
    : "/pages/organization";

  const setFolderInUrl = useCallback(
    (folderId: number | null) => {
      const next = new URLSearchParams(params.toString());
      if (folderId) next.set("folder", String(folderId));
      else next.delete("folder");
      const query = next.toString();
      router.replace(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, params, router],
  );

  const breadcrumbItems = useMemo((): LibraryCrumb[] => {
    const items: LibraryCrumb[] = [
      { label: "Document Management", href: "/pages/organization" },
      { label: "Organizational Files", href: basePath },
    ];
    if (activeFolder) {
      items.push({ label: activeFolder.folder_name });
    }
    return items;
  }, [activeFolder, basePath]);

  const searchPlaceholder = useMemo(() => {
    if (kindFilter === "policy") return "Search policies…";
    if (kindFilter === "documents" && !activeFolderId) return "Search documents…";
    if (activeFolderId) return "Search in this folder…";
    return "Search folders…";
  }, [activeFolderId, kindFilter]);

  const filterBarProps = {
    kindFilter,
    folderFilters,
    onFolderFiltersChange: setFolderFilters,
    documentFilters: documentTabFilters,
    onDocumentFiltersChange: setDocumentTabFilters,
    policyFilters: policyTabFilters,
    onPolicyFiltersChange: setPolicyTabFilters,
    documentTypes: documentTypes.data ?? [],
    policyCategories,
    folderOptions,
    expanded: filtersExpanded,
    onExpandedChange: setFiltersExpanded,
  };

  return (
    <div className="app-page space-y-5">
      <LibraryBreadcrumb items={breadcrumbItems} />

      <OrgLibrarySummaryCards
        stats={stats}
        active={kindFilter}
        onChange={(filter) => {
          setKindFilter(filter);
          const next = new URLSearchParams(params.toString());
          if (filter === "policy") next.set("tab", "policies");
          else next.delete("tab");
          const query = next.toString();
          router.replace(query ? `${basePath}?${query}` : basePath);
        }}
      />

      <OrganizationalLibraryAdminLinks />

      {kindFilter === "policy" ? (
        <section className="app-table-well app-page-body">
          <AppToolbar
            search={contentSearch}
            onSearchChange={setContentSearch}
            searchPlaceholder={searchPlaceholder}
            extras={
              <OrgLibraryFilterBar {...filterBarProps} part="trigger" />
            }
            footer={
              filtersExpanded ? (
                <OrgLibraryFilterBar {...filterBarProps} part="panel" />
              ) : undefined
            }
          />
          <OrganizationalPoliciesPanel
            search={contentSearch}
            policyFilters={policyTabFilters}
            viewMode={viewMode === "card" ? "cards" : "list"}
            canManageFolders={
              currentUser.data?.is_document_manager === true || canCreateFolder
            }
            onCategoriesLoaded={setPolicyCategories}
          />
        </section>
      ) : (
        <div className="org-library-shell flex min-h-[min(72vh,52rem)] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:gap-6 lg:p-5">
          <div className="w-full shrink-0 lg:w-60 xl:w-72">
            <OrgFolderNavTree
              folders={folders.data ?? []}
              activeFolderId={activeFolderId}
              kindFilter={kindFilter}
              search={treeSearch}
              onSearchChange={setTreeSearch}
              onSelectFolder={setFolderInUrl}
              treeVisibleIds={treeVisibleIds}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white lg:border-0">
            <AppToolbar
              search={contentSearch}
              onSearchChange={setContentSearch}
              searchPlaceholder={searchPlaceholder}
              extras={
                activeFolderId ? undefined : (
                  <OrgLibraryFilterBar {...filterBarProps} part="trigger" />
                )
              }
              footer={
                !activeFolderId && filtersExpanded ? (
                  <OrgLibraryFilterBar {...filterBarProps} part="panel" />
                ) : undefined
              }
            />
            {activeFolderId && activeFolder ? (
              <OrganizationFolderPage
                embedded
                folderId={activeFolderId}
                viewMode={folderViewMode}
                onViewModeChange={setFolderViewMode}
                onNavigateToFolder={setFolderInUrl}
                contentSearch={contentSearch}
                onContentSearchChange={setContentSearch}
              />
            ) : kindFilter === "documents" ? (
              <OrgLibraryDocumentsContents
                search={contentSearch}
                documentFilters={documentTabFilters}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            ) : (
              <OrgLibraryRootContents
                folders={folders.data ?? []}
                kindFilter={kindFilter}
                search={contentSearch}
                folderFilters={folderFilters}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onOpenFolder={(id) => setFolderInUrl(id)}
              />
            )}
          </div>

          {activeFolder ? (
            <div className="hidden w-full shrink-0 xl:block xl:w-80 2xl:w-96">
              <OrgFolderInspector
                folder={activeFolder}
                folderDocuments={folderDocuments.data ?? []}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
