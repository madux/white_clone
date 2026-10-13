"use client";

import { Button } from "@/components/ui/button";
import { SettingsFieldHelp } from "./EmployeeFilesOrganizingDimensionsSettings";
import { cn } from "cn";
import {
  ArrowUpFromLine,
  ClipboardList,
  Filter,
  Lock,
  RotateCcw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { dmsContractsApi } from "../../../lib/dmsContractsApi";
import { formatDmsDateTime } from "../../../lib/dmsLocale";
import AppSelect from "./AppSelect";
import ListPagination from "./ListPagination";
import SlideOver from "./SlideOver";
import StatusPill from "./StatusPill";

const SAVED_FILTER_KEY = "cleon-audit-trail-saved-filter";
const PAGE_SIZE = 50;

const AUDIT_DATE_PRESETS: { id: "7d" | "30d" | "90d"; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
];

type AuditRow = {
  id: number;
  occurred_at: string;
  person_name: string;
  action: string;
  summary: string;
  record_label: string;
  module: string;
  module_label: string;
  result: string;
};

type AuditDetail = AuditRow & {
  details?: string;
  actor_role_label?: string;
  actor_ip?: string;
  actor_user_agent?: string;
  what_path?: string;
  correlation_id?: string;
  related_count?: number;
  related_events?: AuditRow[];
  changes?: { field: string; before: unknown; after: unknown }[];
  open_record_href?: string;
};

type AuditFilters = {
  datePreset: "7d" | "30d" | "90d" | "custom";
  dateFrom: string;
  dateTo: string;
  module: string;
  result: string;
  action: string;
  search: string;
};

function defaultFilters(): AuditFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    datePreset: "7d",
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    module: "",
    result: "",
    action: "",
    search: "",
  };
}

function filtersToPayload(filters: AuditFilters) {
  const payload: Record<string, string> = {};
  if (filters.dateFrom) payload.date_from = `${filters.dateFrom} 00:00:00`;
  if (filters.dateTo) payload.date_to = `${filters.dateTo} 23:59:59`;
  if (filters.module) payload.module = filters.module;
  if (filters.result) payload.result = filters.result;
  if (filters.action.trim()) payload.action = filters.action.trim();
  if (filters.search.trim()) payload.search = filters.search.trim();
  return payload;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function formatWhen(value: string, timeZone?: string) {
  return formatDmsDateTime(value, {
    timeZone,
    showUtc: true,
    fallback: "—",
  });
}

function formatMetricCount(value: number | undefined) {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString("en-GB");
}

function AuditMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail?: string;
  loading: boolean;
}) {
  return (
    <article
      className="flex gap-3.5 rounded-xl border border-[var(--rule)] bg-white p-4"
      aria-busy={loading}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50"
        aria-hidden
      >
        <Icon className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </p>
        <p
          className="mt-1.5 text-[1.5rem] font-bold leading-none tabular-nums tracking-tight text-slate-900"
        >
          {loading ? (
            <span className="inline-block h-7 w-14 animate-pulse rounded-md bg-slate-100" />
          ) : (
            formatMetricCount(value)
          )}
        </p>
        {detail && !loading ? (
          <p className="mt-2 text-sm font-medium leading-snug text-slate-500">{detail}</p>
        ) : null}
      </div>
    </article>
  );
}

