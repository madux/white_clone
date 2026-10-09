"use client";

import { FolderOpen, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

  const saveTasks = (saved: ComplianceRequestTaskDefinition[]) => {
    if (editingIndex === null) {
      onChange([...tasks, ...saved]);
      return;
    }
    onChange(
      tasks.flatMap((item, index) => (index === editingIndex ? saved : [item])),
    );
  };

  const folderGroupSizes = tasks.reduce<Map<number, number>>((sizes, task) => {
    if (task.source_folder_id) {
      sizes.set(task.source_folder_id, (sizes.get(task.source_folder_id) ?? 0) + 1);
    }
    return sizes;
  }, new Map());

  const groupHeaderAt = (index: number) => {
    const folderId = tasks[index].source_folder_id;
    if (!folderId || (folderGroupSizes.get(folderId) ?? 0) < 2) return null;
    if (index > 0 && tasks[index - 1].source_folder_id === folderId) return null;
    return {
      name: tasks[index].source_folder_name || "Folder",
      count: folderGroupSizes.get(folderId) ?? 0,
    };
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
          tasks.map((task, index) => {
            const header = groupHeaderAt(index);
            const grouped =
              Boolean(task.source_folder_id) &&
              (folderGroupSizes.get(task.source_folder_id ?? 0) ?? 0) > 1;
            return (
            <div key={`${task.id ?? "new"}-${index}`}>
            {header ? (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <FolderOpen className="h-3.5 w-3.5 text-brand-pink" aria-hidden />
                {header.name}
                <span className="font-normal text-slate-400">
                  · {header.count} files
                </span>
              </div>
            ) : null}
            <div
              className={`flex items-center gap-3 py-2.5 pr-3 ${grouped ? "pl-6" : "pl-3"}`}
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
            </div>
            );
          })
        )}
      </div>
      {modalOpen ? (
      <ComplianceRequestTaskModal
        key={editingIndex ?? "new"}
        open={modalOpen}
        initial={editingIndex === null ? null : tasks[editingIndex]}
        documentTypes={documentTypes}
        linkableContext={linkableContext}
        forms={forms}
        onClose={() => setModalOpen(false)}
        onSave={saveTasks}
      />
      ) : null}
    </div>
  );
}
