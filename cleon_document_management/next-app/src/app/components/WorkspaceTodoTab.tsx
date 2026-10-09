"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../lib/dmsContractsApi";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import { reviewQueueHref } from "../../../lib/reviewQueue";
import EmptyState from "./EmptyState";

type WorkItem = {
  id?: string;
  title?: string;
  subtitle?: string;
  action_label?: string;
  href?: string;
  urgency?: string;
};

export default function WorkspaceTodoTab({ kind }: { kind?: string | null }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    dmsContractsApi.workItems().then((result) => {
      if (!active) return;
      if (result.success) {
        setItems((result.data.items || []) as WorkItem[]);
        setSource(result.data.source || "");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading your to do list…</p>;
  }

  if (!items.length) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="You're all caught up"
          description={
            source === "pending_developer_b"
              ? "The unified work item feed (Developer B) is not connected yet. Use the links below for legacy queues."
              : "Approvals, signatures, and requests assigned to you will appear here."
          }
        />
        <div className="flex flex-wrap gap-2 text-sm">
          {kind === "approval" || !kind ? (
            <Link
              href={reviewQueueHref("compliance")}
              className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-brand-pink"
            >
              Open approvals queue
            </Link>
          ) : null}
          <Link
            href={myWorkspaceHref("policies")}
            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700"
          >
            Policies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {items.map((item, index) => (
        <li key={item.id || index} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{item.title}</p>
            {item.subtitle ? (
              <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
            ) : null}
          </div>
          {item.href ? (
            <Link
              href={item.href}
              className="shrink-0 rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-bold text-white"
            >
              {item.action_label || "Open"}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