function AuditDateRangeControl({
  active,
  onSelect,
}: {
  active: AuditFilters["datePreset"];
  onSelect: (preset: "7d" | "30d" | "90d") => void;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap rounded-full border border-[var(--rule)] bg-[#f7e9f0] p-1"
      role="group"
      aria-label="Date range"
    >
      {AUDIT_DATE_PRESETS.map((preset) => {
        const isActive = active === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(preset.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-all",
              isActive
                ? "bg-white text-[#9d174d] shadow-sm shadow-slate-900/10"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

function AuditFilterField({
  label,
  className = "w-44",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex shrink-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function shortBrowser(agent?: string) {
  if (!agent) return "";
  if (agent.includes("Chrome")) return "Chrome";
  if (agent.includes("Firefox")) return "Firefox";
  if (agent.includes("Safari")) return "Safari";
  if (agent.includes("Edge")) return "Edge";
  return agent.slice(0, 40);
}

export default function AuditTrailPage() {
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [moduleOptions, setModuleOptions] = useState<{ value: string; label: string }[]>([]);
  const [canExport, setCanExport] = useState(false);
  const [timeZone, setTimeZone] = useState<string>("UTC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filterPayload = useMemo(() => filtersToPayload(filters), [filters]);

  const loadMeta = useCallback(async () => {
    const result = await dmsContractsApi.auditMeta();
    if (result.success && result.data?.allowed) {
      setModuleOptions(result.data.modules || []);
      setCanExport(result.data.can_export === true);
      setTimeZone(result.data.timezone || "UTC");
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listResult, metricsResult] = await Promise.all([
      dmsContractsApi.auditQuery(filterPayload, page, PAGE_SIZE),
      dmsContractsApi.auditMetrics(filterPayload),
    ]);
    if (!listResult.success) {
      setError(listResult.message || "Could not load audit events.");
      setItems([]);
      setTotal(0);
    } else {
      setItems((listResult.data?.items || []) as AuditRow[]);
      setTotal(listResult.data?.total || 0);
    }
    if (metricsResult.success && metricsResult.data) {
      setMetrics(metricsResult.data as Record<string, number>);
    }
    setLoading(false);
  }, [filterPayload, page]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyPreset = (preset: AuditFilters["datePreset"]) => {
    const to = new Date();
    const from = new Date();
    if (preset === "7d") from.setDate(from.getDate() - 7);
    if (preset === "30d") from.setDate(from.getDate() - 30);
    if (preset === "90d") from.setDate(from.getDate() - 90);
    setFilters((current) => ({
      ...current,
      datePreset: preset,
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
    }));
    setPage(1);
  };

  const openDetail = async (id: number) => {
    const result = await dmsContractsApi.auditEvent(id);
    if (result.success) {
      setDetail(result.data as AuditDetail);
    }
  };

  const saveFilter = () => {
    localStorage.setItem(SAVED_FILTER_KEY, JSON.stringify(filters));
  };

  const restoreFilter = () => {
    const raw = localStorage.getItem(SAVED_FILTER_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as AuditFilters;
      setFilters(parsed);
      setPage(1);
    } catch {
      /* ignore */
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "audit-trail.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const runExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await dmsContractsApi.auditExport(filterPayload);
      if (!result.success) {
        setError(result.message || "Export failed.");
        return;
      }
      const data = result.data;
      if (data.async && data.job_id) {
        for (let attempt = 0; attempt < 120; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          const jobResult = await dmsContractsApi.auditExportJob(data.job_id);
          if (!jobResult.success) {
            setError(jobResult.message || "Could not check export status.");
            return;
          }
          const job = jobResult.data;
          if (job.state === "failed") {
            setError(job.error_message || "Background export failed.");
            return;
          }
          if (job.state === "done" && job.content) {
            downloadCsv(job.content, job.filename);
            loadData();
            return;
          }
        }
        setError("Export is still running. Try again in a few minutes.");
        return;
      }
      if (data.content) {
        downloadCsv(data.content, data.filename || "audit-trail.csv");
        loadData();
      }
    } finally {
      setExporting(false);
    }
  };

  const resultTone = (result: string) =>
    result === "denied" || result === "failed" ? "danger" : "ok";

  const activeFilterCount = [
    Boolean(filters.module),
    Boolean(filters.result),
    Boolean(filters.search.trim()),
    Boolean(filters.action.trim()),
  ].filter(Boolean).length;

  return (
    <div className="app-page space-y-4">
      <header className="flex flex-wrap items-center justify-end gap-2">
          <SettingsFieldHelp
            label="Audit trail"
            text="Append only. Showing events you are allowed to see."
          />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={saveFilter}>
            Save filter
          </Button>
          <Button
            type="button"
            onClick={runExport}
            disabled={!canExport || exporting}
          >
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="list"
        aria-label="Audit summary"
      >
        <AuditMetricCard
          icon={ClipboardList}
          label="Events in period"
          value={metrics.events_in_period ?? 0}
          loading={loading}
        />
        <AuditMetricCard
          icon={Lock}
          label="Access denied"
          value={metrics.access_denied ?? 0}
          detail={
            metrics.access_denied_people
              ? `${formatMetricCount(metrics.access_denied_people)} people`
              : undefined
          }
          loading={loading}
        />
        <AuditMetricCard
          icon={Sun}
          label="Settings changes"
          value={metrics.settings_changes ?? 0}
          loading={loading}
        />
        <AuditMetricCard
          icon={ArrowUpFromLine}
          label="Exports"
          value={metrics.exports ?? 0}
          loading={loading}
        />
      </div>

      <div className="app-page-toolbar flex flex-wrap items-center gap-3">
        <AuditDateRangeControl
          active={filters.datePreset}
          onSelect={(preset) => applyPreset(preset)}
        />
        <button
          type="button"
          onClick={restoreFilter}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--rule)] bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-brand-pink/35 hover:bg-pink-50/60 hover:text-[#9d174d]"
        >
          <RotateCcw className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
          Restore saved
        </button>
      </div>

      <div className="app-page-body app-table-well">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 pb-3">
          <Button
            type="button"
            variant="outline"
            className="ml-auto shrink-0"
            aria-expanded={showFilters}
            aria-controls="audit-trail-filters"
            onClick={() => setShowFilters((current) => !current)}
          >
            <Filter data-icon="inline-start" className="h-4 w-4 shrink-0" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-brand-pink/10 px-1.5 text-xs font-bold text-brand-pink">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
        {showFilters ? (
          <div
            id="audit-trail-filters"
            className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4"
            role="region"
            aria-label="Audit trail filters"
          >
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <AuditFilterField label="Module">
                <AppSelect
                  ariaLabel="Module"
                  placeholder="Any Module"
                  value={filters.module || "any"}
                  onChange={(value) => {
                    setFilters((f) => ({ ...f, module: value === "any" ? "" : value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "any", label: "Any Module" },
                    ...moduleOptions.map((m) => ({ value: m.value, label: m.label })),
                  ]}
                  className="!w-full max-w-none"
                />
              </AuditFilterField>
              <AuditFilterField label="Result" className="w-36">
                <AppSelect
                  ariaLabel="Result"
                  placeholder="Any Result"
                  value={filters.result || "any"}
                  onChange={(value) => {
                    setFilters((f) => ({ ...f, result: value === "any" ? "" : value }));
                    setPage(1);
                  }}
                  options={[
                    { value: "any", label: "Any Result" },
                    { value: "success", label: "Success" },
                    { value: "denied", label: "Denied" },
                    { value: "failed", label: "Failed" },
                  ]}
                  className="!w-full max-w-none"
                />
              </AuditFilterField>
              <AuditFilterField label="Record" className="w-52">
                <input
                  type="search"
                  placeholder="Document, Employee or ID…"
                  aria-label="Record"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((f) => ({ ...f, search: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setPage(1);
                  }}
                />
              </AuditFilterField>
              <AuditFilterField label="Action" className="w-44">
                <input
                  type="text"
                  placeholder="Contains text…"
                  aria-label="Action"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  value={filters.action}
                  onChange={(event) =>
                    setFilters((f) => ({ ...f, action: event.target.value }))
                  }
                />
              </AuditFilterField>
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0"
                onClick={() => setPage(1)}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : null}
        {loading ? (
          <p className="text-sm text-slate-500 px-1 py-6">Loading events…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 px-1 py-6">No events match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Person</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Record</th>
                <th className="py-2 pr-3">Module</th>
                <th className="py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 cursor-pointer hover:bg-slate-50/80"
                  onClick={() => openDetail(row.id)}
                >
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-700">
                    {formatWhen(row.occurred_at, timeZone).split(" (")[0]}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                        {initials(row.person_name)}
                      </span>
                      <span className="font-medium text-slate-900">{row.person_name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 capitalize">{row.action.replace(/_/g, " ")}</td>
                  <td className="py-2.5 pr-3 max-w-xs truncate">{row.record_label || row.summary}</td>
                  <td className="py-2.5 pr-3">{row.module_label || row.module}</td>
                  <td className="py-2.5">
                    <StatusPill
                      label={row.result === "denied" ? "Denied" : row.result === "failed" ? "Failed" : "Success"}
                      tone={resultTone(row.result)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>

      {detail ? (
        <SlideOver
          title={detail.action.replace(/_/g, " ")}
          onClose={() => setDetail(null)}
          footer={
            detail.open_record_href ? (
              <Link
                href={detail.open_record_href}
                className="inline-flex w-full items-center justify-center rounded-xl border border-brand-pink px-4 py-2.5 text-sm font-bold text-brand-pink hover:bg-pink-50"
              >
                Open record
              </Link>
            ) : undefined
          }
        >
          <div className="space-y-4 px-5 py-4 text-sm">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">When</p>
              <p className="mt-1 font-medium text-slate-900">
                {formatWhen(detail.occurred_at, timeZone)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Who</p>
              <p className="mt-1 font-medium text-slate-900">
                {detail.person_name}
                {detail.actor_role_label ? ` (${detail.actor_role_label})` : ""}
              </p>
              <p className="mt-1 text-slate-600">
                {[detail.actor_ip, shortBrowser(detail.actor_user_agent)]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">What</p>
              <p className="mt-1 font-medium text-slate-900">
                {detail.what_path || `${detail.module_label} · ${detail.record_label}`}
              </p>
              {detail.summary ? (
                <p className="mt-1 text-slate-600">{detail.summary}</p>
              ) : null}
            </div>
            {detail.changes && detail.changes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Before &amp; after</p>
                {detail.changes.map((change) => (
                  <div key={change.field} className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">{change.field} (before)</p>
                      <p className="mt-1 font-medium">{String(change.before ?? "—")}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">{change.field} (after)</p>
                      <p className="mt-1 font-medium">{String(change.after ?? "—")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {detail.related_count ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Related events</p>
                <p className="mt-1 font-medium">
                  {detail.related_count} event{detail.related_count === 1 ? "" : "s"} in the same change
                </p>
              </div>
            ) : null}
            {detail.details ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Details</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{detail.details}</p>
              </div>
            ) : null}
          </div>
        </SlideOver>
      ) : null}
    </div>
  );
}
