"use client";

import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { api } from "../../../lib/api";
import { formatStatusLabel } from "../../../lib/formatLabel";

export default function MyReviewsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const reviews = useQuery({
    queryKey: ["compliance", "my-reviews"],
    queryFn: () => api.getMyComplianceReviews(),
  });
  const items = reviews.data?.data ?? [];

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scheduled reviews and compliance tasks assigned to you.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ListChecks className="h-4 w-4 text-brand-pink" />
            Open reviews
          </div>
        </div>
        {reviews.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length ? (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li
                key={String(item.id)}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {String(item.title || "")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {String(item.employee || "")}
                    {item.due_date
                      ? ` · Due ${String(item.due_date).slice(0, 10)}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                  {formatStatusLabel(String(item.status || "todo"))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No open reviews assigned to you.
          </div>
        )}
      </div>
    </div>
  );
}
