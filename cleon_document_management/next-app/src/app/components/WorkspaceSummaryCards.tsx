"use client";

import {
  Briefcase,
  FileText,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { WorkspaceWorkItemsSummary } from "../../../lib/workspaceWorkItems";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";

export default function WorkspaceSummaryCards({
  summary,
}: {
  summary: WorkspaceWorkItemsSummary;
}) {
  const cards = [
    {
      key: "todo",
      label: "To do",
      value: String(summary.todo_count),
      sub: summary.todo_overdue_label,
      icon: Briefcase,
      tone: "pink",
      href: myWorkspaceHref("todo"),
    },
    {
      key: "documents",
      label: "My documents",
      value: String(summary.documents_count),
      sub: summary.documents_expiring_label,
      icon: FileText,
      tone: "violet",
      href: myWorkspaceHref("documents"),
    },
    {
      key: "compliance",
      label: "My compliance",
      value: summary.compliance_status_label,
      sub: summary.compliance_status_detail,
      icon: ShieldCheck,
      tone: "emerald",
      href: myWorkspaceHref("policies"),
    },
    {
      key: "signatures",
      label: "Waiting for my signature",
      value: String(summary.signatures_count),
      sub: summary.signatures_due_label,
      icon: PencilLine,
      tone: "sky",
      href: myWorkspaceHref("todo"),
    },
  ] as const;

  const toneClass = {
    pink: "bg-pink-50 text-brand-pink",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass[card.tone]}`}
          >
            <card.icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className="text-2xl font-bold leading-tight text-slate-900">{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{card.sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
