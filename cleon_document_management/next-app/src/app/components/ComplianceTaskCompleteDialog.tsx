"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import ModalDialog from "./ModalDialog";
import { api } from "../../../lib/api";
import { organizationalDocumentHref } from "../../../lib/documentLinks";

export default function ComplianceTaskCompleteDialog({
  task,
  onClose,
  onCompleted,
}: {
  task: {
    id: number;
    title: string;
    task_type: string;
    declaration_text?: string;
    evidence_document_type_id?: number;
    linked_form_id?: number;
    linked_document_id?: number;
    linked_folder_id?: number;
  };
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [comment, setComment] = useState("");
  const [issueDeclared, setIssueDeclared] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const contentHref =
    task.linked_folder_id && task.linked_document_id
      ? organizationalDocumentHref(task.linked_folder_id, task.linked_document_id)
      : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      if (task.task_type === "declaration") {
        payload.accepted = true;
        payload.comment = comment;
        payload.issue_declared = issueDeclared;
      } else if (task.task_type === "upload_evidence") {
        payload.document_id = Number(documentId);
      } else if (task.task_type === "complete_form") {
        payload.submission_id = Number(submissionId);
      }
      await api.completeComplianceTask(task.id, payload);
      onCompleted();
      onClose();
    } catch (caught: any) {
      setError(caught?.message || "Could not complete this task.");
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalDialog title={task.title} eyebrow="Compliance task" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-3">
        {task.task_type === "declaration" && task.declaration_text ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {task.declaration_text}
          </p>
        ) : null}
        {task.task_type === "declaration" ? (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                required
                className="h-4 w-4 rounded accent-pink-600"
              />
              I accept this declaration
            </label>
            <textarea
              className="field min-h-20"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional comment"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={issueDeclared}
                onChange={(event) => setIssueDeclared(event.target.checked)}
                className="h-4 w-4 rounded accent-pink-600"
              />
              I need to report an issue
            </label>
          </>
        ) : null}
        {task.task_type === "upload_evidence" ? (
          <label className="block space-y-1">
            <span className="label">Uploaded document ID</span>
            <input
              required
              className="field"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
              placeholder="Employee Files document ID"
            />
          </label>
        ) : null}
        {task.task_type === "complete_form" ? (
          <label className="block space-y-1">
            <span className="label">Form submission ID</span>
            <input
              required
              className="field"
              value={submissionId}
              onChange={(event) => setSubmissionId(event.target.value)}
              placeholder="Submission ID after submitting the form"
            />
          </label>
        ) : null}
        {task.task_type === "read" || task.task_type === "acknowledge" ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              Open the linked content, then confirm here once you have{" "}
              {task.task_type === "read" ? "read" : "acknowledged"} it.
            </p>
            {contentHref ? (
              <Link
                href={contentHref}
                className="inline-flex font-semibold text-brand-pink hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Organization
              </Link>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
