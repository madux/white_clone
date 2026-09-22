"use client";

import { Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAddEmployeeDocumentRelation,
  useEmployeeDocumentRelations,
  useRemoveEmployeeDocumentRelation,
} from "../../../hooks/useEmployeeFiles";
import { DOCUMENT_RELATION_TYPE_OPTIONS } from "../../../lib/documentRelationTypes";
import type { DocDocument, DocDocumentRelation, DocumentRelationType } from "../../../lib/types";
import ModalDialog from "./ModalDialog";

type Props = {
  documentId: number;
  employeeId: number;
  pickerDocuments: DocDocument[];
  isManager: boolean;
  onOpenRelated?: (documentId: number, employeeId: number) => void;
};

export default function DocumentRelationsPanel({
  documentId,
  employeeId,
  pickerDocuments,
  isManager,
  onOpenRelated,
}: Props) {
  const router = useRouter();
  const relations = useEmployeeDocumentRelations(documentId);
  const addRelation = useAddEmployeeDocumentRelation();
  const removeRelation = useRemoveEmployeeDocumentRelation();
  const [showAdd, setShowAdd] = useState(false);
  const [otherId, setOtherId] = useState("");
  const [relationType, setRelationType] =
    useState<DocumentRelationType>("amendment");
  const [linkRole, setLinkRole] = useState<"other_to_this" | "this_to_other">(
    "other_to_this",
  );
  const [formError, setFormError] = useState("");

  const linkedIds = useMemo(() => {
    const ids = new Set<number>();
    (relations.data ?? []).forEach((row) => ids.add(row.related_document_id));
    return ids;
  }, [relations.data]);

  const pickerOptions = useMemo(
    () =>
      pickerDocuments.filter(
        (doc) => doc.id !== documentId && !linkedIds.has(doc.id),
      ),
    [documentId, linkedIds, pickerDocuments],
  );

  const openRelated = (row: DocDocumentRelation) => {
    const targetEmployeeId =
      row.related_employee_id && row.related_employee_id !== employeeId
        ? Number(row.related_employee_id)
        : employeeId;
    if (onOpenRelated) {
      onOpenRelated(row.related_document_id, targetEmployeeId);
      return;
    }
    if (targetEmployeeId === employeeId) return;
    router.push(
      `/pages/employee/profile?employee=${targetEmployeeId}&doc=${row.related_document_id}`,
    );
  };

  const resetForm = () => {
    setOtherId("");
    setRelationType("amendment");
    setLinkRole("other_to_this");
    setFormError("");
  };

  const submitAdd = async () => {
    const targetOther = Number(otherId);
    if (!targetOther) {
      setFormError("Select a document to link.");
      return;
    }
    const payload =
      linkRole === "other_to_this"
        ? {
            source_document_id: targetOther,
            target_document_id: documentId,
            relation_type: relationType,
          }
        : {
            source_document_id: documentId,
            target_document_id: targetOther,
            relation_type: relationType,
          };
    setFormError("");
    try {
      await addRelation.mutateAsync(payload);
      setShowAdd(false);
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not add relationship.",
      );
    }
  };

  const removeLink = async (row: DocDocumentRelation) => {
    if (
      !window.confirm(
        `Remove the link to "${row.related_document_name}"? The documents will not be deleted.`,
      )
    ) {
      return;
    }
    await removeRelation.mutateAsync({
      relationId: row.id,
      documentIds: [documentId, row.related_document_id],
    });
  };

  const items = relations.data ?? [];

  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          <Link2 className="h-3.5 w-3.5" />
          Related documents
        </div>
        {isManager ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
          >
            <Plus className="h-3 w-3" />
            Add link
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Separate files linked by type (amendment, renewal, supporting, and so
        on). Removing a link does not delete either document.
      </p>

      {relations.isLoading ? (
        <p className="mt-3 text-xs text-slate-400">Loading relationships…</p>
      ) : null}

      {!relations.isLoading && !items.length ? (
        <p className="mt-3 text-xs text-slate-400">No related documents yet.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {row.relation_type_label}
                </p>
                <button
                  type="button"
                  onClick={() => openRelated(row)}
                  className="mt-0.5 text-left text-sm font-semibold text-brand-pink hover:underline"
                >
                  {row.related_document_name}
                </button>
                {row.related_document_type ? (
                  <p className="text-xs text-slate-500">{row.related_document_type}</p>
                ) : null}
                {row.related_employee_name &&
                row.related_employee_id !== employeeId ? (
                  <p className="text-xs text-slate-400">
                    {row.related_employee_name}
                  </p>
                ) : null}
              </div>
              {isManager ? (
                <button
                  type="button"
                  title="Remove link"
                  onClick={() => void removeLink(row)}
                  disabled={removeRelation.isPending}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {showAdd ? (
        <ModalDialog
          title="Link document"
          eyebrow="Document relationship"
          description="Choose how this file connects to another document on file."
          onClose={() => {
            setShowAdd(false);
            resetForm();
          }}
          size="md"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="label">Other document</span>
              <select
                className="field w-full"
                value={otherId}
                onChange={(e) => setOtherId(e.target.value)}
              >
                <option value="">Select a document…</option>
                {pickerOptions.map((doc) => (
                  <option key={doc.id} value={String(doc.id)}>
                    {doc.name}
                    {doc.document_type ? ` · ${doc.document_type}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {pickerOptions.length === 0 ? (
              <p className="text-xs text-slate-500">
                No other documents on this employee file are available to link.
              </p>
            ) : null}
            <label className="block">
              <span className="label">Relationship type</span>
              <select
                className="field w-full"
                value={relationType}
                onChange={(e) =>
                  setRelationType(e.target.value as DocumentRelationType)
                }
              >
                {DOCUMENT_RELATION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="space-y-2">
              <legend className="label">Direction</legend>
              <label className="employee-filter-checkbox">
                <input
                  type="radio"
                  name="link-role"
                  checked={linkRole === "other_to_this"}
                  onChange={() => setLinkRole("other_to_this")}
                  className="h-4 w-4 border-slate-300 accent-pink-600"
                />
                <span>
                  The other document is the{" "}
                  {DOCUMENT_RELATION_TYPE_OPTIONS.find(
                    (o) => o.value === relationType,
                  )?.label.toLowerCase()}{" "}
                  for this one
                </span>
              </label>
              <label className="employee-filter-checkbox">
                <input
                  type="radio"
                  name="link-role"
                  checked={linkRole === "this_to_other"}
                  onChange={() => setLinkRole("this_to_other")}
                  className="h-4 w-4 border-slate-300 accent-pink-600"
                />
                <span>
                  This document is the{" "}
                  {DOCUMENT_RELATION_TYPE_OPTIONS.find(
                    (o) => o.value === relationType,
                  )?.label.toLowerCase()}{" "}
                  for the other
                </span>
              </label>
            </fieldset>
            {formError ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  resetForm();
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addRelation.isPending || !otherId}
                onClick={() => void submitAdd()}
                className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {addRelation.isPending ? "Saving…" : "Add link"}
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}
