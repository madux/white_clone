"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Copy,
  MonitorSmartphone,
  Pencil,
  PowerOff,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { api } from "../../../lib/api";
import type { WorkspaceGrant, WorkspaceModule } from "../../../lib/types";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { useToast } from "../../../hooks/useToast";
import EmptyState from "./EmptyState";
import FilterToggleButton from "./FilterToggleButton";
import ModalDialog from "./ModalDialog";
import RemoteSessionWindow from "./RemoteSessionWindow";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";

type PageTab = "invitations" | "active" | "shared";
type SharedFilter = "all" | "active" | "pending" | "dead";

const DEAD_GRANT_STATES = new Set([
  "cancelled",
  "revoked",
  "expired",
  "declined",
]);

const SHARED_FILTER_OPTIONS: { value: SharedFilter; label: string }[] = [
  { value: "all", label: "All shares" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "dead", label: "Dead" },
];

const PRESETS: { id: string; label: string; keys: string[] }[] = [
  {
    id: "personal",
    label: "Personal / self-service",
    keys: [
      "my_workspace",
      "self_service_compliance",
      "self_service_approvals",
      "self_service_reviews",
      "self_service_team",
    ],
  },
  {
    id: "documents",
    label: "Document management",
    keys: ["employee_files", "organizational_files", "templates_forms"],
  },
  {
    id: "intelligence",
    label: "Intelligence & compliance admin",
    keys: ["document_intelligence", "compliance_admin"],
  },
  {
    id: "admin",
    label: "Administration",
    keys: ["settings", "roles", "super_admin"],
  },
];

