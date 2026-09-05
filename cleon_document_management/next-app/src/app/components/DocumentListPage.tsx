"use client";

import {
  Check,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderOpen,
  Grid2X2,
  List,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useCreateFolder,
  useCurrentUser,
  useDocumentTypes,
  useDocuments,
  useFolders,
  useComplianceTargets,
} from "../../../hooks/useDocuments";
import FolderActions from "./FolderActions";
import BulkFolderActions from "./BulkFolderActions";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";

type PageKind = "employee" | "organization" | "organizational";
type ViewMode = "list" | "cards";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.replace(" ", "T")));

export default function DocumentListPage({ kind }: { kind: PageKind }) {
  const folders = useFolders();
  const documents = useDocuments();
  const currentUser = useCurrentUser();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<number[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const visibleFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (folders.data ?? [])
      .filter(
        (folder) =>
          folder.folder_type ===
          (kind === "employee" ? "employee" : "organizational"),
      )
      .filter(
        (folder) =>
          !query ||
          `${folder.folder_name} ${folder.description}`
            .toLowerCase()
            .includes(query),
      );
  }, [folders.data, kind, search]);

  const rows = useMemo(
    () =>
      visibleFolders.map((folder) => {
        const folderDocuments = (documents.data ?? []).filter(
          (document) => document.folder_id === folder.id,
        );
        const employeeIds = new Set(
          folderDocuments
            .map((document) => document.employee_id)
            .filter(Boolean),
        );
        const approved = folderDocuments.filter(
          (document) =>
            document.approval_state === "approved" ||
            document.approval_state === "not_required",
        ).length;
        return {
          folder,
          documents: folderDocuments,
          employees: employeeIds.size,
          compliance: folderDocuments.length
            ? Math.round((approved / folderDocuments.length) * 100)
            : 0,
        };
      }),
    [documents.data, visibleFolders],
  );

  const filteredRows = rows;
  const isLoading = folders.isLoading || documents.isLoading;
  const pageTitle =
    kind === "employee" ? "Employee Files" : "Organizational Files";
  const pageDescription =
    kind === "employee"
      ? "Manage employee records, contracts, and identity documents in one secure workspace."
      : "Keep company policies, finance evidence, and operational records organized.";
  const visibleIds = filteredRows.map(({ folder }) => folder.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-slate-900">
            {pageTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {pageDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kind === "employee" && (
            <Link
              href="/pages/compliance"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-pink hover:text-brand-pink"
            >
              <ShieldCheck className="h-4 w-4" />
              Compliance
            </Link>
          )}
          {currentUser.data?.is_document_manager !== false && (
            <button
              type="button"
              onClick={() => setShowCreateFolder(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 transition hover:shadow-pink-300"
            >
              <FilePlus2 className="h-4 w-4" />
              Create Folder
            </button>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                kind === "employee"
                  ? "Search employees, folders..."
                  : "Search folders, policies..."
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${viewMode === "list" ? "bg-white text-brand-pink shadow-sm" : "text-slate-400"}`}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${viewMode === "cards" ? "bg-white text-brand-pink shadow-sm" : "text-slate-400"}`}
              >
                <Grid2X2 className="h-4 w-4" />
                Cards
              </button>
            </div>
          </div>
        </div>
        <div className="px-4 pt-4">
          <BulkFolderActions
            selected={selected}
            onClear={() => setSelected([])}
          />
        </div>

        {(folders.error || documents.error) && (
          <p className="m-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Unable to load this library.
          </p>
        )}
        {isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <SortableTable className="w-full min-w-[800px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="w-12 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : visibleIds)
                      }
                      aria-label="Select all folders"
                      className="h-4 w-4 accent-pink-600"
                    />
                  </th>
                  <th className="px-5 py-4 font-bold">Folder</th>
                  {kind === "employee" && (
                    <th className="px-5 py-4 font-bold">Employees</th>
                  )}
                  <th className="px-5 py-4 font-bold">Documents</th>
                  {kind === "employee" && (
                    <th className="px-5 py-4 font-bold">Compliance</th>
                  )}
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(
                  ({
                    folder,
                    documents: folderDocuments,
                    employees,
                    compliance,
                  }) => {
                    const row = (
                      <>
                        <td className="w-12 px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selected.includes(folder.id)}
                            onChange={() => toggleSelected(folder.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select ${folder.folder_name}`}
                            className="h-4 w-4 accent-pink-600"
                          />
                        </td>
                        <td className="px-5 py-4">
                          {kind === "employee" ? (
                            <Link
                              href={`/pages/employee/folder?folder=${folder.id}`}
                              className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-pink/20"
                            >
                              <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {folder.folder_name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Updated {formatDate(folder.last_modified)}
                                </p>
                              </div>
                            </Link>
                          ) : (
                            <Link
                              href={`/pages/organization/folder?folder=${folder.id}`}
                              className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-pink/20"
                            >
                              <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {folder.folder_name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  Updated {formatDate(folder.last_modified)}
                                </p>
                              </div>
                            </Link>
                          )}
                        </td>
                        {kind === "employee" && (
                          <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                            <span className="inline-flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              {employees}
                            </span>
                          </td>
                        )}
                        <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            {folderDocuments.length}
                          </span>
                        </td>
                        {kind === "employee" && (
                          <td className="px-5 py-4">
                            <div className="flex min-w-[180px] items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-pink-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-brand-text to-brand-pink"
                                  style={{ width: `${compliance}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-brand-text">
                                {compliance}%
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <FolderActions
                              folderId={folder.id}
                              folderName={folder.folder_name}
                              description={folder.description}
                              locked={folder.locked}
                            />
                            {kind === "employee" ? (
                              <Link
                                href={`/pages/employee/folder?folder=${folder.id}`}
                                aria-label={`Open ${folder.folder_name}`}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            ) : (
                              <Link
                                href={`/pages/organization/folder?folder=${folder.id}`}
                                aria-label={`Open ${folder.folder_name}`}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            )}
                          </div>
                        </td>
                      </>
                    );
                    return (
                      <tr
                        key={folder.id}
                        className="group transition hover:bg-pink-50/30"
                      >
                        {row}
                      </tr>
                    );
                  },
                )}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map(
              ({
                folder,
                documents: folderDocuments,
                employees,
                compliance,
              }) => (
                <article
                  key={folder.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-pink/30 hover:shadow-lg hover:shadow-pink-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(folder.id)}
                        onChange={() => toggleSelected(folder.id)}
                        aria-label={`Select ${folder.folder_name}`}
                        className="h-4 w-4 accent-pink-600"
                      />
                      <div className="rounded-xl bg-pink-50 p-3 text-brand-pink">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                    </div>
                    {kind === "employee" && (
                      <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-bold text-brand-text">
                        {compliance}%
                      </span>
                    )}
                  </div>
                  <h2 className="mt-5 font-bold text-slate-900">
                    <Link
                      href={
                        kind === "employee"
                          ? `/pages/employee/folder?folder=${folder.id}`
                          : `/pages/organization/folder?folder=${folder.id}`
                      }
                      className="hover:text-brand-pink"
                    >
                      {folder.folder_name}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                    {folder.description}
                  </p>
                  <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                    {kind === "employee" && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-brand-pink" />
                        {employees} employees
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-brand-pink" />
                      {folderDocuments.length} documents
                    </span>
                  </div>
                  {kind === "employee" && (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-pink-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-text to-brand-pink"
                        style={{ width: `${compliance}%` }}
                      />
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        )}
        {!isLoading && !filteredRows.length && (
          <div className="p-12 text-center">
            <Check className="mx-auto h-8 w-8 rounded-full bg-pink-50 p-1.5 text-brand-pink" />
            <p className="mt-3 font-semibold text-slate-700">
              No folders found
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different search.
            </p>
          </div>
        )}
      </section>
      {showCreateFolder && (
        <FolderCreateModal
          kind={kind === "organization" ? "organizational" : kind}
          onClose={() => setShowCreateFolder(false)}
        />
      )}
    </div>
  );
}

function FolderCreateModal({
  kind,
  onClose,
}: {
  kind: PageKind;
  onClose: () => void;
}) {
  const create = useCreateFolder();
  const documentTypes = useDocumentTypes();
  const targets = useComplianceTargets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessScope, setAccessScope] = useState(
    kind === "employee" ? "individual" : "all_staff",
  );
  const [retention, setRetention] = useState("7");
  const [approval, setApproval] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<number[]>([]);
  const [folderBasis, setFolderBasis] = useState("individual");
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeSearch, setScopeSearch] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await create.mutateAsync({
      nameElm: name.trim(),
      descriptionElm: description.trim(),
      folder_type: kind,
      access_scope: accessScope,
      retention_period: retention,
      require_upload_approval: approval,
      allowed_document_type_ids: allowedTypes,
      folder_basis: folderBasis,
      employee_ids: folderBasis === "individual" ? scopeIds : [],
      department_ids: folderBasis === "department" ? scopeIds : [],
      grade_ids: folderBasis === "grade" ? scopeIds : [],
    });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
              {kind === "employee"
                ? "Employee folder"
                : "Organizational folder"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Create folder
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
          >
            ×
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={kind === "employee" ? "sm:col-span-2" : ""}>
            <span className="label">Folder name</span>
            <input
              required
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {kind === "organizational" && (
            <>
              <label>
                <span className="label">Access scope</span>
                <ThemedSelect value={accessScope} onChange={setAccessScope} options={[{ value: "all_staff", label: "All staff" }, { value: "admin_only", label: "Admin only" }]} />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Description</span>
                <textarea
                  className="field min-h-24"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what belongs in this folder"
                />
              </label>
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  Advanced configuration{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="label">Retention period</span>
                    <ThemedSelect value={retention} onChange={setRetention} options={[{ value: "1", label: "1 year" }, { value: "3", label: "3 years" }, { value: "5", label: "5 years" }, { value: "7", label: "7 years" }, { value: "10", label: "10 years" }, { value: "permanent", label: "Permanent" }]} />
                  </label>
                  <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={approval}
                      onChange={(event) => setApproval(event.target.checked)}
                      className="h-4 w-4 accent-pink-600"
                    />{" "}
                    Require upload approval
                  </label>
                  {kind === "organizational" && (
                    <label className="sm:col-span-2">
                      <span className="label">
                        Allowed document types{" "}
                        <span className="font-normal text-slate-400">
                          (optional)
                        </span>
                      </span>
                      <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                        {(documentTypes.data ?? []).map((item: any) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={allowedTypes.includes(item.id)}
                              onChange={() =>
                                setAllowedTypes(
                                  allowedTypes.includes(item.id)
                                    ? allowedTypes.filter(
                                        (id) => id !== item.id,
                                      )
                                    : [...allowedTypes, item.id],
                                )
                              }
                              className="h-4 w-4 accent-pink-600"
                            />
                            {item.name}
                          </label>
                        ))}
                      </div>
                    </label>
                  )}
                </div>
              </details>
            </>
          )}
          {kind === "employee" && (
            <div className="sm:col-span-2 rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
              <span className="label">Add employees to this folder</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {[['individual', 'Select employees'], ['department', 'By department'], ['grade', 'By grade']].map(([value, label]) => <button key={value} type="button" onClick={() => { setFolderBasis(value); setScopeIds([]); }} className={`rounded-full px-3 py-2 text-xs font-bold ${folderBasis === value ? 'bg-gradient-to-r from-brand-text to-brand-pink text-white' : 'bg-white text-slate-600'}`}>{label}</button>)}
              </div>
              <input value={scopeSearch} onChange={(event) => setScopeSearch(event.target.value)} placeholder={`Search ${folderBasis === 'department' ? 'departments' : folderBasis === 'grade' ? 'grades' : 'employees'}...`} className="field mt-3" />
              <div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                {(folderBasis === 'department' ? targets.data?.departments : folderBasis === 'grade' ? targets.data?.grades : targets.data?.employees)?.filter((item: any) => item.name.toLowerCase().includes(scopeSearch.toLowerCase())).map((item: any) => <label key={item.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"><input type="checkbox" checked={scopeIds.includes(item.id)} onChange={() => setScopeIds(scopeIds.includes(item.id) ? scopeIds.filter((id) => id !== item.id) : [...scopeIds, item.id])} className="h-4 w-4 accent-pink-600" />{item.name}</label>)}
              </div>
              <p className="mt-2 text-xs text-slate-500">{folderBasis === 'individual' ? 'Selected employees will be added immediately.' : 'Every active employee matching the selected scope will be added immediately.'}</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
          >
            Cancel
          </button>
          <button
            disabled={create.isPending}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
          >
            {create.isPending ? "Creating..." : "Create folder"}
          </button>
        </div>
      </form>
    </div>
  );
}
