import type { Editor } from "@tiptap/react";
import type { QueryObserverResult } from "@tanstack/react-query";
import { templatesFormsApi } from "../../../../lib/templates-forms-api";

export function editorSelectionPreview(editor: Editor | null) {
  if (!editor) return "";
  const { from, to } = editor.state.selection;
  if (from === to) return "";
  return editor.state.doc.textBetween(from, to, " ").trim();
}

export async function toggleTrackChanges(
  documentId: number,
  enabled: boolean,
  refetch: () => Promise<QueryObserverResult<unknown>>,
) {
  await templatesFormsApi.getDocument(documentId, { track_changes: enabled });
  await refetch();
}

export async function resolveTrackedChange(
  documentId: number,
  changeId: number,
  action: "accept" | "reject",
  refetch: () => Promise<QueryObserverResult<unknown>>,
) {
  await templatesFormsApi.trackedChange(documentId, { action, change_id: changeId });
  await refetch();
}
