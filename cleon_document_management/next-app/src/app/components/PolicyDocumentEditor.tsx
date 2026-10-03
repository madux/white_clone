"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATE_KEYS } from "../../../hooks/useTemplatesForms";
import { MessageSquare } from "lucide-react";
import { useTemplateDocument } from "../../../hooks/useTemplatesForms";
import { templatesFormsApi } from "../../../lib/templates-forms-api";
import CleonAIPanel from "./templates-forms/CleonAIPanel";
import EditorCommentsPanel from "./templates-forms/EditorCommentsPanel";
import EditorTrackedChangesPanel, {
  type TrackedChangeItem,
} from "./templates-forms/EditorTrackedChangesPanel";
import {
  editorSelectionPreview,
  resolveTrackedChange,
  toggleTrackChanges,
} from "./templates-forms/documentEditorChrome";
import {
  readPolicyEditorIds,
  rememberPolicyEditorSession,
} from "./templates-forms/policy-editor-session";

const TiptapEditor = dynamic(() => import("./templates-forms/TiptapEditor"), { ssr: false });

export default function PolicyDocumentEditor() {
  const params = useSearchParams();
  const [documentId, setDocumentId] = useState(0);
  const [hrDocumentId, setHrDocumentId] = useState(0);
  const [folderId, setFolderId] = useState(0);
  const query = useTemplateDocument(documentId);
  const data = query.data as Record<string, unknown> | undefined;
  const [status, setStatus] = useState("All changes saved");
  const [showAi, setShowAi] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showTrackChanges, setShowTrackChanges] = useState(false);
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const editorRef = useRef<import("@tiptap/react").Editor | null>(null);
  const saveTimer = useRef<number>(0);
  const pendingSaveRef = useRef<{ document_json: string; rendered_text: string } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const ids = readPolicyEditorIds(params);
    setDocumentId(ids.documentId);
    setHrDocumentId(ids.hrDocumentId);
    setFolderId(ids.folderId);
    if (!ids.documentId) return;
    rememberPolicyEditorSession(ids.documentId, ids.hrDocumentId, ids.folderId);
    if (!params.get("document")) {
      const qs = new URLSearchParams(window.location.search);
      qs.set("document", String(ids.documentId));
      if (ids.hrDocumentId) qs.set("hr_document", String(ids.hrDocumentId));
      if (ids.folderId) qs.set("folder", String(ids.folderId));
      window.history.replaceState(null, "", `${window.location.pathname}?${qs.toString()}`);
    }
  }, [params]);

  const initialText = useMemo(() => {
    if (!data) return "";
    return String(data.rendered_text || "");
  }, [data?.id, data?.rendered_text]);

  const backHref = folderId
    ? `/pages/organization/folder?folder=${folderId}`
    : "/pages/organization";

  const persistDraft = useCallback(
    async (snapshotJson: string, plainText: string) => {
      if (!documentId) return false;
      const saved = await templatesFormsApi.autosave(documentId, {
        document_json: snapshotJson,
        rendered_text: plainText,
      });
      queryClient.setQueryData(TEMPLATE_KEYS.document(documentId), (current) => ({
        ...(typeof current === "object" && current ? current : {}),
        ...saved,
        document_json: snapshotJson,
        rendered_text: plainText,
      }));
      pendingSaveRef.current = null;
      return true;
    },
    [documentId, queryClient],
  );

  const handleChange = useCallback(
    (snapshotJson: string, plainText: string) => {
      if (!documentId) return;
      setText(plainText);
      pendingSaveRef.current = {
        document_json: snapshotJson,
        rendered_text: plainText,
      };
      window.clearTimeout(saveTimer.current);
      setStatus("Saving…");
      saveTimer.current = window.setTimeout(async () => {
        try {
          await persistDraft(snapshotJson, plainText);
          setStatus("Saved just now");
        } catch {
          setStatus("Save failed · retrying");
        }
      }, 800);
    },
    [documentId, persistDraft],
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(saveTimer.current);
      const pending = pendingSaveRef.current;
      if (!pending || !documentId) return;
      void persistDraft(pending.document_json, pending.rendered_text);
    };
  }, [documentId, persistDraft]);

  async function addComment() {
    if (!comment.trim()) return;
    const selection = editorSelectionPreview(editorRef.current);
    await templatesFormsApi.comment(documentId, { body: comment, selection });
    setComment("");
    query.refetch();
  }

  if (!documentId) {
    return <p className="p-6 text-sm text-slate-500">Open a policy document to edit it.</p>;
  }
  if (query.isLoading || query.isFetching) {
    return <p className="p-6 text-sm text-slate-400">Loading document…</p>;
  }
  if (query.isError) {
    return (
      <div className="p-6">
        <p className="font-semibold">Could not open this document.</p>
        <button type="button" className="mt-2 text-brand-pink" onClick={() => query.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const comments =
    (data?.comments as Array<{ id: number; author: string; body: string; selection?: string }>) || [];
  const trackedChanges = (data?.tracked_changes || []) as TrackedChangeItem[];
  const trackChangesEnabled = Boolean(data?.track_changes);
  const unresolved = (data?.unresolved_fields as string[]) || [];

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 print:hidden">
        <Link href={backHref} className="text-sm font-semibold text-slate-500">
          ← Back to Documents
        </Link>
        <h1 className="max-w-md truncate text-sm font-semibold text-slate-800">
          {String(data?.name || "")}
        </h1>
        <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-600">
          + Draft
        </span>
        <span className="text-xs text-slate-400">{status}</span>
        {hrDocumentId > 0 && (
          <span className="text-xs text-slate-400">Policy file #{hrDocumentId}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
            onClick={() => setShowComments((current) => !current)}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Comments
          </button>
          <button
            type="button"
            className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            onClick={() => setShowAi((current) => !current)}
          >
            {showAi ? "Hide CleonAI" : "CleonAI"}
          </button>
        </div>
      </header>
      {unresolved.length > 0 && (
        <p className="shrink-0 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Missing merge fields: {unresolved.join(", ")}
        </p>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1">
          <TiptapEditor
            key={String(documentId)}
            json={String(data?.document_json || "")}
            text={initialText}
            onChange={handleChange}
            onReady={(current) => {
              editorRef.current = current;
            }}
            onComments={() => setShowComments(true)}
            onAi={() => setShowAi(true)}
            trackChangesEnabled={trackChangesEnabled}
            onTrackChangesToggle={() =>
              void toggleTrackChanges(documentId, !trackChangesEnabled, query.refetch)
            }
            onOpenTrackChanges={() => setShowTrackChanges(true)}
          />
        </div>
        {showAi && (
          <CleonAIPanel
            documentId={documentId}
            selection={text || initialText}
            onApply={(value) => editorRef.current?.commands.insertContent(value)}
          />
        )}
        {showTrackChanges ? (
          <EditorTrackedChangesPanel
            changes={trackedChanges}
            trackingEnabled={trackChangesEnabled}
            onClose={() => setShowTrackChanges(false)}
            onAccept={(changeId) =>
              void resolveTrackedChange(documentId, changeId, "accept", query.refetch)
            }
            onReject={(changeId) =>
              void resolveTrackedChange(documentId, changeId, "reject", query.refetch)
            }
          />
        ) : null}
        {showComments ? (
          <EditorCommentsPanel
            comments={comments}
            comment={comment}
            selectionPreview={editorSelectionPreview(editorRef.current)}
            onCommentChange={setComment}
            onClose={() => setShowComments(false)}
            onSubmit={() => void addComment()}
          />
        ) : null}
      </div>
    </div>
  );
}
