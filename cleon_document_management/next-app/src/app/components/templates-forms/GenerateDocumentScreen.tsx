"use client";

import { Check, FileText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { templatesFormsApi, type TemplateItem } from "../../../../lib/templates-forms-api";
import { openGeneratedEditor } from "./editor-session";

const STAGES = [
  "Preparing template",
  "Loading template data",
  "Applying placeholders",
  "Opening editor",
];

export default function GenerateDocumentScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const templateId = Number(params.get("template") || 0);
  const kind = params.get("kind") === "form" ? "form" : "template";
  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    templatesFormsApi.get(templateId).then(setTemplate).catch((err) => setError(err.message));
  }, [templateId]);

  useEffect(() => {
    if (!templateId || cancelled) return;
    let stop = false;
    (async () => {
      try {
        for (let index = 0; index < STAGES.length; index += 1) {
          if (stop) return;
          setDone(index);
          if (index === 2) {
            if (kind === "form") {
              const submission = (await templatesFormsApi.startSubmission(templateId)) as {
                document_id: number;
                id: number;
              };
              if (stop) return;
              setDone(4);
              await new Promise((resolve) => setTimeout(resolve, 500));
              openGeneratedEditor(submission.document_id, submission.id);
              return;
            }
            const document = (await templatesFormsApi.generate(templateId, {
              client_token: `gen-${templateId}-${Date.now()}`,
            })) as { id?: number };
            if (stop) return;
            if (!document.id) throw new Error("Generation did not return a document id.");
            setDone(4);
            await new Promise((resolve) => setTimeout(resolve, 500));
            openGeneratedEditor(Number(document.id));
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
      } catch (err: any) {
        if (!stop) setError(err.message || "Generation failed.");
      }
    })();
    return () => {
      stop = true;
    };
  }, [templateId, kind, cancelled]);

  const percent = Math.min(100, Math.round((Math.max(done, 0) / STAGES.length) * 100));

  return (
    <div className="tf-generate relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-pink-100/70" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-pink-50" />
      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Generating Document</h1>
        <p className="mt-1 text-sm text-slate-400">{template?.name || "Loading template…"}</p>
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-500">{percent >= 100 ? "Complete!" : "Working…"}</span>
            <span className="text-slate-400">{percent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <ul className="mt-6 space-y-3 text-left">
          {STAGES.map((stage, index) => {
            const complete = done > index || (done === index && percent === 100) || done >= STAGES.length;
            const current = done === index && percent < 100;
            return (
              <li key={stage} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    complete || current ? "bg-emerald-100 text-emerald-500" : "bg-slate-100 text-slate-300"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className={complete || current ? "text-slate-500" : "text-slate-300"}>{stage}</span>
              </li>
            );
          })}
        </ul>
        {template && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-2xl">
              {template.icon}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-slate-800">{template.name}</strong>
              <span className="text-xs text-slate-400">{template.category}</span>
            </span>
            <FileText className="h-4 w-4 text-slate-300" />
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          className="mt-8 text-sm text-slate-400"
          onClick={() => {
            setCancelled(true);
            router.push("/pages/organization/templates-forms");
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
