"use client";

import { useState } from "react";
import { templatesFormsApi } from "../../../../lib/templates-forms-api";
import { api } from "../../../../lib/api";

export default function CleonAIPanel({
  documentId,
  selection,
  onApply,
}: {
  documentId: number;
  selection: string;
  onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const user = api.injectedUser();
  const firstName = (user?.name || "there").split(" ")[0];

  async function run(action: string, text?: string) {
    setBusy(true);
    setError("");
    try {
      const message = await templatesFormsApi.ai(documentId, {
        action,
        prompt: text || prompt,
        selection,
      });
      setProposal(message);
    } catch (err: any) {
      setError(err.message || "The AI provider timed out or refused the request.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!proposal?.id) return;
    const message = (await templatesFormsApi.ai(documentId, {
      action: "apply",
      message_id: proposal.id,
    })) as { proposal?: string; response?: string };
    onApply(String(message.proposal || message.response || ""));
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-slate-100 bg-gradient-to-b from-pink-50 to-white print:hidden">
      <div className="flex flex-1 flex-col items-center px-5 pt-8 text-center">
        <img src="/document-management/ask_ai.png" alt="" className="h-20 w-20 object-contain" />
        <p className="mt-4 text-sm font-semibold text-slate-800">Hi {firstName}, I&apos;m CleonAI.</p>
        <p className="mt-1 text-xs text-slate-400">Your intelligent document assistant. How can I help?</p>
        <p className="mt-6 w-full text-left text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          What I can do
        </p>
        <div className="mt-2 w-full space-y-2 text-left text-sm">
          {[
            { label: "Draft & rewrite documents", action: "rewrite" },
            { label: "Generate from templates", action: "clause" },
            { label: "Review for compliance", action: "compliance" },
            { label: "HR writing guidance", action: "summarize" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={busy}
              onClick={() => run(item.action)}
              className="block w-full rounded-xl bg-white/80 px-3 py-2 text-left text-slate-600 shadow-sm"
            >
              {item.label}
            </button>
          ))}
        </div>
        {proposal && (
          <div className="mt-4 w-full rounded-xl bg-white p-3 text-left text-xs">
            <pre className="whitespace-pre-wrap text-slate-600">{proposal.proposal || proposal.response}</pre>
            <div className="mt-2 flex gap-2">
              <button type="button" className="font-semibold text-brand-pink" onClick={apply}>Apply</button>
              <button type="button" className="text-slate-400" onClick={() => setProposal(null)}>Reject</button>
              <button type="button" className="text-slate-400" onClick={() => run("rewrite", proposal.prompt)}>Regenerate</button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-left text-xs text-red-600">{error}</p>}
      </div>
      {open && (
        <div className="p-3">
          <textarea
            className="field min-h-16"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask CleonAI…"
          />
          <button
            type="button"
            disabled={!prompt || busy}
            onClick={() => run("rewrite", prompt)}
            className="mt-2 w-full rounded-full bg-[#e83e8c] py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
          <p className="mt-2 text-[11px] text-slate-400">AI output may be inaccurate and is not legal advice.</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="m-4 rounded-full bg-[#e83e8c] py-3 text-sm font-semibold text-white"
      >
        {open ? "Hide CleonAI" : "Open CleonAI"}
      </button>
    </aside>
  );
}
