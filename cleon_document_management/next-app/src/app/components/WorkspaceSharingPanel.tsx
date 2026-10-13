"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Copy,
  MonitorSmartphone,
  Pencil,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { api } from "../../../lib/api";
import type { WorkspaceGrant } from "../../../lib/types";
import {
  accessScopeLabel,
  buildScopeTree,
  documentsFoldersSummary,
  formatUntil,
  toServerDatetime,
} from "../../../lib/workspaceSharingUtils";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { useToast } from "../../../hooks/useToast";
import EmptyState from "./EmptyState";
import FilterToggleButton from "./FilterToggleButton";
import RemoteSessionWindow from "./RemoteSessionWindow";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";
import WorkspaceShareModal, {
  type WorkspaceShareModalSubmit,
} from "./WorkspaceShareModal";

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
  { value: "dead", label: "Expired" },
];

function grantStateTone(state: string): "ok" | "pending" | "danger" | "neutral" {
  if (state === "active") return "ok";
  if (state === "pending") return "pending";
  if (DEAD_GRANT_STATES.has(state)) return "danger";
  return "neutral";
}

function grantStatusLabel(state: string) {
  if (state === "active") return "Active";
  if (state === "pending") return "Pending";
  if (state === "expired") return "Expired";
  if (DEAD_GRANT_STATES.has(state)) return "Expired";
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

function matchesSearch(grant: WorkspaceGrant, query: string, outgoing: boolean) {
  if (!query.trim()) return true;
  const term = query.trim().toLowerCase();
  const hay = [
    outgoing ? grant.delegate_name : grant.owner_name,
    grant.note || "",
    ...(grant.module_keys || []),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(term);
}

export default function WorkspaceSharingPanel({
  embedded = false,
  shareModalOpen = false,
  onShareModalOpenChange,
}: {
  embedded?: boolean;
  shareModalOpen?: boolean;
  onShareModalOpenChange?: (open: boolean) => void;
}) {
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
  const foldersQuery = useQuery({
    queryKey: ["workspace-sharing", "folders"],
    queryFn: () => api.getFolders(),
  });

  const [tab, setTab] = useState<PageTab>("invitations");
  const [sharedFilter, setSharedFilter] = useState<SharedFilter>("all");
  const [sharedFilterOpen, setSharedFilterOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [sessionGrant, setSessionGrant] = useState<WorkspaceGrant | null>(null);
  const [editingGrant, setEditingGrant] = useState<WorkspaceGrant | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const sharedFilterRef = useRef<HTMLDivElement>(null);

  useClickOutside(sharedFilterRef, () => setSharedFilterOpen(false));

  useEffect(() => {
    if (shareModalOpen) {
      setShareOpen(true);
      onShareModalOpenChange?.(false);
    }
  }, [shareModalOpen, onShareModalOpenChange]);

  const setShareOpenState = (open: boolean) => {
    setShareOpen(open);
    if (!open) onShareModalOpenChange?.(false);
  };

  const closeSession = useCallback(() => {
    setSessionGrant(null);
    void api.workspaceAccessClearSession().catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
  }, [queryClient]);

  const [code, setCode] = useState("");
  const [lastPlainCode, setLastPlainCode] = useState<string | null>(null);

  const incomingPending = useMemo(
    () => (incoming.data ?? []).filter((grant) => grant.state === "pending"),
    [incoming.data],
  );
  const incomingActive = useMemo(
    () => (incoming.data ?? []).filter((grant) => grant.state === "active"),
    [incoming.data],
  );
  const incomingRows = useMemo(
    () => incomingPending.filter((grant) => matchesSearch(grant, listSearch, false)),
    [incomingPending, listSearch],
  );
  const activeRows = useMemo(
    () => incomingActive.filter((grant) => matchesSearch(grant, listSearch, false)),
    [incomingActive, listSearch],
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
    () =>
      outgoingRows.filter(
        (g) =>
          matchesSharedFilter(g.state, sharedFilter) &&
          matchesSearch(g, listSearch, true),
      ),
    [outgoingRows, sharedFilter, listSearch],
  );

  const tabItems = useMemo(
    (): { id: PageTab; label: string; count: number }[] => [
      { id: "invitations", label: "Invitations", count: incomingPending.length },
      { id: "active", label: "Active access", count: incomingActive.length },
      {
        id: "shared",
        label: "Shared by you",
        count: outgoingRows.filter((g) => g.state !== "declined").length,
      },
    ],
    [incomingActive.length, incomingPending.length, outgoingRows],
  );

  const eligibleModules = eligible.data ?? [];
  const scopeTree = useMemo(
    () => buildScopeTree(foldersQuery.data ?? [], eligibleModules),
    [foldersQuery.data, eligibleModules],
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
      showToast("Workspace access activated");
      setCode("");
      setTab("active");
      setSessionGrant(grant);
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const createMutation = useMutation({
    mutationFn: (payload: WorkspaceShareModalSubmit) =>
      api.workspaceAccessCreateInvite({
        delegate_id: payload.delegate_id,
        valid_until: toServerDatetime(payload.valid_until),
        module_keys: payload.module_keys,
        generate_code: payload.generate_code,
        note: payload.note,
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
    mutationFn: ({
      grantId,
      payload,
    }: {
      grantId: number;
      payload: WorkspaceShareModalSubmit;
    }) =>
      api.workspaceAccessUpdateGrant({
        grant_id: grantId,
        valid_until: toServerDatetime(payload.valid_until),
        module_keys: payload.module_keys,
      }),
    onSuccess: () => {
      showToast("Access updated");
      closeShareModal();
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: number) => api.workspaceAccessRevoke(grantId),
    onSuccess: () => {
      showToast("Access revoked");
      void queryClient.invalidateQueries({ queryKey: ["workspace-access"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const openEditModal = (grant: WorkspaceGrant) => {
    setEditingGrant(grant);
    setShareOpenState(true);
  };

  const closeShareModal = () => {
    setShareOpenState(false);
    setEditingGrant(null);
  };

  const searchUsers = async (query: string) => api.workspaceAccessSearchUsers(query);

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
  const modalOpen = shareOpen || Boolean(editingGrant);

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="w-full max-w-xs">
          <InputGroupInput
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search workspace sharing"
          />
        </InputGroup>
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
          <Button type="button" onClick={() => setShareOpenState(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share workspace
          </Button>
        </div>
      </div>

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
          <span>Workspace sharing data could not be loaded. Please try again.</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTabs
            level="nested"
            ariaLabel="Workspace sharing sections"
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
                aria-controls="shared-filters-menu"
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
                  id="shared-filters-menu"
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
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
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : tab === "invitations" ? (
          incomingRows.length ? (
            <table className="dms-table ef-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Name / email</th>
                  <th>Access scope</th>
                  <th>Documents / folders</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th className="dms-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingRows.map((grant) => (
                  <tr key={grant.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{grant.owner_name}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {accessScopeLabel(grant.module_keys)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {documentsFoldersSummary(grant.module_keys, grant.note)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatUntil(grant.valid_until)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill label="Pending" tone="pending" />
                    </td>
                    <td className="dms-col-actions px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(grant.id)}
                        >
                          Accept
                        </Button>
                        <button
                          type="button"
                          title="Decline"
                          onClick={() =>
                            void api.workspaceAccessDecline(grant.id).then(() => {
                              showToast("Declined");
                              void incoming.refetch();
                            })
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600"
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
            <table className="dms-table ef-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Name / email</th>
                  <th>Access scope</th>
                  <th>Documents / folders</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th className="dms-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((grant) => (
                  <tr key={grant.id}>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {grant.owner_name}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {accessScopeLabel(grant.module_keys)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {documentsFoldersSummary(grant.module_keys, grant.note)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatUntil(grant.valid_until)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill label="Active" tone="ok" />
                    </td>
                    <td className="dms-col-actions px-5 py-4">
                      <Button type="button" size="sm" onClick={() => setSessionGrant(grant)}>
                        <MonitorSmartphone className="mr-2 h-4 w-4" />
                        Open workspace
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              className="py-12"
              title="No active access"
              description="Accepted workspaces stay here until access ends."
            />
          )
        ) : filteredOutgoing.length ? (
          <table className="dms-table ef-table min-w-[720px]">
            <thead>
              <tr>
                <th>Name / email</th>
                <th>Access scope</th>
                <th>Documents / folders</th>
                <th>Valid until</th>
                <th>Status</th>
                <th className="dms-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutgoing.map((grant) => (
                <tr key={grant.id}>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {grant.delegate_name || "Anyone with code"}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {accessScopeLabel(grant.module_keys)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {documentsFoldersSummary(grant.module_keys, grant.note)}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {formatUntil(grant.valid_until)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill
                      label={grantStatusLabel(grant.state)}
                      tone={grantStateTone(grant.state)}
                    />
                  </td>
                  <td className="dms-col-actions px-5 py-4">
                    {grant.state === "pending" || grant.state === "active" ? (
                      <div className="flex items-center justify-end gap-2">
                        {grant.state === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(grant)}
                          >
                            Resend
                          </Button>
                        ) : null}
                        <button
                          type="button"
                          className="row-action"
                          title="Edit access"
                          onClick={() => openEditModal(grant)}
                        >
                          <Pencil />
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-700"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(grant.id)}
                        >
                          Revoke
                        </Button>
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
          <p className="p-8 text-center text-sm text-slate-400">No shares in this filter.</p>
        ) : (
          <EmptyState
            className="py-12"
            title="Nothing shared yet"
            description="Use Share workspace to invite a colleague with a time limit and scope."
            action={
              <Button type="button" onClick={() => setShareOpenState(true)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share workspace
              </Button>
            }
          />
        )}
      </section>

      <WorkspaceShareModal
        open={modalOpen}
        editingGrant={editingGrant}
        eligibleModules={eligibleModules}
        scopeTree={scopeTree}
        foldersLoading={foldersQuery.isLoading}
        onClose={closeShareModal}
        onSearchUsers={searchUsers}
        onSubmitCreate={(payload) => createMutation.mutate(payload)}
        onSubmitUpdate={(grantId, payload) =>
          updateMutation.mutate({ grantId, payload })
        }
        createPending={createMutation.isPending}
        updatePending={updateMutation.isPending}
      />

      {sessionGrant ? (
        <RemoteSessionWindow grant={sessionGrant} onClose={closeSession} />
      ) : null}
    </div>
  );
}
