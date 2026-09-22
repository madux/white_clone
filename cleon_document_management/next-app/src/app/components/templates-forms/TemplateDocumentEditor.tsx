"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { useTemplateDocument } from "../../../../hooks/useTemplatesForms";
import { templatesFormsApi } from "../../../../lib/templates-forms-api";
import CleonAIPanel from "./CleonAIPanel";
import { readStoredId, rememberEditorDocument } from "./editor-session";

const TiptapEditor = dynamic(() => import("./TiptapEditor"), { ssr: false });

export default function TemplateDocumentEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const [documentId, setDocumentId] = useState(() => Number(params.get("document") || 0));
  const [submissionId, setSubmissionId] = useState(() => Number(params.get("submission") || 0));
  const query = useTemplateDocument(documentId);
  const data = query.data as any;
  const [status, setStatus] = useState("All changes saved");
  const [showAi, setShowAi] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const editorRef = useRef<any>(null);
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    const nextDocument = readStoredId(params, "document");
    const nextSubmission = readStoredId(params, "submission");
    setDocumentId(nextDocument);
    setSubmissionId(nextSubmission);
    if (!nextDocument) return;
    rememberEditorDocument(nextDocument, nextSubmission || undefined);
    if (!params.get("document")) {
      const qs = new URLSearchParams(window.location.search);
      qs.set("document", String(nextDocument));
      if (nextSubmission) qs.set("submission", String(nextSubmission));
      window.history.replaceState(null, "", `${window.location.pathname}?${qs.toString()}`);
    }
  }, [params]);

  const initialText = useMemo(() => {
    if (!data) return "";
    return String(data.rendered_text || "");
  }, [data?.id, data?.rendered_text]);

  const handleChange = useCallback(
    (snapshotJson: string, plainText: string) => {
      if (!documentId) return;
      setText(plainText);
      window.clearTimeout(saveTimer.current);
      setStatus("Saving…");
      saveTimer.current = window.setTimeout(async () => {
        try {
          await templatesFormsApi.autosave(documentId, {
            document_json: snapshotJson,
            rendered_text: plainText,
          });
          setStatus("All changes saved");
        } catch {
          setStatus("Save failed · retrying");
        }
      }, 800);
    },
    [documentId],
  );

  async function addComment() {
    if (!comment.trim()) return;
    await templatesFormsApi.comment(documentId, { body: comment });
    setComment("");
    query.refetch();
  }

  async function submitForm() {
    if (!submissionId) return;
    await templatesFormsApi.submission(submissionId, {
      action: "save",
      response_json: "{}",
      answers: {},
    });
    await templatesFormsApi.submission(submissionId, { action: "submit" });
    router.push("/pages/organization/templates-forms/?tab=forms");
  }

  if (!documentId) {
    return <p className="p-6 text-sm text-slate-500">Open a generated document to edit it.</p>;
  }
  if (query.isLoading) return <p className="p-6 text-sm text-slate-400">Loading document…</p>;
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

  const comments = data?.comments || [];
  const unresolved = data?.unresolved_fields || [];

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 print:hidden">
        <Link href="/pages/organization/templates-forms" className="text-sm font-semibold text-slate-500">
          ← Back to Documents
        </Link>
        <h1 className="max-w-md truncate text-sm font-semibold text-slate-800">{data?.name}</h1>
        <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-600">
          {data?.status || "draft"}
        </span>
        <span className="text-xs text-slate-400">{status}</span>
        <span className="text-xs text-slate-400">{data?.category}</span>
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
          {submissionId > 0 && (
            <button type="button" className="rounded-full bg-[#e83e8c] px-4 py-1.5 text-sm font-semibold text-white" onClick={submitForm}>
              Submit form
            </button>
          )}
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
            json={data?.document_json || ""}
            text={initialText}
            onChange={handleChange}
            onReady={(current) => {
              editorRef.current = current;
            }}
            onComments={() => setShowComments(true)}
            onAi={() => setShowAi(true)}
          />
        </div>
        {showAi && (
          <CleonAIPanel
            documentId={documentId}
            selection={text || initialText}
            onApply={(value) => editorRef.current?.commands.insertContent(value)}
          />
        )}
        {showComments && (
          <div className="w-72 shrink-0 overflow-y-auto border-l bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Comments</h2>
              <button type="button" aria-label="Close comments" onClick={() => setShowComments(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {comments.map((item: any) => (
              <p key={item.id} className="mt-2 text-xs text-slate-600">
                {item.author}: {item.body}
              </p>
            ))}
            <input className="field mt-2" value={comment} onChange={(event) => setComment(event.target.value)} aria-label="New comment" />
            <button type="button" className="mt-2 text-xs font-semibold text-brand-pink" onClick={addComment}>
              Add comment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
