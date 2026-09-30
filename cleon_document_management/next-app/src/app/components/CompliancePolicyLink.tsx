"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function compliancePolicyPath(policyId: number): string {
  return `/pages/compliance?policy=${policyId}`;
}

export default function CompliancePolicyLink({
  policyId,
  policyName,
  className = "",
}: {
  policyId: number;
  policyName?: string;
  className?: string;
}) {
  const label = policyName?.trim() || `Policy #${policyId}`;
  return (
    <Link
      href={compliancePolicyPath(policyId)}
      className={`inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 transition-colors hover:border-sky-300 hover:bg-sky-100 ${className}`}
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-sky-700" />
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-600">
          Linked to compliance policy
        </span>
        <span className="block truncate">{label}</span>
      </span>
    </Link>
  );
}
