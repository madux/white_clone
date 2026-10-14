"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import type { OrganizationalPolicy } from "../../../lib/types";
import BulkFolderActions from "./BulkFolderActions";
import EmptyState from "./EmptyState";
import OrganizationalPolicyActions from "./OrganizationalPolicyActions";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import type { OrgPolicyTabFilters } from "../../../lib/orgLibraryFilters";
import OrgLibraryItemCardGrid from "./OrgLibraryItemCardGrid";
import { type LibraryFileRow } from "./LibraryFileTable";
import StatusPill from "./StatusPill";
import OrgFolderIcon from "./OrgFolderIcon";

function statusLabel(status: OrganizationalPolicy["lifecycle_status"]) {
  if (status === "active") return "Active";
  if (status === "archived") return "Archived";
  return "Draft";
}

function visibilityLabel(visibility: OrganizationalPolicy["policy_visibility"]) {
  return visibility === "hr_only" ? "HR only" : "Employees";
}

function statusBadgeClass(status: OrganizationalPolicy["lifecycle_status"]) {
  if (status === "draft") {
    return "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700";
  }
  if (status === "active") {
    return "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800";
  }
  return "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900";
}

export default function OrganizationalPoliciesPanel({
  search,
  policyFilters,
  viewMode = "list",
  canManageFolders = false,
  onCategoriesLoaded,
}: {
  search: string;
  policyFilters: OrgPolicyTabFilters;
  viewMode?: "list" | "cards";
  canManageFolders?: boolean;
  onCategoriesLoaded?: (categories: { value: string; label: string }[]) => void;
}) {
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [
      "organizational-policies",
      policyFilters.status,
      policyFilters.visibility,
      search,
    ],
    queryFn: async () => {
      const result = await api.listOrganizationalPolicies({
        search: search.trim() || undefined,
        status: policyFilters.status === "all" ? undefined : policyFilters.status,
        visibility:
          policyFilters.visibility === "all" ? undefined : policyFilters.visibility,
      });
      if (!result.success) {
        throw new Error(result.message || "Unable to load policies.");
      }
      return result.data?.items ?? [];
    },
  });

  const items = useMemo(() => {
    let list = query.data ?? [];
    if (policyFilters.category !== "all") {
      list = list.filter((policy) => (policy.category || "") === policyFilters.category);
    }
    if (policyFilters.hasDocument === "yes") {
      list = list.filter((policy) => Boolean(policy.document_id));
    } else if (policyFilters.hasDocument === "no") {
      list = list.filter((policy) => !policy.document_id);
    }
    return list;
  }, [policyFilters.category, policyFilters.hasDocument, query.data]);

  useEffect(() => {
    if (!onCategoriesLoaded || !query.data?.length) return;
    const values = new Set<string>();
    for (const policy of query.data) {
      const category = (policy.category || "").trim();
      if (category) values.add(category);
    }
    onCategoriesLoaded([
      { value: "all", label: "All categories" },
      ...[...values]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((value) => ({ value, label: value })),
    ]);
  }, [onCategoriesLoaded, query.data]);
  const visibleFolderIds = useMemo(
    () => items.map((policy) => policy.folder_id),
    [items],
  );
  const allSelected =
    visibleFolderIds.length > 0 &&
    visibleFolderIds.every((id) => selectedFolderIds.includes(id));

  const toggleAll = (checked: boolean) => {
    setSelectedFolderIds(checked ? visibleFolderIds : []);
  };

  const toggleRow = (folderId: number) => {
    setSelectedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId],
    );
  };

  const invalidatePolicies = async () => {
    await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
  };

  const policyCardRows = useMemo((): LibraryFileRow[] => {
    return items.map((policy) => ({
      id: String(policy.id),
      kind: "folder",
      name: policy.name,
      subtitle:
        [
          policy.category,
          visibilityLabel(policy.policy_visibility),
          policy.document_name ? policy.document_name : "No linked document",
          policy.effective_date ? `Effective ${policy.effective_date}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      folderKind: "policy",
      folderPreview: { hasContent: Boolean(policy.document_id), documents: [] },
      href: `/pages/organization/folder?folder=${policy.folder_id}`,
      modified: policy.updated_at ? policy.updated_at.slice(0, 10) : undefined,
      modifiedRaw: policy.updated_at || undefined,
      selected: selectedFolderIds.includes(policy.folder_id),
      onSelectChange: () => toggleRow(policy.folder_id),
      status: (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <StatusPill label={statusLabel(policy.lifecycle_status)} />
        </div>
      ),
      actions: (
        <OrganizationalPolicyActions
          policy={policy}
          canManage={canManageFolders}
          onChanged={async () => {
            setSelectedFolderIds((current) =>
              current.filter((id) => id !== policy.folder_id),
            );
            await invalidatePolicies();
          }}
        />
      ),
    }));
  }, [canManageFolders, items, selectedFolderIds]);

  if (query.isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-6 text-sm text-red-700">
        {(query.error as Error).message || "Unable to load policies."}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-slate-500">
        {items.length} {items.length === 1 ? "policy" : "policies"}
      </p>
      {canManageFolders && selectedFolderIds.length ? (
        <BulkFolderActions
          selected={selectedFolderIds}
          organizational
          onClear={() => {
            setSelectedFolderIds([]);
            void invalidatePolicies();
          }}
        />
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Create a policy from + New in a folder to register classified documents here."
        />
      ) : viewMode === "cards" ? (
        <OrgLibraryItemCardGrid
          rows={policyCardRows}
          selectable={canManageFolders}
          emptyTitle="No policies yet"
          emptyDescription="Create a policy from + New in a folder to register classified documents here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {canManageFolders ? (
                  <th className="w-10 px-3 py-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(value) => toggleAll(value === true)}
                      aria-label="Select all policies"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3 font-semibold">Policy</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Visibility</th>
                <th className="px-4 py-3 font-semibold">Effective</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((policy) => (
                <tr key={policy.id} className="border-t border-slate-100">
                  {canManageFolders ? (
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selectedFolderIds.includes(policy.folder_id)}
                        onCheckedChange={() => toggleRow(policy.folder_id)}
                        aria-label={`Select ${policy.name}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={`/pages/organization/folder?folder=${policy.folder_id}`}
                      className="inline-flex min-w-0 items-center gap-2.5 hover:text-brand-pink"
                    >
                      <OrgFolderIcon
                        className="h-8 w-8 shrink-0"
                        folderKind="policy"
                        hasContent={Boolean(policy.document_id)}
                      />
                      <span className="truncate">{policy.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{policy.category || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className={statusBadgeClass(policy.lifecycle_status)}>
                      {statusLabel(policy.lifecycle_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {visibilityLabel(policy.policy_visibility)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {policy.effective_date || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {policy.updated_at ? policy.updated_at.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <OrganizationalPolicyActions
                      policy={policy}
                      canManage={canManageFolders}
                      onChanged={async () => {
                        setSelectedFolderIds((current) =>
                          current.filter((id) => id !== policy.folder_id),
                        );
                        await invalidatePolicies();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
