"use client";

import {
  ArrowLeft,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAddEmployeesToFolder, useComplianceTargets, useDocuments, useFolders } from "../../../hooks/useDocuments";

export default function EmployeeFolderPage() {
  const params = useSearchParams();
  const folderId = Number(params.get("folder"));
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined);
  const targets = useComplianceTargets();
  const [search, setSearch] = useState("");
  const [showAddEmployees, setShowAddEmployees] = useState(false);
  const folder = folders.data?.find((item) => item.id === folderId);
  const employees = useMemo(() => {
    const grouped = new Map<
      number,
      { id: number; name: string; documents: typeof documents.data }
    >();
    (targets.data?.employees ?? []).filter((employee) => folder?.employee_ids?.includes(employee.id)).forEach((employee) => {
      grouped.set(employee.id, { id: employee.id, name: employee.name, documents: [] });
    });
    (documents.data ?? []).forEach((document) => {
      if (!document.employee_id) return;
      const current = grouped.get(document.employee_id) ?? {
        id: document.employee_id,
        name: document.employee_name,
        documents: [],
      };
      current.documents = [...(current.documents ?? []), document];
      grouped.set(document.employee_id, current);
    });
    return [...grouped.values()].filter((employee) =>
      employee.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [documents.data, folder?.employee_ids, search, targets.data]);

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
      <Link
        href="/pages/employee"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-pink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employee Files
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
            Employee folder
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {folder?.folder_name ?? "Employee Files"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {folder?.description ??
              "Browse employee records and their documents."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="relative block sm:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
              placeholder="Search employees..."
            />
          </label>
          {folder && <button type="button" onClick={() => setShowAddEmployees(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"><Plus className="h-4 w-4" />Add employee</button>}
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr] border-b border-slate-100 bg-slate-50 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          <span>Employee</span>
          <span>Documents</span>
          <span>Department</span>
          <span>Compliance</span>
        </div>
        {documents.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          employees.map((employee) => {
            const approved =
              employee.documents?.filter(
                (document) => document.approval_state === "approved",
              ).length ?? 0;
            const compliance = employee.documents?.length
              ? Math.round((approved / employee.documents.length) * 100)
              : 0;
            return (
              <Link
                key={employee.id}
                href={`/pages/employee/profile?employee=${employee.id}`}
                className="grid grid-cols-[minmax(240px,2fr)_1fr_1fr_1fr] items-center border-b border-slate-100 px-5 py-5 transition hover:bg-pink-50/30"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-50 font-bold text-brand-pink">
                    {employee.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong className="block text-sm text-slate-800">
                      {employee.name}
                    </strong>
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <FileText className="h-4 w-4 text-brand-pink" />
                  {employee.documents?.length ?? 0}
                </span>
                <span className="text-sm text-slate-500">Employee files</span>
                <span className="flex items-center gap-3">
                  <span className="h-2 flex-1 rounded-full bg-pink-100">
                    <span
                      className="block h-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink"
                      style={{ width: `${compliance}%` }}
                    />
                  </span>
                  <strong className="text-xs text-brand-text">
                    {compliance}%
                  </strong>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </span>
              </Link>
            );
          })
        )}
        {!documents.isLoading && !employees.length && (
          <div className="p-12 text-center">
            <Users className="mx-auto h-8 w-8 text-brand-pink" />
            <p className="mt-3 font-semibold text-slate-700">
              No employees found
            </p>
            <p className="mt-1 text-sm text-slate-400">Try another search.</p>
          </div>
        )}
      </section>
      {showAddEmployees && folder && <AddEmployeesModal folderId={folder.id} targets={targets.data} currentIds={folder.employee_ids ?? []} onClose={() => setShowAddEmployees(false)} />}
    </div>
  );
}

function AddEmployeesModal({ folderId, targets, currentIds, onClose }: { folderId: number; targets: any; currentIds: number[]; onClose: () => void }) {
  const add = useAddEmployeesToFolder();
  const [mode, setMode] = useState("employee");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>(currentIds);
  const groups = mode === "department" ? targets?.departments ?? [] : mode === "grade" ? targets?.grades ?? [] : targets?.employees ?? [];
  const employees = targets?.employees ?? [];
  const visible = groups.filter((item: any) => item.name.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const confirm = async () => {
    const employeeIds = mode === "employee" ? selected : employees.filter((employee: any) => selected.includes(mode === "department" ? employee.department_id : employee.grade_id)).map((employee: any) => employee.id);
    if (!employeeIds.length) return;
    await add.mutateAsync({ id: folderId, employee_ids: employeeIds });
    onClose();
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">Employee folder</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Add employees</h2><p className="mt-2 text-sm text-slate-500">Add individual employees or everyone in a department or grade.</p></div><button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink">×</button></div><div className="mt-5 flex gap-1 rounded-xl bg-slate-50 p-1">{[["employee", "Employees"], ["department", "Departments"], ["grade", "Grade levels"]].map(([value, label]) => <button key={value} type="button" onClick={() => { setMode(value); setSelected([]); setQuery(""); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === value ? "bg-white text-brand-pink shadow-sm" : "text-slate-400"}`}>{label}</button>)}</div><label className="relative mt-4 block"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode}s...`} className="field pl-10" /></label><div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">{visible.map((item: any) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="h-4 w-4 accent-pink-600" />{item.name}</label>)}{!visible.length && <p className="p-5 text-center text-sm text-slate-400">No matches found.</p>}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 font-semibold text-slate-500">Cancel</button><button type="button" onClick={confirm} disabled={!selected.length || add.isPending} className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white">{add.isPending ? "Adding..." : "Add to folder"}</button></div></div></div>;
}
