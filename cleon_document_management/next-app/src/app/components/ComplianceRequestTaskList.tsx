"use client";

import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import ComplianceRequestTaskModal from "./ComplianceRequestTaskModal";
import {
  TASK_TYPE_LABELS,
  type ComplianceLinkableContext,
  type ComplianceRequestTaskDefinition,
} from "../../../lib/complianceRequestTasks";
import type { DocumentType } from "../../../lib/types";

export default function ComplianceRequestTaskList({
  tasks,
  onChange,
  documentTypes,
  linkableContext,
  forms,
}: {
  tasks: ComplianceRequestTaskDefinition[];
  onChange: (tasks: ComplianceRequestTaskDefinition[]) => void;
  documentTypes: DocumentType[];
  linkableContext: ComplianceLinkableContext;
  forms: { id: number; name: string }[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const openCreate = () => {
    setEditingIndex(null);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    setEditingIndex(index);
    setModalOpen(true);
  };

  const saveTask = (task: ComplianceRequestTaskDefinition) => {
    if (editingIndex === null) {
      onChange([...tasks, task]);
      return;
    }
    onChange(tasks.map((item, index) => (index === editingIndex ? task : item)));
  };

  const removeTask = (index: number) => {
    onChange(tasks.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Tasks</span>
        <button type="button" className="text-sm font-semibold text-brand-pink" onClick={openCreate}>
          + Add task
        </button>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Add at least one required task for this compliance request.
          </p>
        ) : (
          tasks.map((task, index) => (
            <div
              key={`${task.id ?? "new"}-${index}`}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{task.name}</p>
                <p className="text-xs text-slate-500">
                  {TASK_TYPE_LABELS[task.task_type]}
                  {task.task_type === "read" || task.task_type === "acknowledge"
                    ? task.linked_org_policy_name || task.linked_document_name
                      ? ` · ${task.linked_org_policy_name || task.linked_document_name}`
                      : ""
                    : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  task.requirement === "required"
                    ? "bg-pink-50 text-pink-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {task.requirement === "required" ? "Required" : "Optional"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  onClick={() => openEdit(index)}
                  aria-label="Edit task"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => removeTask(index)}
                  aria-label="Remove task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <MoreHorizontal className="h-4 w-4 text-slate-300" aria-hidden />
              </div>
            </div>
          ))
        )}
      </div>
      <ComplianceRequestTaskModal
        open={modalOpen}
        initial={editingIndex === null ? null : tasks[editingIndex]}
        documentTypes={documentTypes}
        linkableContext={linkableContext}
        forms={forms}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
      />
    </div>
  );
}
