"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { api } from "../../../lib/api";

export default function MyVerificationsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const queue = useQuery({
    queryKey: ["compliance", "my-verifications"],
    queryFn: () => api.getMyVerifications(),
  });
  const items = queue.data?.data ?? [];

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Verifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Documents routed to you for verification.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClipboardCheck className="h-4 w-4 text-brand-pink" />
            Queue
          </div>
        </div>
        {queue.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length ? (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={String(item.id)} className="px-5 py-4">
                <p className="font-semibold text-slate-800">
                  {String(item.document || "")}
                </p>
                <p className="text-xs text-slate-500">
                  {String(item.employee || "")} · {String(item.policy || "")}
                </p>
                {item.sla_due_at ? (
                  <p className="mt-1 text-xs text-amber-700">
                    SLA due {String(item.sla_due_at).slice(0, 10)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Nothing awaiting your verification.
          </div>
        )}
      </div>
    </div>
  );
}
