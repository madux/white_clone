"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { api } from "../../../lib/api";
import { formatStatusLabel } from "../../../lib/formatLabel";

function statusClass(displayStatus: string) {
  if (displayStatus === "overdue" || displayStatus === "escalated") {
    return "bg-red-50 text-red-800";
  }
  if (displayStatus === "due_soon") {
    return "bg-amber-50 text-amber-800";
  }
  return "bg-slate-100 text-slate-600";
}

export default function MyReviewsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["compliance", "my-reviews"],
    queryFn: () => api.getMyComplianceReviews(),
  });
  const items = reviews.data?.data ?? [];

  const startReview = async (id: number) => {
    await api.startComplianceReview(id);
    await queryClient.invalidateQueries({ queryKey: ["compliance", "my-reviews"] });
  };

  const completeReview = async (id: number) => {
    await api.completeComplianceReview(id, { outcome: "Completed" });
    await queryClient.invalidateQueries({ queryKey: ["compliance", "my-reviews"] });
  };

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Scheduled reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Policy-driven employee review milestones assigned to you as line manager, HR,
          or policy owner.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ListChecks className="h-4 w-4 text-brand-pink" />
            Open scheduled reviews
          </div>
        </div>
        {reviews.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length ? (
          <table className="ef-table min-w-[720px] text-left">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Review</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-800">{item.employee_name}</td>
                  <td>{item.milestone_name}</td>
                  <td>{String(item.due_date || "").slice(0, 10)}</td>
                  <td>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(
                        item.display_status || item.state,
                      )}`}
                    >
                      {formatStatusLabel(
                        String(item.display_status || item.state || "scheduled"),
                      )}
                    </span>
                    {item.reviewer_not_found ? (
                      <p className="mt-1 text-[10px] text-red-600">
                        {item.reviewer_note || "Reviewer not found"}
                      </p>
                    ) : null}
                  </td>
                  <td className="text-right">
                    {item.state === "scheduled" || item.state === "overdue" ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-pink"
                        onClick={() => void startReview(item.id)}
                      >
                        Start review
                      </button>
                    ) : item.state === "in_progress" ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-pink"
                        onClick={() => void completeReview(item.id)}
                      >
                        Complete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No open reviews assigned to you.
          </div>
        )}
      </div>
    </div>
  );
}
