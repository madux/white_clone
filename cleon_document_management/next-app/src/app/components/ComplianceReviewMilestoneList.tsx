"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  defaultReviewMilestone,
  type ReviewMilestoneDefinition,
} from "../../../lib/reviewSchedule";
import ThemedSelect from "./ThemedSelect";

export default function ComplianceReviewMilestoneList({
  milestones,
  onChange,
  forms,
}: {
  milestones: ReviewMilestoneDefinition[];
  onChange: (items: ReviewMilestoneDefinition[]) => void;
  forms: { id: number; name: string }[];
}) {
  const [editing, setEditing] = useState<ReviewMilestoneDefinition | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const openNew = () => {
    setEditing(defaultReviewMilestone());
    setEditingIndex(null);
  };

  const save = () => {
    if (!editing?.name.trim()) return;
    if (editingIndex === null) {
      onChange([...milestones, editing]);
    } else {
      onChange(milestones.map((m, i) => (i === editingIndex ? editing : m)));
    }
    setEditing(null);
    setEditingIndex(null);
  };

  const formatTiming = (m: ReviewMilestoneDefinition) => {
    const repeat =
      m.repeat_every_years > 0
        ? `every ${m.repeat_every_years} year(s)`
        : m.repeat_every_months > 0
          ? `every ${m.repeat_every_months} month(s)`
          : "once";
    return `${m.offset_months} month(s) after trigger · ${repeat}`;
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Review milestones</span>
        <button type="button" className="text-sm font-semibold text-brand-pink" onClick={openNew}>
          + Add milestone
        </button>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {milestones.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Add at least one required milestone.
          </p>
        ) : (
          milestones.map((milestone, index) => (
            <div key={`${milestone.id ?? "new"}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{milestone.name}</p>
                <p className="text-xs text-slate-500">
                  {formatTiming(milestone)} ·{" "}
                  {milestone.requirement === "required" ? "Required" : "Optional"}
                </p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-brand-pink"
                onClick={() => {
                  setEditing(milestone);
                  setEditingIndex(index);
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                onClick={() => onChange(milestones.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {editing ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">Name</span>
            <input
              className="field"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Months after trigger</span>
            <input
              type="number"
              min={0}
              className="field"
              value={editing.offset_months}
              onChange={(e) =>
                setEditing({ ...editing, offset_months: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span className="label">Requirement</span>
            <ThemedSelect
              value={editing.requirement}
              onChange={(v) =>
                setEditing({
                  ...editing,
                  requirement: v as ReviewMilestoneDefinition["requirement"],
                })
              }
              options={[
                { value: "required", label: "Required" },
                { value: "optional", label: "Optional" },
              ]}
            />
          </label>
          <label>
            <span className="label">Repeat every (months, 0 = none)</span>
            <input
              type="number"
              min={0}
              className="field"
              value={editing.repeat_every_months}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  repeat_every_months: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className="label">Repeat every (years, 0 = none)</span>
            <input
              type="number"
              min={0}
              className="field"
              value={editing.repeat_every_years}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  repeat_every_years: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Review form (optional)</span>
            <ThemedSelect
              value={String(editing.linked_form_id || "")}
              onChange={(v) =>
                setEditing({
                  ...editing,
                  linked_form_id: v ? Number(v) : false,
                })
              }
              placeholder="No form"
              options={forms.map((f) => ({ value: String(f.id), label: f.name }))}
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm text-slate-500"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button type="button" className="app-btn app-btn-primary" onClick={save}>
              Save milestone
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
