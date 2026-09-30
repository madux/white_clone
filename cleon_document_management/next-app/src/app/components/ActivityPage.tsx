"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FileText,
  Filter,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkspaceActivity } from "../../../hooks/useDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type {
  WorkspaceActivityEvent,
  WorkspaceActivityKind,
} from "../../../lib/types";
import AppToolbar from "./AppToolbar";
import EmployeeFilesGate from "./EmployeeFilesGate";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import StatusPill from "./StatusPill";
import ThemedSelect from "./ThemedSelect";

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All audited actions" },
  { value: "upload", label: "Uploaded" },
  { value: "update", label: "Updated" },
  { value: "acknowledgement", label: "Acknowledged" },
  { value: "approval", label: "Approvals (all)" },
  { value: "submitted", label: "Submitted for approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "folder_lock", label: "Folder locked" },
  { value: "folder_unlock", label: "Folder unlocked" },
];

const AREA_OPTIONS = [
  { value: "all", label: "All areas" },
  { value: "organizational", label: "Organizational files" },
  { value: "employee", label: "Employee files" },
];

const TIMEFRAME_OPTIONS = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week (7 days)" },
  { value: "this_month", label: "This month (30 days)" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const ACTION_LABELS: Record<WorkspaceActivityKind, string> = {
  acknowledgement: "Acknowledged",
  approval: "Approval",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  update: "Updated",
  upload: "Uploaded",
  folder_lock: "Locked",
  folder_unlock: "Unlocked",
};

type ActivityFilters = {
  search: string;
  action: string;
  area: string;
  actor: string;
  folderId: string;
  timeframe: string;
  startDate: string;
  endDate: string;
};

const INITIAL_FILTERS: ActivityFilters = {
  search: "",
  action: "all",
  area: "all",
  actor: "all",
  folderId: "all",
  timeframe: "all",
  startDate: "",
  endDate: "",
};

function formatWhen(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(String(value).replace(" ", "T")));
}

function eventIcon(kind: WorkspaceActivityKind) {
  if (kind === "acknowledgement" || kind === "approved") return CheckCircle2;
  if (kind === "approval" || kind === "submitted" || kind === "rejected") {
    return AlertCircle;
  }
  if (kind === "upload") return FileText;
  if (kind === "folder_lock") return Lock;
  if (kind === "folder_unlock") return Unlock;
  return Activity;
}

function folderLink(item: { folder_id: number; folder_type?: string }) {
  if (item.folder_type === "employee") {
    return `/pages/employee/folder?folder=${item.folder_id}`;
  }
  return `/pages/organization/folder?folder=${item.folder_id}`;
}

function documentLink(item: {
  document_id: number;
  folder_id: number;
  folder_type?: string;
  employee_id?: number | false;
}) {
  return documentViewHref(
    {
      id: item.document_id,
      folder_id: item.folder_id,
      employee_id: item.employee_id,
      folder_type: item.folder_type,
    },
    true,
  );
}

function matchesTimeframe(occurredAt: string, filters: ActivityFilters) {
  if (filters.timeframe === "all") return true;
  if (!occurredAt) return false;
  const targetDate = new Date(String(occurredAt).replace(" ", "T"));
  if (Number.isNaN(targetDate.getTime())) return false;
  const now = new Date();

  if (filters.timeframe === "today") {
    return targetDate.toDateString() === now.toDateString();
  }
  if (filters.timeframe === "this_week") {
    const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }
  if (filters.timeframe === "this_month") {
    const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }
  if (filters.timeframe === "this_year") {
    return targetDate.getFullYear() === now.getFullYear();
  }
  if (filters.timeframe === "custom") {
    if (filters.startDate && targetDate < new Date(filters.startDate)) {
      return false;
    }
    if (filters.endDate && targetDate > new Date(`${filters.endDate}T23:59:59`)) {
      return false;
    }
    return true;
  }
  return true;
}

