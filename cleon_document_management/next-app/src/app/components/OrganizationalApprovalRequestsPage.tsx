"use client";

import { ClipboardCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useToast } from "../../../hooks/useToast";
import { canApproveOrgRequests } from "../../../lib/organizationalFilesAccess";
import { useCurrentUser } from "../../../hooks/useDocuments";
import type { OrganizationalApprovalRequest } from "../../../lib/types";
import EmptyState from "./EmptyState";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ThemedSelect from "./ThemedSelect";
import RejectReasonDialog from "./RejectReasonDialog";

const ACTION_LABELS: Record<string, string> = {
  create_folder: "Create folder",
  upload_link_import_scan: "Upload",
  edit_rename_description_colour: "Edit",
  replace_version: "Replace version",
  move: "Move",
  delete: "Delete",
};

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "escalated", label: "Escalated" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Withdrawn" },
  { id: "all", label: "All" },
];

function formatWhen(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value.replace(" ", "T")));
}

function statusTone(state: string): "pending" | "ok" | "neutral" | "attention" {
  if (state === "approved") return "ok";
  if (state === "rejected") return "attention";
  if (state === "escalated") return "attention";
  if (state === "pending") return "pending";
  return "neutral";
}

export default function OrganizationalApprovalRequestsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const currentUserQuery = useCurrentUser();
  const user = currentUserQuery.data;
  const { showAlert, showConfirm } = useAppDialog();
  const { showToast } = useToast();
  const [rows, setRows] = useState<OrganizationalApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionFilter, setActionFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [rejectTarget, setRejectTarget] = useState<"single" | "bulk" | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const canApprove = canApproveOrgRequests(user);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listOrganizationalApprovals(
        statusFilter === "all" ? undefined : statusFilter,
        {
          action_key: actionFilter === "all" ? undefined : actionFilter,
          overdue_only: overdueOnly,
        },
      );
      setRows(data);
      setSelected([]);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load approvals.",
        { title: "Approvals" },
      );
    } finally {
      setLoading(false);
    }
  }, [showAlert, statusFilter, actionFilter, overdueOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const actionOptions = useMemo(() => {
    const keys = new Set(rows.map((row) => row.action_key));
    return [
      { value: "all", label: "All actions" },
      ...Array.from(keys).map((key) => ({
        value: key,
        label: ACTION_LABELS[key] || key,
      })),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (actionFilter === "all") return rows;
    return rows.filter((row) => row.action_key === actionFilter);
  }, [rows, actionFilter]);

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const approve = async (id: number) => {
    if (!canApprove) return;
    const ok = await showConfirm("Approve this request?", { title: "Approve" });
    if (!ok) return;
    try {
      await api.approveOrganizationalApproval(id);
      showToast("Request approved.");
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Approve failed.");
    }
  };

  const reject = (id: number) => {
    if (!canApprove) return;
    setRejectId(id);
    setRejectTarget("single");
  };

  const confirmReject = async (reason: string) => {
    try {
      if (rejectTarget === "bulk") {
        const result = await api.bulkRejectOrganizationalApprovals(selected, reason);
        const failed = result.failed?.length ?? 0;
        showToast(
          failed
            ? `Rejected ${result.rejected?.length ?? 0}; ${failed} failed.`
            : "Requests rejected.",
          failed ? "error" : "success",
        );
      } else if (rejectId) {
        await api.rejectOrganizationalApproval(rejectId, reason);
        showToast("Request rejected.");
      }
      setRejectTarget(null);
      setRejectId(null);
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Reject failed.");
    }
  };

  const withdraw = async (id: number) => {
    const ok = await showConfirm("Withdraw this request?", { title: "Withdraw" });
    if (!ok) return;
    try {
      await api.withdrawOrganizationalApproval(id);
      showToast("Request withdrawn.");
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Withdraw failed.");
    }
  };

  const bulkApprove = async () => {
    if (!selected.length) return;
    const ok = await showConfirm(`Approve ${selected.length} request(s)?`, {
      title: "Bulk approve",
    });
    if (!ok) return;
    try {
      const result = await api.bulkApproveOrganizationalApprovals(selected);
      const failed = result.failed?.length ?? 0;
      showToast(
        failed
          ? `Approved ${result.approved?.length ?? 0}; ${failed} could not be completed.`
          : "Requests approved.",
        failed ? "error" : "success",
      );
      await load();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Bulk approve failed.");
    }
  };

  const bulkReject = () => {
    if (!selected.length) return;
    setRejectTarget("bulk");
  };

  const emptyDescription =
    statusFilter === "pending"
      ? "Organisational folder and document changes that require approver sign-off will appear here."
      : "No requests match the current filters.";

  return (
    <div className={embedded ? "space-y-3" : "space-y-4 p-4"}>
      {!embedded ? (
        <header>
          <h1 className="text-lg font-semibold">Approval requests</h1>
          <p className="text-sm text-muted-foreground">
            Organisational actions submitted when “without approval” is not granted.
          </p>
        </header>
      ) : null}

      <SectionTabs
        ariaLabel="Approval status"
        level="nested"
        value={statusFilter}
        onChange={setStatusFilter}
        items={STATUS_TABS}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ThemedSelect
          ariaLabel="Filter by action"
          value={actionFilter}
          options={actionOptions}
          onChange={setActionFilter}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Checkbox
            checked={overdueOnly}
            onCheckedChange={(checked) => setOverdueOnly(checked === true)}
          />
          Overdue only
        </label>
        {canApprove && selected.length ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void bulkApprove()}>
              Bulk approve ({selected.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => void bulkReject()}>
              Bulk reject
            </Button>
          </div>
        ) : null}
      </div>

      <section className="app-page-body">
        {loading ? (
          <EmptyState title="Loading approval requests…" loading />
        ) : !filteredRows.length ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No approval requests"
            description={emptyDescription}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  {canApprove ? <th className="w-10 px-3 py-2" /> : null}
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Requested by</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Status</th>
                  {canApprove || user ? <th className="px-3 py-2">Decision</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const display = row.display_state || row.state;
                  const isPending = row.state === "pending";
                  const isOwner = user?.id === row.requested_by_id;
                  return (
                    <tr key={row.id} className="border-t">
                      {canApprove ? (
                        <td className="px-3 py-2">
                          {isPending ? (
                            <Checkbox
                              checked={selected.includes(row.id)}
                              onCheckedChange={() => toggleSelected(row.id)}
                              aria-label={`Select request ${row.id}`}
                            />
                          ) : null}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 font-medium">#{row.id}</td>
                      <td className="px-3 py-2">
                        {ACTION_LABELS[row.action_key] || row.action_key}
                      </td>
                      <td className="px-3 py-2">{row.target_label || row.name}</td>
                      <td className="px-3 py-2">{row.requested_by_name}</td>
                      <td className="px-3 py-2">{formatWhen(row.create_date)}</td>
                      <td className="px-3 py-2">{formatWhen(row.due_at)}</td>
                      <td className="px-3 py-2">
                        <StatusPill
                          label={display.charAt(0).toUpperCase() + display.slice(1)}
                          tone={statusTone(display)}
                        />
                      </td>
                      <td className="space-x-2 px-3 py-2">
                        {canApprove && isPending ? (
                          <>
                            <button
                              type="button"
                              className="text-primary underline"
                              onClick={() => void approve(row.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="text-destructive underline"
                              onClick={() => void reject(row.id)}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {isOwner && isPending ? (
                          <button
                            type="button"
                            className="text-slate-600 underline"
                            onClick={() => void withdraw(row.id)}
                          >
                            Withdraw
                          </button>
                        ) : null}
                        {!isPending && row.decision_note ? (
                          <span className="text-xs text-muted-foreground">
                            {row.decision_note}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {rejectTarget ? (
        <RejectReasonDialog
          title={rejectTarget === "bulk" ? "Bulk reject" : "Reject request"}
          onClose={() => {
            setRejectTarget(null);
            setRejectId(null);
          }}
          onConfirm={confirmReject}
        />
      ) : null}
    </div>
  );
}
