"use client";

import { AlertCircle, ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";

export type ApprovalFlow = "any" | "sequential" | "random";

export type ApproverOption = {
  id: number;
  name: string;
  email?: string;
};

type FolderApprovalFieldsProps = {
  requireUploadApproval: boolean;
  onRequireUploadApprovalChange: (value: boolean) => void;
  approvalFlow: ApprovalFlow;
  onApprovalFlowChange: (value: ApprovalFlow) => void;
  approverIds: number[];
  onApproverIdsChange: (value: number[]) => void;
  approvers: ApproverOption[];
  helperText?: string;
};

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-brand-pink" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

export default function FolderApprovalFields({
  requireUploadApproval,
  onRequireUploadApprovalChange,
  approvalFlow,
  onApprovalFlowChange,
  approverIds,
  onApproverIdsChange,
  approvers,
  helperText = "Uses Settings defaults until you customize this folder. Pending uploads for this department follow the same chain.",
}: FolderApprovalFieldsProps) {
  const [search, setSearch] = useState("");
  const sequential = approvalFlow === "sequential";

  const selectedPeople = useMemo(
    () =>
      approverIds
        .map((id) => approvers.find((item) => item.id === id))
        .filter(Boolean) as ApproverOption[],
    [approverIds, approvers],
  );

  const filteredApprovers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return approvers;
    return approvers.filter((item) =>
      `${item.name} ${item.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [approvers, search]);

  const toggleApprover = (id: number) => {
    onApproverIdsChange(
      approverIds.includes(id)
        ? approverIds.filter((value) => value !== id)
        : [...approverIds, id],
    );
  };

  const moveApprover = (id: number, direction: -1 | 1) => {
    const index = approverIds.indexOf(id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= approverIds.length) return;
    const next = [...approverIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onApproverIdsChange(next);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">
            Upload approval for this folder
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p>
        </div>
        <Switch
          checked={requireUploadApproval}
          onChange={() => onRequireUploadApprovalChange(!requireUploadApproval)}
        />
      </div>

      {requireUploadApproval && (
        <>
          <div>
            <p className="text-sm font-bold text-slate-800">Review mode</p>
            <div className="mt-3 grid gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
              {[
                { value: "any" as const, label: "Single approver" },
                { value: "sequential" as const, label: "Sequential" },
                { value: "random" as const, label: "All reviewers" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onApprovalFlowChange(option.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                    approvalFlow === option.value
                      ? "bg-white text-brand-text shadow-sm"
                      : "text-slate-500 hover:bg-white/70"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {sequential && approverIds.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Sequential review needs at least one approver.
            </div>
          )}

          {sequential && selectedPeople.length > 0 && (
            <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Review order
              </p>
              <div className="space-y-2">
                {selectedPeople.map((person, index) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-lg border border-white bg-white px-3 py-2"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-text text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-700">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {person.email || "Workspace user"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => moveApprover(person.id, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveApprover(person.id, 1)}
                      disabled={index === selectedPeople.length - 1}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search approvers..."
              className="field"
            />
            <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {filteredApprovers.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-pink-50"
                >
                  <input
                    type="checkbox"
                    checked={approverIds.includes(person.id)}
                    onChange={() => toggleApprover(person.id)}
                    className="h-4 w-4 accent-pink-600"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-700">
                      {person.name}
                    </span>
                    {person.email && (
                      <span className="block truncate text-xs text-slate-400">
                        {person.email}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function validateFolderApproval(
  requireUploadApproval: boolean,
  approvalFlow: ApprovalFlow,
  approverIds: number[],
) {
  if (!requireUploadApproval) return null;
  if (!approverIds.length) {
    return "Select at least one approver when upload approval is enabled.";
  }
  if (approvalFlow === "sequential" && !approverIds.length) {
    return "Sequential review needs at least one approver.";
  }
  return null;
}

export function approvalFlowLabel(flow: ApprovalFlow) {
  if (flow === "sequential") return "Sequential";
  if (flow === "random") return "All reviewers";
  return "Single approver";
}