function matchesAction(event: WorkspaceActivityEvent, action: string) {
  if (action === "all") return true;
  if (action === "approval") {
    return ["approval", "submitted", "approved", "rejected"].includes(event.kind);
  }
  if (event.kind === action) return true;
  if (event.kind === "approval") {
    const lowered = event.message.toLowerCase();
    if (action === "rejected") return lowered.includes("rejected");
    if (action === "submitted") return lowered.includes("submitted");
    if (action === "approved") {
      return lowered.includes("approved") && !lowered.includes("rejected");
    }
  }
  return false;
}

function applyActivityFilters(
  events: WorkspaceActivityEvent[],
  filters: ActivityFilters,
) {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) => {
    if (!matchesAction(event, filters.action)) {
      return false;
    }
    if (filters.area !== "all" && event.folder_type !== filters.area) {
      return false;
    }
    if (filters.actor !== "all" && event.actor_name !== filters.actor) {
      return false;
    }
    if (filters.folderId !== "all" && String(event.folder_id) !== filters.folderId) {
      return false;
    }
    if (!matchesTimeframe(event.occurred_at, filters)) {
      return false;
    }
    if (query) {
      const haystack = [
        event.message,
        event.actor_name,
        event.folder_name,
        event.document_name,
        ACTION_LABELS[event.kind],
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ActivityFilterBar({
  filters,
  onChange,
  actors,
  folders,
  totalCount,
  filteredCount,
}: {
  filters: ActivityFilters;
  onChange: (next: ActivityFilters) => void;
  actors: string[];
  folders: { id: number; name: string }[];
  totalCount: number;
  filteredCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const update = (key: keyof ActivityFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };
  const activeCount = [
    filters.action !== "all",
    filters.area !== "all",
    filters.actor !== "all",
    filters.folderId !== "all",
    filters.timeframe !== "all",
    Boolean(filters.startDate),
    Boolean(filters.endDate),
  ].filter(Boolean).length;
  const hasActiveFilters = activeCount > 0 || Boolean(filters.search);

  return (
    <AppToolbar
      search={filters.search}
      onSearchChange={(value) => update("search", value)}
      searchPlaceholder="Search by action, person, folder, or document"
      extras={
        <>
          <div className="w-48">
            <ThemedSelect
              value={filters.action}
              onChange={(value) => update("action", value)}
              placeholder="Audited action"
              options={ACTION_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="app-btn app-btn-secondary"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 ? (
              <span className="status-pill status-pill--pending">{activeCount}</span>
            ) : null}
          </button>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => onChange({ ...INITIAL_FILTERS })}
              className="app-btn app-btn-secondary"
            >
              <X className="h-3.5 w-3.5" />
              Reset
            </button>
          ) : null}
        </>
      }
      footer={
        <>
          {expanded ? (
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ThemedSelect
                value={filters.area}
                onChange={(value) => update("area", value)}
                placeholder="All areas"
                options={AREA_OPTIONS}
              />
              <ThemedSelect
                value={filters.actor}
                onChange={(value) => update("actor", value)}
                placeholder="Anyone"
                options={[
                  { value: "all", label: "Anyone" },
                  ...actors.map((name) => ({ value: name, label: name })),
                ]}
              />
              <ThemedSelect
                value={filters.folderId}
                onChange={(value) => update("folderId", value)}
                placeholder="All folders"
                options={[
                  { value: "all", label: "All folders" },
                  ...folders.map((folder) => ({
                    value: String(folder.id),
                    label: folder.name,
                  })),
                ]}
              />
              <ThemedSelect
                value={filters.timeframe}
                onChange={(value) => update("timeframe", value)}
                placeholder="Any time"
                options={TIMEFRAME_OPTIONS}
              />
              {filters.timeframe === "custom" ? (
                <div className="col-span-full flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    From
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(event) => update("startDate", event.target.value)}
                      className="field"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    To
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(event) => update("endDate", event.target.value)}
                      className="field"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-slate-500">
            Showing {filteredCount} of {totalCount} audited events
          </p>
          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {filters.action !== "all" ? (
                <FilterChip
                  label={
                    ACTION_OPTIONS.find((option) => option.value === filters.action)
                      ?.label || filters.action
                  }
                  onClear={() => update("action", "all")}
                />
              ) : null}
              {filters.area !== "all" ? (
                <FilterChip
                  label={
                    AREA_OPTIONS.find((option) => option.value === filters.area)
                      ?.label || filters.area
                  }
                  onClear={() => update("area", "all")}
                />
              ) : null}
              {filters.actor !== "all" ? (
                <FilterChip
                  label={filters.actor}
                  onClear={() => update("actor", "all")}
                />
              ) : null}
              {filters.folderId !== "all" ? (
                <FilterChip
                  label={
                    folders.find((folder) => String(folder.id) === filters.folderId)
                      ?.name || filters.folderId
                  }
                  onClear={() => update("folderId", "all")}
                />
              ) : null}
              {filters.timeframe !== "all" ? (
                <FilterChip
                  label={
                    TIMEFRAME_OPTIONS.find(
                      (option) => option.value === filters.timeframe,
                    )?.label || filters.timeframe
                  }
                  onClear={() =>
                    onChange({
                      ...filters,
                      timeframe: "all",
                      startDate: "",
                      endDate: "",
                    })
                  }
                />
              ) : null}
            </div>
          ) : null}
        </>
      }
    />
  );
}

function ActivityPageContent() {
  const activity = useWorkspaceActivity();
  const data = activity.data;
  const [filters, setFilters] = useState<ActivityFilters>(INITIAL_FILTERS);
  const events = data?.activity_log || [];

  const actors = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.actor_name).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [events],
  );
  const folders = useMemo(() => {
    const seen = new Map<number, string>();
    events.forEach((event) => {
      if (event.folder_id && event.folder_name && !seen.has(event.folder_id)) {
        seen.set(event.folder_id, event.folder_name);
      }
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [events]);

  const filteredEvents = useMemo(
    () => applyActivityFilters(events, filters),
    [events, filters],
  );

  return (
    <div className="space-y-6">
      {activity.isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Activity data could not be loaded.
        </div>
      )}

      <ActivityFilterBar
        filters={filters}
        onChange={setFilters}
        actors={actors}
        folders={folders}
        totalCount={events.length}
        filteredCount={filteredEvents.length}
      />

      <section className="app-page-body">
        <LibraryFileTable
          rows={filteredEvents.map((event) => {
            const Icon = eventIcon(event.kind);
            const href = event.document_id
              ? documentLink(event)
              : event.folder_id
                ? folderLink(event)
                : undefined;
            const row: LibraryFileRow = {
              id: `${event.id}-${event.occurred_at}`,
              icon: <Icon />,
              name: event.message,
              subtitle: event.document_name || event.folder_name || undefined,
              href,
              owner: event.actor_name || "—",
              modified: formatWhen(event.occurred_at),
              extra: <StatusPill label={ACTION_LABELS[event.kind]} />,
              location:
                event.folder_type === "organizational"
                  ? "Organizational"
                  : event.folder_type === "employee"
                    ? "Employee"
                    : event.folder_name || "Workspace",
            };
            return row;
          })}
          loading={activity.isLoading}
          showLocation
          emptyTitle={
            !events.length ? "No workspace activity yet" : "No matching events"
          }
          emptyDescription={
            !events.length
              ? "Uploads, approvals, and folder lock events will appear here."
              : "Try a different search or clear the current filters."
          }
        />
      </section>
    </div>
  );
}

export default function ActivityPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const content = <ActivityPageContent />;
  if (embedded) return content;
  return <EmployeeFilesGate>{content}</EmployeeFilesGate>;
}