function groupModules(modules: WorkspaceModule[]) {
  const groups = new Map<string, WorkspaceModule[]>();
  for (const mod of modules) {
    const g = mod.group || "other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(mod);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Odoo sends naive UTC datetimes ("YYYY-MM-DD HH:MM:SS"). */
function parseServerDatetime(value: string) {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

function toServerDatetime(localInput: string) {
  const date = new Date(localInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid end date and time.");
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toLocalInputValue(value: string) {
  if (!value) return "";
  const date = parseServerDatetime(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatUntil(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseServerDatetime(value));
}

function grantStateTone(state: string): "ok" | "pending" | "danger" | "neutral" {
  if (state === "active") return "ok";
  if (state === "pending") return "pending";
  if (DEAD_GRANT_STATES.has(state)) return "danger";
  return "neutral";
}

function grantStatusLabel(state: string) {
  if (state === "active") return "Active";
  if (state === "pending") return "Pending";
  if (DEAD_GRANT_STATES.has(state)) return "Dead";
  return state.replace(/_/g, " ");
}

function matchesSharedFilter(state: string, filter: SharedFilter) {
  if (filter === "all") return true;
  if (filter === "active") return state === "active";
  if (filter === "pending") return state === "pending";
  return DEAD_GRANT_STATES.has(state);
}

function formatInviteCodeInput(raw: string) {
  const body = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 6);
  if (body.length <= 3) return body;
  return `${body.slice(0, 3)}-${body.slice(3)}`;
}

function moduleSummary(keys: string[]) {
  if (!keys.length) return "—";
  if (keys.length <= 2) return keys.join(", ");
  return `${keys.length} modules`;
}

export default function RemoteAccessPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const incoming = useQuery({
    queryKey: ["workspace-access", "incoming"],
    queryFn: () => api.workspaceAccessIncoming(),
  });
  const outgoing = useQuery({
    queryKey: ["workspace-access", "outgoing"],
    queryFn: () => api.workspaceAccessOutgoing(),
  });
  const eligible = useQuery({
    queryKey: ["workspace-access", "eligible"],
    queryFn: () => api.workspaceAccessEligibleModules(),
  });

  const [tab, setTab] = useState<PageTab>("invitations");
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>("all");
  const [sharedFilterOpen, setSharedFilterOpen] = useState(false);
  const [sessionGrant, setSessionGrant] = useState<WorkspaceGrant | null>(null);
  const [editingGrant, setEditingGrant] = useState<WorkspaceGrant | null>(null);
  const sharedFilterRef = useRef<HTMLDivElement>(null);

  useClickOutside(sharedFilterRef, () => setSharedFilterOpen(false));

  const closeSession = useCallback(() => {
    setSessionGrant(null);
    void api.workspaceAccessClearSession().catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
  }, [queryClient]);

  const sharedFilterLabel =
    SHARED_FILTER_OPTIONS.find((o) => o.value === sharedFilter)?.label ?? "All shares";
  const [code, setCode] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<
    { id: number; name: string; email: string }[]
  >([]);
  const [delegateId, setDelegateId] = useState<number | null>(null);
  const [delegateLabel, setDelegateLabel] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [generateCode, setGenerateCode] = useState(false);
  const [lastPlainCode, setLastPlainCode] = useState<string | null>(null);

  const incomingRows = useMemo(
    () => (incoming.data ?? []).filter((grant) => grant.state === "pending"),
    [incoming.data],
  );
  const activeRows = useMemo(
    () => (incoming.data ?? []).filter((grant) => grant.state === "active"),
    [incoming.data],
  );
  const outgoingRows = outgoing.data ?? [];

  const sharedCounts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let dead = 0;
    for (const grant of outgoingRows) {
      if (grant.state === "active") active += 1;
      else if (grant.state === "pending") pending += 1;
      else if (DEAD_GRANT_STATES.has(grant.state)) dead += 1;
    }
    return { all: outgoingRows.length, active, pending, dead };
  }, [outgoingRows]);

  const filteredOutgoing = useMemo(
    () => outgoingRows.filter((g) => matchesSharedFilter(g.state, sharedFilter)),
    [outgoingRows, sharedFilter],
  );

  const tabItems = useMemo(
    (): { id: PageTab; label: string; count: number }[] => [
      { id: "invitations", label: "Invitations", count: incomingRows.length },
      { id: "active", label: "Active access", count: activeRows.length },
      { id: "shared", label: "Shared by you", count: outgoingRows.length },
    ],
    [activeRows.length, incomingRows.length, outgoingRows.length],
  );

  const eligibleModules = eligible.data ?? [];
  const eligibleKeySet = useMemo(
    () => new Set(eligibleModules.map((m) => m.key)),
    [eligibleModules],
  );

  const acceptMutation = useMutation({
    mutationFn: (grantId: number) => api.workspaceAccessAccept(grantId),
    onSuccess: (grant) => {
      showToast("Invitation accepted");
      setTab("active");
      setSessionGrant(grant);
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const codeMutation = useMutation({
    mutationFn: () => api.workspaceAccessAcceptCode(code.trim()),
    onSuccess: (grant) => {
      showToast("Remote access activated");
      setCode("");
      setTab("active");
      setSessionGrant(grant);
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.workspaceAccessCreateInvite({
        delegate_id: delegateId || undefined,
        valid_until: toServerDatetime(validUntil),
        module_keys: Array.from(selectedKeys),
        generate_code: generateCode,
      }),
    onSuccess: (grant) => {
      showToast("Workspace invitation created");
      if (grant.invite_code) setLastPlainCode(grant.invite_code);
      closeShareModal();
      setTab("shared");
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (grantId: number) =>
      api.workspaceAccessUpdateGrant({
        grant_id: grantId,
        valid_until: toServerDatetime(validUntil),
        module_keys: Array.from(selectedKeys),
      }),
    onSuccess: () => {
      showToast("Access updated");
      closeShareModal();
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (grantId: number) => api.workspaceAccessDeactivate(grantId),
    onSuccess: () => {
      showToast("Share deactivated — create a new invitation to share again.");
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const openEditModal = (grant: WorkspaceGrant) => {
    setEditingGrant(grant);
    setValidUntil(toLocalInputValue(grant.valid_until));
    setSelectedKeys(new Set(grant.module_keys));
  };

  const closeShareModal = () => {
    setShareOpen(false);
    setEditingGrant(null);
    setUserQuery("");
    setUserResults([]);
    setDelegateId(null);
    setDelegateLabel("");
    setValidUntil("");
    setSelectedKeys(new Set());
    setGenerateCode(false);
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (keys: string[]) => {
    const next = new Set<string>();
    for (const key of keys) {
      if (eligibleKeySet.has(key)) next.add(key);
    }
    setSelectedKeys(next);
  };

  const searchUsers = async () => {
    try {
      const items = await api.workspaceAccessSearchUsers(userQuery);
      setUserResults(items);
    } catch (e) {
      showToast((e instanceof Error && e.message) || "Search failed", "error");
    }
  };

  const copyInviteCode = async () => {
    if (!lastPlainCode) return;
    try {
      await navigator.clipboard.writeText(lastPlainCode);
      showToast("Code copied");
    } catch {
      showToast("Could not copy code", "error");
    }
  };

  const loading = tab === "shared" ? outgoing.isLoading : incoming.isLoading;

  return (
    <div className="app-page space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Remote access</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Accept invitations to work in someone else&apos;s workspace, or share
            yours for a limited time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-[min(100%,14rem)]">
            <InputGroupInput
              value={code}
              onChange={(e) => setCode(formatInviteCodeInput(e.target.value))}
              placeholder="ABC-DEF"
              className="uppercase tracking-widest font-mono"
              maxLength={7}
              aria-label="Invite code"
              autoComplete="off"
              spellCheck={false}
            />
            <InputGroupAddon align="inline-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                disabled={!code.trim() || codeMutation.isPending}
                onClick={() => codeMutation.mutate()}
              >
                Apply
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <Button type="button" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share workspace
          </Button>
        </div>
      </header>

      {lastPlainCode ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
        >
          <span>
            Invite code (shown once):{" "}
            <code className="font-mono text-base font-semibold">{lastPlainCode}</code>
          </span>
          <button
            type="button"
            className="app-btn app-btn-secondary inline-flex items-center gap-1.5"
            onClick={() => void copyInviteCode()}
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
        </div>
      ) : null}

      {(incoming.error || outgoing.error) && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Remote access data could not be loaded. Please try again.</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTabs
            level="nested"
            ariaLabel="Remote access sections"
            value={tab}
            onChange={(value) => {
              setTab(value as PageTab);
              setSharedFilterOpen(false);
            }}
            items={tabItems}
            className="min-w-0 flex-1"
          />
          {tab === "shared" ? (
            <div className="relative shrink-0" ref={sharedFilterRef}>
              <FilterToggleButton
                aria-expanded={sharedFilterOpen}
                aria-controls="remote-shared-filters-menu"
                aria-haspopup="menu"
                className="font-semibold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                onClick={() => setSharedFilterOpen((open) => !open)}
                badge={
                  sharedFilter !== "all" ? (
                    <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-bold text-white">
                      1
                    </span>
                  ) : null
                }
              >
                Filters
              </FilterToggleButton>
              {sharedFilterOpen ? (
                <div
                  id="remote-shared-filters-menu"
                  role="menu"
                  aria-label="Share status filters"
                  className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Share status
                  </p>
                  {SHARED_FILTER_OPTIONS.map((option) => {
                    const count =
                      option.value === "all"
                        ? sharedCounts.all
                        : option.value === "active"
                          ? sharedCounts.active
                          : option.value === "pending"
                            ? sharedCounts.pending
                            : sharedCounts.dead;
                    const selected = sharedFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-pink-50 ${
                          selected ? "bg-pink-50/80 font-semibold text-slate-900" : "text-slate-700"
                        }`}
                        onClick={() => setSharedFilter(option.value)}
                      >
                        <span>{option.label}</span>
                        <span className="text-xs tabular-nums text-slate-500">{count}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {tab === "shared" && sharedFilter !== "all" ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-brand-pink">
              Status: {sharedFilterLabel}
              <button
                type="button"
                aria-label="Clear status filter"
                onClick={() => setSharedFilter("all")}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <p className="text-xs text-slate-500">
              Showing {filteredOutgoing.length} of {outgoingRows.length} shares
            </p>
          </div>
        ) : null}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : tab === "invitations" ? (
          incomingRows.length ? (
            <table className="dms-table ef-table min-w-full">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Valid until</th>
                  <th>Modules</th>
                  <th className="dms-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingRows.map((grant) => (
                  <tr
                    key={grant.id}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/20"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{grant.owner_name}</p>
                      {grant.note ? (
                        <p className="text-xs text-slate-500">{grant.note}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatUntil(grant.valid_until)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {moduleSummary(grant.module_keys)}
                    </td>
                    <td className="dms-col-actions px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(grant.id)}
                          title="Accept invitation"
                          aria-label={`Accept invitation from ${grant.owner_name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void api.workspaceAccessDecline(grant.id).then(() => {
                              showToast("Declined");
                              void incoming.refetch();
                            })
                          }
                          title="Decline invitation"
                          aria-label={`Decline invitation from ${grant.owner_name}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              className="py-12"
              title="No invitations"
              description="When someone shares their workspace with you, it will appear here."
            />
          )
        ) : tab === "active" ? (
          activeRows.length ? (
            <table className="dms-table ef-table min-w-full">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Valid until</th>
                  <th>Modules</th>
                  <th className="dms-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((grant) => (
                  <tr
                    key={grant.id}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/20"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{grant.owner_name}</p>
                      {grant.note ? (
                        <p className="text-xs text-slate-500">{grant.note}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatUntil(grant.valid_until)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {moduleSummary(grant.module_keys)}
                    </td>
                    <td className="dms-col-actions px-5 py-4">
                      <div className="flex justify-end">
                        <Button type="button" size="sm" onClick={() => setSessionGrant(grant)}>
                          <MonitorSmartphone className="mr-2 h-4 w-4" />
                          Open workspace
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              className="py-12"
              title="No active access"
              description="Workspaces you've accepted stay here until the access ends, so you can open them again."
            />
          )
        ) : filteredOutgoing.length ? (
          <table className="dms-table ef-table min-w-full">
            <thead>
              <tr>
                <th>Delegate</th>
                <th>Status</th>
                <th>Valid until</th>
                <th>Modules</th>
                <th className="dms-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutgoing.map((grant: WorkspaceGrant) => (
                <tr
                  key={grant.id}
                  className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/20"
                >
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {grant.delegate_name || "Anyone with code"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill
                      label={grantStatusLabel(grant.state)}
                      tone={grantStateTone(grant.state)}
                    />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {formatUntil(grant.valid_until)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {moduleSummary(grant.module_keys)}
                  </td>
                  <td className="dms-col-actions px-5 py-4">
                    {grant.state === "pending" || grant.state === "active" ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="row-action"
                          title="Edit access"
                          aria-label={`Edit access for ${grant.delegate_name || "invite code"}`}
                          onClick={() => openEditModal(grant)}
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="row-action danger"
                          title="Deactivate share"
                          aria-label={`Deactivate share for ${grant.delegate_name || "invite code"}`}
                          disabled={deactivateMutation.isPending}
                          onClick={() => deactivateMutation.mutate(grant.id)}
                        >
                          <PowerOff />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : outgoingRows.length ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No shares in this filter.
          </p>
        ) : (
          <EmptyState
            className="py-12"
            title="Nothing shared yet"
            description="Use Share workspace to invite a colleague with a time limit and module scope."
            action={
              <Button type="button" onClick={() => setShareOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share workspace
              </Button>
            }
          />
        )}
      </section>

      {shareOpen || editingGrant ? (
        <ModalDialog
          title={editingGrant ? "Edit access" : "Share workspace"}
          description={
            editingGrant
              ? `Change which modules ${
                  editingGrant.delegate_name || "the invite code holder"
                } can use and until when. Changes apply to the existing connection.`
              : "Choose who can access your workspace, until when, and which modules they can use."
          }
          size="2xl"
          onClose={closeShareModal}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeShareModal}>
                Cancel
              </Button>
              {editingGrant ? (
                <Button
                  type="button"
                  disabled={
                    !validUntil || selectedKeys.size === 0 || updateMutation.isPending
                  }
                  onClick={() => updateMutation.mutate(editingGrant.id)}
                >
                  Save changes
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={
                    !validUntil || selectedKeys.size === 0 || createMutation.isPending
                  }
                  onClick={() => createMutation.mutate()}
                >
                  Create invitation
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-5">
            {editingGrant ? (
              <div>
                <p className="text-sm font-medium text-slate-700">Delegate</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                  <span>{editingGrant.delegate_name || "Anyone with the invite code"}</span>
                  <StatusPill
                    label={grantStatusLabel(editingGrant.state)}
                    tone={grantStateTone(editingGrant.state)}
                  />
                </div>
              </div>
            ) : (
            <div>
              <label className="text-sm font-medium text-slate-700">Delegate</label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by name or email"
                />
                <Button type="button" variant="outline" onClick={() => void searchUsers()}>
                  Search
                </Button>
              </div>
              {delegateLabel ? (
                <p className="mt-2 text-sm text-slate-600">Selected: {delegateLabel}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Optional if you generate an invite code only.
                </p>
              )}
              {userResults.length > 0 ? (
                <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200">
                  {userResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-pink-50/40"
                        onClick={() => {
                          setDelegateId(u.id);
                          setDelegateLabel(`${u.name} (${u.email})`);
                          setUserResults([]);
                        }}
                      >
                        {u.name} · {u.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700">Valid until</label>
              <Input
                type="datetime-local"
                className="mt-1.5"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Presets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(preset.keys)}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset(eligibleModules.map((m) => m.key))}
                >
                  All I can access
                </Button>
              </div>
            </div>

            <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {eligible.isLoading ? (
                <p className="text-sm text-slate-500">Loading modules…</p>
              ) : (
                groupModules(eligibleModules).map(([group, mods]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.replace(/_/g, " ")}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {mods.map((mod) => (
                        <li key={mod.key}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(mod.key)}
                              onChange={() => toggleKey(mod.key)}
                            />
                            {mod.name}
                            {mod.sensitive ? (
                              <span className="text-xs text-amber-700">Sensitive</span>
                            ) : null}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {editingGrant ? null : (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={generateCode}
                  onChange={(e) => setGenerateCode(e.target.checked)}
                />
                Generate invite code (optional)
              </label>
            )}
          </div>
        </ModalDialog>
      ) : null}

      {sessionGrant ? (
        <RemoteSessionWindow grant={sessionGrant} onClose={closeSession} />
      ) : null}
    </div>
  );
}
