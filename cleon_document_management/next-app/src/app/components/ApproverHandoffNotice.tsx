"use client";

import { ArrowRightLeft } from "lucide-react";
import type { DocumentType } from "../../../lib/types";
import { APPROVAL_FLOW_LABELS, verifierPhrase } from "../../../lib/verificationPolicy";

export default function ApproverHandoffNotice({
  types,
  verifiedBy,
  entityName = "rule",
  className = "",
}: {
  types: DocumentType[];
  verifiedBy: string;
  entityName?: "rule" | "policy";
  className?: string;
}) {
  if (!types.length) return null;
  const verifier = verifierPhrase(verifiedBy);
  return (
    <div
      role="note"
      className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ${className}`}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Upload approvers are replaced by this {entityName}&apos;s verifier
      </p>
      <p className="mt-1">
        While this {entityName} is active, uploads of the document types below are verified
        by {verifier} instead of the approvers set on the document type. Pending upload
        approvals are cleared once a verification is queued, and existing documents that
        were never verified are sent to {verifier} for verification.
      </p>
      <ul className="mt-2 space-y-1">
        {types.map((type) => {
          const approvers = (type.approvers ?? []).map((user) => user.name);
          return (
            <li key={type.id} className="flex flex-wrap gap-x-1.5">
              <span className="font-semibold">{type.name}</span>
              <span className="text-amber-800">
                · {APPROVAL_FLOW_LABELS[type.approval_flow || "any"] || "Single approver"}
                {approvers.length ? `: ${approvers.join(", ")}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
