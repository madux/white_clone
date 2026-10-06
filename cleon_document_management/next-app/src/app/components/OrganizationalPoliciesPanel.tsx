"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { QUERY_KEYS } from "../../../hooks/useDocuments";
import type { OrganizationalPolicy } from "../../../lib/types";
import AppSelect from "./AppSelect";
import BulkFolderActions from "./BulkFolderActions";
import EmptyState from "./EmptyState";
import OrganizationalPolicyActions from "./OrganizationalPolicyActions";
import OrgFolderIcon from "./OrgFolderIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

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
  viewMode = "list",
  canManageFolders = false,
}: {
  search: string;
  viewMode?: "list" | "cards";
  canManageFolders?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["organizational-policies", statusFilter, search],
    queryFn: async () => {
      const result = await api.listOrganizationalPolicies({
        search: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      if (!result.success) {
        throw new Error(result.message || "Unable to load policies.");
      }
      return result.data?.items ?? [];
    },
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
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
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Status
          <AppSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
        </label>
        <p className="text-sm text-slate-500">
          {items.length} {items.length === 1 ? "policy" : "policies"}
        </p>
      </div>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((policy) => (
            <article
              key={policy.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-pink/30 hover:shadow-lg hover:shadow-pink-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  {canManageFolders ? (
                    <Checkbox
                      checked={selectedFolderIds.includes(policy.folder_id)}
                      onCheckedChange={() => toggleRow(policy.folder_id)}
                      aria-label={`Select ${policy.name}`}
                      className="mt-1"
                    />
                  ) : null}
                  <OrgFolderIcon
                    className="h-10 w-10 shrink-0"
                    folderKind="policy"
                    hasContent={Boolean(policy.document_id)}
                  />
                </div>
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
              </div>
              <h2 className="mt-4 font-bold text-slate-900">
                <Link
                  href={`/pages/organization/folder?folder=${policy.folder_id}`}
                  className="hover:text-brand-pink"
                >
                  {policy.name}
                </Link>
              </h2>
              {policy.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                  {policy.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className={statusBadgeClass(policy.lifecycle_status)}>
                  {statusLabel(policy.lifecycle_status)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                  {visibilityLabel(policy.policy_visibility)}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-500">Category</dt>
                  <dd className="text-right">{policy.category || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-500">Effective</dt>
                  <dd className="text-right">
                    {policy.effective_date || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-500">Updated</dt>
                  <dd className="text-right">
                    {policy.updated_at ? policy.updated_at.slice(0, 10) : "—"}
                  </dd>
                </div>
                {policy.document_name ? (
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-500">Document</dt>
                    <dd className="truncate text-right">{policy.document_name}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
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
