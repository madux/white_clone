"use client";

import { X } from "lucide-react";

export type TrackedChangeItem = {
  id: number;
  change_type: string;
  before_text: string;
  after_text: string;
  applied: boolean;
  author: string;
  created_at?: string;
};

export default function EditorTrackedChangesPanel({
  changes,
  trackingEnabled,
  onClose,
  onAccept,
  onReject,
}: {
  changes: TrackedChangeItem[];
  trackingEnabled: boolean;
  onClose: () => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const pending = changes.filter((item) => !item.applied);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Track changes</h2>
          <p className="text-xs text-slate-500">
            {trackingEnabled ? "Tracking is on" : "Tracking is off"}
          </p>
        </div>
        <button type="button" aria-label="Close track changes" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {pending.length === 0 ? (
          <p className="text-xs text-slate-500">No pending revisions.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-100 p-3 text-xs">
                <p className="font-semibold text-slate-700">{item.author}</p>
                <p className="mt-1 text-slate-500">{item.change_type}</p>
                {item.before_text ? (
                  <p className="mt-2 line-through text-red-700/80">{item.before_text.slice(0, 240)}</p>
                ) : null}
                {item.after_text ? (
                  <p className="mt-1 text-emerald-800">{item.after_text.slice(0, 240)}</p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-brand-pink"
                    onClick={() => onAccept(item.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-slate-500"
                    onClick={() => onReject(item.id)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
