"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { documentPreviewUrl } from "../../../lib/documentPreviewUrls";
import { formatStatusLabel } from "../../../lib/formatLabel";
import {
  VERIFICATION_REJECTION_REASONS,
} from "../../../lib/reviewQueue";
import type { ComplianceVerificationItem } from "../../../lib/types";
import DocumentViewerDialog from "./DocumentViewerDialog";
import ThemedSelect from "./ThemedSelect";

function statusClass(displayStatus: string) {
  if (displayStatus === "overdue" || displayStatus === "escalated") {
    return "bg-red-50 text-red-800";
  }
  if (displayStatus === "due_soon") {
    return "bg-amber-50 text-amber-800";
  }
  return "bg-slate-100 text-slate-600";
}

export default function ComplianceVerificationsSection({
  embedded = false,
  onOpenReview,
}: {
  embedded?: boolean;
  onOpenReview?: (item: ComplianceVerificationItem) => void;
}) {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["compliance", "my-verifications"],
    queryFn: () => api.getMyVerifications(),
  });
  const items = reviews.data?.data ?? [];

  const [active, setActive] = useState<ComplianceVerificationItem | null>(null);
  const [detail, setDetail] = useState<ComplianceVerificationItem | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("illegible");
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState("");

  const loadDetail = async (item: ComplianceVerificationItem) => {
    const result = await api.getComplianceVerificationDetail(item.id);
    if (result.success && result.data) {
      setDetail(result.data);
      setActive(item);
      onOpenReview?.(item);
    }
  };

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.approveComplianceVerification(id),
    onSuccess: async (result) => {
      if (!result.success) {
        setActionError(result.message || "Unable to approve.");
        return;
      }
      setActive(null);
      setDetail(null);
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["compliance", "my-verifications"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: number; reason_code: string; note?: string }) =>
      api.rejectComplianceVerification(payload.id, {
        reason_code: payload.reason_code,
        note: payload.note,
      }),
    onSuccess: async (result) => {
      if (!result.success) {
        setActionError(result.message || "Unable to reject.");
        return;
      }
      setRejectOpen(false);
      setActive(null);
      setDetail(null);
      setRejectNote("");
      setActionError("");
      await queryClient.invalidateQueries({ queryKey: ["compliance", "my-verifications"] });
    },
  });

  const viewing = detail || active;

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      {!embedded ? (
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Compliance verifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Evidence submitted for compliance policies awaiting your verification.
          </p>
        </header>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClipboardCheck className="h-4 w-4 text-brand-pink" />
            Pending verifications
          </div>
        </div>
        {reviews.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length ? (
          <table className="ef-table min-w-[720px] text-left">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Document</th>
                <th>Policy</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-800">{item.employee_name}</td>
                  <td>{item.document_name}</td>
                  <td>{item.policy_name}</td>
                  <td>{String(item.sla_due_at || "").slice(0, 10)}</td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(
                        item.display_status || item.status,
                      )}`}
                    >
                      {formatStatusLabel(
                        String(item.display_status || item.status || "pending"),
                      )}
                    </span>
                    {item.verifier_note ? (
                      <p className="mt-1 text-[10px] text-amber-700">{item.verifier_note}</p>
                    ) : null}
                  </td>
                  <td className="text-right">
                    {item.can_act !== false ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-pink"
                        onClick={() => void loadDetail(item)}
                      >
                        Review
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Nothing awaiting your verification.
          </div>
        )}
      </div>

      {viewing && !rejectOpen ? (
        <DocumentViewerDialog
          title={viewing.document_name}
          description={[viewing.employee_name, viewing.policy_name]
            .filter(Boolean)
            .join(" · ")}
          documentId={viewing.document_id}
          onClose={() => {
            setActive(null);
            setDetail(null);
            setActionError("");
          }}
          previewUrl={documentPreviewUrl(viewing.document_id, { variant: "pending" })}
          currentVersionNumber={viewing.current_version_number}
          initialVersionId={viewing.previous_version_id || null}
          footer={
            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              {viewing.issue_date || viewing.expiry_date ? (
                <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  {viewing.issue_date ? (
                    <>
                      <dt className="font-semibold">Issue date</dt>
                      <dd>{viewing.issue_date.slice(0, 10)}</dd>
                    </>
                  ) : null}
                  {viewing.expiry_date ? (
                    <>
                      <dt className="font-semibold">Expiry</dt>
                      <dd>{viewing.expiry_date.slice(0, 10)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
              {actionError ? (
                <p className="text-sm text-red-600">{actionError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <button
                  type="button"
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  onClick={() => approveMutation.mutate(viewing.id)}
                  className="app-btn app-btn-primary"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </div>
          }
        />
      ) : null}

      {viewing && rejectOpen ? (
        <DocumentViewerDialog
          title="Reject verification"
          description={viewing.document_name}
          onClose={() => setRejectOpen(false)}
          size="md"
          placeholder={
            <div className="space-y-4 p-2">
              <label>
                <span className="label">Reason</span>
                <ThemedSelect
                  value={reasonCode}
                  onChange={setReasonCode}
                  options={VERIFICATION_REJECTION_REASONS}
                />
              </label>
              {reasonCode === "other" ? (
                <label>
                  <span className="label">Note</span>
                  <textarea
                    className="field min-h-[5rem]"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                </label>
              ) : null}
              {actionError ? (
                <p className="text-sm text-red-600">{actionError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="app-btn app-btn-secondary"
                  onClick={() => setRejectOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="app-btn app-btn-primary"
                  disabled={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate({
                      id: viewing.id,
                      reason_code: reasonCode,
                      note: reasonCode === "other" ? rejectNote : undefined,
                    })
                  }
                >
                  Confirm reject
                </button>
              </div>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
