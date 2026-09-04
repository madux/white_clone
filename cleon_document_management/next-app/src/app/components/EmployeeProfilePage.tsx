"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useComplianceTargets,
  useDocuments,
} from "../../../hooks/useDocuments";
import DocumentActions from "./DocumentActions";
import BulkDocumentActions from "./BulkDocumentActions";

export default function EmployeeProfilePage() {
  const params = useSearchParams();
  const documents = useDocuments();
  const targets = useComplianceTargets();
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const employeeId = Number(params.get("employee"));
  const employeeDocuments = useMemo(
    () =>
      (documents.data ?? []).filter((document) =>
        employeeId ? document.employee_id === employeeId : document.employee_id,
      ),
    [documents.data, employeeId],
  );
  const employee = employeeDocuments[0];
  const employeeRecord = targets.data?.employees.find(
    (item) => item.id === employeeId,
  );
  const approved = employeeDocuments.filter(
    (document) => document.approval_state === "approved",
  ).length;
  const compliance = employeeDocuments.length
    ? Math.round((approved / employeeDocuments.length) * 100)
    : 0;
  const documentTypes = [
    ...new Set(employeeDocuments.map((document) => document.document_type)),
  ];
  const filteredEmployeeDocuments =
    typeFilter === "all"
      ? employeeDocuments
      : employeeDocuments.filter(
          (document) => document.document_type === typeFilter,
      );
  const visibleIds = filteredEmployeeDocuments.map((document) => document.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const name =
    employeeRecord?.name ?? employee?.employee_name ?? "Employee profile";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 rounded-2xl bg-gray-100 p-6 pb-10">
      <Link
        href="/pages/employee"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-pink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employee Files
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-pink-50 text-2xl font-bold text-brand-pink ring-4 ring-pink-50">
              {employee ? initials : <UserRound className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                Employee profile
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                EMP-{employeeRecord?.id ?? employee?.employee_id ?? "---"}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.job_title || "Employee record"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.location || "Location not set"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.grade || "Grade not set"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.work_email || "Email not set"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.work_phone || "Phone not set"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
              Active
            </span>
            <button
              type="button"
              onClick={() =>
                document.getElementById("employee-upload")?.click()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
            >
              <FilePlus2 className="h-4 w-4" />
              Upload document
            </button>
            <input id="employee-upload" type="file" className="hidden" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
          <span className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            Overview
          </span>
          <span className="text-sm font-semibold text-slate-400">
            {compliance}% compliant
          </span>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-text to-brand-pink p-5 text-white shadow-lg shadow-pink-200">
          <p className="text-sm text-white/80">Compliance score</p>
          <p className="mt-3 text-3xl font-bold">{compliance}%</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${compliance}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total documents</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {employeeDocuments.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Across this employee record
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Approved documents</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{approved}</p>
          <p className="mt-1 text-xs text-slate-400">
            Ready for compliance review
          </p>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-bold text-slate-900">
            All employee documents
          </h2>

          <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${typeFilter === "all" ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-400 hover:text-slate-700"}`}
            >
              All documents
            </button>
            {documentTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${typeFilter === type ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-400 hover:text-slate-700"}`}
              >
                {type}
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{employeeDocuments.filter((document) => document.document_type === type).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pt-4"><BulkDocumentActions selected={selected} onClear={() => setSelected([])} /></div>
        {documents.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : filteredEmployeeDocuments.length ? (
          <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="w-12 px-5 py-4"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} aria-label="Select all documents" className="h-4 w-4 accent-pink-600" /></th>
                  <th className="px-5 py-4">Document name</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Expiry date</th>
                  <th className="px-5 py-4">Modified</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployeeDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-pink-50/30">
                    <td className="w-12 px-5 py-4"><input type="checkbox" checked={selected.includes(document.id)} onChange={() => toggleSelected(document.id)} aria-label={`Select ${document.name}`} className="h-4 w-4 accent-pink-600" /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-brand-pink" />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {document.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {document.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {document.document_type}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${document.approval_state === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {document.approval_state === "approved" && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {document.approval_state.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {document.expiry_date ?? "No expiry"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {document.write_date.slice(0, 10)}
                    </td>
                    <td className="px-5 py-4 text-right"><DocumentActions documentId={document.id} documentName={document.name} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            No documents found for this filter.
          </p>
        )}
      </section>
    </div>
  );
}
