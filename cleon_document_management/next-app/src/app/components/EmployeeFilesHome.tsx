"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useEmployeeFileGroups,
  useEmployeeFilesConfig,
  useEmployeeFilesHomeStats,
} from "../../../hooks/useEmployeeFiles";
import SectionTabs from "./SectionTabs";
import { api } from "../../../lib/api";
import EmployeeFilesGroupExplorer from "./EmployeeFilesGroupExplorer";
import type { EmployeeFileGroup } from "../../../lib/types";

type HomeView = "groups" | "employees" | "documents";

const DIMENSION_LABELS: Record<string, string> = {
  department: "Department",
  branch: "Branch",
  grade: "Grade / Level",
  employment_type: "Employment Type",
  work_location: "Location",
  status: "Status",
};

export default function EmployeeFilesHome() {
  const config = useEmployeeFilesConfig();
  const stats = useEmployeeFilesHomeStats();
  const [view, setView] = useState<HomeView>("groups");
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState("");
  const [globalDocs, setGlobalDocs] = useState<any[]>([]);

  const primaryDimension =
    dimension ||
    config.data?.primary_organizing_dimension ||
    config.data?.organizing_dimensions?.[0] ||
    "department";

  const homeGroups = useEmployeeFileGroups({
    for_home: true,
    dimension: primaryDimension,
    search: view === "groups" ? search : undefined,
  });

  const allEmployeesTreeGroup = useMemo((): EmployeeFileGroup | null => {
    if (view !== "employees" || !stats.data?.employee_files_initialized) {
      return null;
    }
    return {
      id: 0,
      name: "All employees",
      description: "",
      icon: "",
      group_kind: "system_managed",
      organizing_dimension: "",
      dimension_value_key: "",
      parent_group_id: false,
      employee_count: stats.data.employee_files_initialized,
      document_count: 0,
      attention_count: 0,
      read_only_membership: true,
      member_employee_ids: [],
    };
  }, [stats.data?.employee_files_initialized, view]);

  const attention = stats.data?.needs_attention ?? 0;

  const dimensionTabs = useMemo(
    () =>
      (config.data?.organizing_dimensions ?? []).map((key) => ({
        id: key,
        label: `By ${DIMENSION_LABELS[key] ?? key}`,
      })),
    [config.data?.organizing_dimensions],
  );

  const runDocumentSearch = async () => {
    if (!search.trim()) {
      setGlobalDocs([]);
      return;
    }
    const result = await api.employeeFilesGlobalSearch(search, "documents");
    setGlobalDocs(result.documents);
  };

  return (
    <div className="min-h-full mx-auto w-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Files</h1>
          <p className="text-sm text-slate-500">
            EMS-derived organization with reconciliation statistics.
          </p>
        </div>
        {attention > 0 ? (
          <Link
            href="/pages/employee/issues"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
          >
            View Issues ({attention})
          </Link>
        ) : null}
      </div>

      {stats.data ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MiniStat label="EMS employees" value={stats.data.ems_employees} />
          <MiniStat label="Expected files" value={stats.data.expected_employee_files} />
          <MiniStat label="Initialized" value={stats.data.employee_files_initialized} />
          <MiniStat label="Synced" value={stats.data.successfully_synced} />
          <MiniStat label="Needs attention" value={stats.data.needs_attention} />
          <MiniStat label="Excluded" value={stats.data.excluded} />
        </div>
      ) : null}

      <SectionTabs
        ariaLabel="Employee Files views"
        value={view}
        onChange={(value) => setView(value as HomeView)}
        items={[
          { id: "groups", label: "Employee files" },
          { id: "employees", label: "Employees" },
          { id: "documents", label: "Documents" },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="Search…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && view === "documents") runDocumentSearch();
          }}
        />
        {view === "documents" ? (
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={runDocumentSearch}
          >
            Search documents
          </button>
        ) : null}
      </div>

      {view === "groups" ? (
        <div className="space-y-4">
          {dimensionTabs.length > 1 ? (
            <SectionTabs
              ariaLabel="Organizing dimension"
              value={primaryDimension}
              onChange={setDimension}
              items={dimensionTabs}
            />
          ) : null}
          <EmployeeFilesGroupExplorer
            groups={homeGroups.data ?? []}
            search={search}
          />
        </div>
      ) : null}

      {view === "employees" && allEmployeesTreeGroup ? (
        <EmployeeFilesGroupExplorer
          groups={[allEmployeesTreeGroup]}
          search=""
          memberSearch={search}
        />
      ) : null}

      {view === "employees" && !allEmployeesTreeGroup && !stats.isLoading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No employee files have been initialized yet.
        </p>
      ) : null}

      {view === "documents" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {globalDocs.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{doc.name}</td>
                  <td className="px-4 py-3">{doc.employee_name || "—"}</td>
                  <td className="px-4 py-3">{doc.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
