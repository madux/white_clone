"use client";

import ModalDialog from "../ModalDialog";
import { useState } from "react";

export type HolidayFormValues = {
  id?: number;
  name: string;
  date: string;
};

export default function GeneralHolidayDialog({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: HolidayFormValues | null;
  onClose: () => void;
  onSave: (values: HolidayFormValues) => void | Promise<void>;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [date, setDate] = useState(initial?.date || "");

  return (
    <ModalDialog
      title={initial?.id ? "Edit holiday" : "Add holiday"}
      description="Public holidays are skipped when calculating working-day deadlines."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={saving || !name.trim() || !date.trim()}
            onClick={() =>
              onSave({
                id: initial?.id,
                name: name.trim(),
                date: date.trim(),
              })
            }
          >
            {saving ? "Saving…" : "Save holiday"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-1 py-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Holiday name</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Independence Day"
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Date</span>
          <input
            type="date"
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>
    </ModalDialog>
  );
}
