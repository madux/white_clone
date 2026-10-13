"use client";

import {
  ClipboardList,
  CloudUpload,
  Clock,
  FileText,
  FolderOpen,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import ComplianceRequestTaskModal from "./ComplianceRequestTaskModal";
import {
  TASK_TYPE_LABELS,
  type ComplianceLinkableContext,
  type ComplianceRequestTaskDefinition,
  type ComplianceRequestTaskType,
} from "../../../lib/complianceRequestTasks";
import type { DocumentType } from "../../../lib/types";

const TASK_TYPE_DISPLAY: Record<ComplianceRequestTaskType, string> = {
  read: "Read content",
  acknowledge: "Policy sign-off",
  declaration: "Declaration",
  upload_evidence: "Document upload",
  complete_form: "Complete form",
};

const TASK_ESTIMATE_MINUTES: Record<ComplianceRequestTaskType, number> = {
  read: 5,
  acknowledge: 5,
  declaration: 3,
  upload_evidence: 10,
  complete_form: 15,
};

function TaskTypeIcon({ type }: { type: ComplianceRequestTaskType }) {
  const className = "h-5 w-5 text-brand-pink";
  switch (type) {
    case "upload_evidence":
      return <CloudUpload className={className} aria-hidden />;
    case "complete_form":
      return <ClipboardList className={className} aria-hidden />;
    case "declaration":
      return <PenLine className={className} aria-hidden />;
    default:
      return <FileText className={className} aria-hidden />;
  }
}

export default function ComplianceRequestTaskList({
  tasks,
  onChange,
  documentTypes,
  linkableContext,
  forms,
  variant = "compact",
}: {
  tasks: ComplianceRequestTaskDefinition[];
  onChange: (tasks: ComplianceRequestTaskDefinition[]) => void;
  documentTypes: DocumentType[];
  linkableContext: ComplianceLinkableContext;
  forms: { id: number; name: string }[];
  variant?: "compact" | "cards";
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

  const taskSubtitle = (task: ComplianceRequestTaskDefinition) => {
    if (task.instructions?.trim()) return task.instructions.trim();
    if (task.task_type === "read" || task.task_type === "acknowledge") {
      return (
        task.linked_org_policy_name ||
        task.linked_document_name ||
        "Linked organisational content"
      );
    }
    if (task.task_type === "upload_evidence") {
      const typeName = documentTypes.find(
        (t) => t.id === task.evidence_document_type_id,
      )?.name;
      return typeName
        ? `Upload a document of type: ${typeName}`
        : "Upload required evidence";
    }
    if (task.task_type === "complete_form") {
      const formName = forms.find((f) => f.id === task.linked_form_id)?.name;
      return formName ? `Complete form: ${formName}` : "Complete assigned form";
    }
    if (task.task_type === "declaration" && task.declaration_text?.trim()) {
      return task.declaration_text.trim();
    }
    return TASK_TYPE_LABELS[task.task_type];
  };

  const headerRow = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">Tasks</span>
        {tasks.length > 0 ? (
          <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-bold text-brand-pink">
            {tasks.length} active
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {variant === "cards" && tasks.length > 0 ? (
          <button
            type="button"
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            onClick={() => onChange([])}
          >
            Clear all tasks
          </button>
        ) : null}
        <button
          type="button"
          className={
            variant === "cards"
              ? "inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3.5 py-1.5 text-sm font-semibold text-brand-pink hover:bg-pink-100"
              : "text-sm font-semibold text-brand-pink"
          }
          onClick={openCreate}
        >
          {variant === "cards" ? (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              Add task
            </>
          ) : (
            "+ Add task"
          )}
        </button>
      </div>
    </div>
  );

  const renderCard = (
    task: ComplianceRequestTaskDefinition,
    index: number,
    header: { name: string; count: number } | null,
  ) => (
    <div key={`${task.id ?? "new"}-${index}`}>
      {header ? (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
          <FolderOpen className="h-3.5 w-3.5 text-brand-pink" aria-hidden />
          {header.name}
          <span className="font-normal text-slate-400">· {header.count} files</span>
        </div>
      ) : null}
      <article
        className="group relative rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-pink-200 hover:shadow-sm"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => removeTask(index)}
          aria-label={`Remove ${task.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex w-full gap-4 pr-8 text-left"
          onClick={() => openEdit(index)}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50">
            <TaskTypeIcon type={task.task_type} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                {index + 1}. {task.name}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-pink-200 bg-pink-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-brand-pink">
                {TASK_TYPE_DISPLAY[task.task_type]}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                {task.requirement === "required" ? "Required" : "Optional"}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-slate-500">
              {taskSubtitle(task)}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Est. {TASK_ESTIMATE_MINUTES[task.task_type]} mins to complete
            </p>
          </div>
        </button>
      </article>
    </div>
  );

  const renderCompactRow = (
    task: ComplianceRequestTaskDefinition,
    index: number,
    header: { name: string; count: number } | null,
    grouped: boolean,
  ) => (
    <div key={`${task.id ?? "new"}-${index}`}>
      {header ? (
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <FolderOpen className="h-3.5 w-3.5 text-brand-pink" aria-hidden />
          {header.name}
          <span className="font-normal text-slate-400">· {header.count} files</span>
        </div>
      ) : null}
      <div
        className={`flex items-center gap-3 py-2.5 pr-3 ${grouped ? "pl-6" : "pl-3"}`}
      >
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
        <button
          type="button"
          className="rounded-md p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => removeTask(index)}
          aria-label="Remove task"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  let listBody: ReactNode;
  if (tasks.length === 0) {
    listBody = (
      <div
        className={
          variant === "cards"
            ? "rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center"
            : "px-4 py-6 text-center"
        }
      >
        <p className="text-sm text-slate-500">
          Add at least one required task for this compliance request.
        </p>
        {variant === "cards" ? (
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-pink hover:bg-pink-50"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add your first task
          </button>
        ) : null}
      </div>
    );
  } else if (variant === "cards") {
    listBody = (
      <div className="space-y-3">
        {tasks.map((task, index) =>
          renderCard(task, index, groupHeaderAt(index)),
        )}
      </div>
    );
  } else {
    listBody = (
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {tasks.map((task, index) => {
          const header = groupHeaderAt(index);
          const grouped =
            Boolean(task.source_folder_id) &&
            (folderGroupSizes.get(task.source_folder_id ?? 0) ?? 0) > 1;
          return renderCompactRow(task, index, header, grouped);
        })}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      {headerRow}
      {listBody}
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
    </section>
  );
}
