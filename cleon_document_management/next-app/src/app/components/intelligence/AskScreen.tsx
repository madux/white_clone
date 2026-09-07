"use client";

import { FormEvent, useState } from "react";
import {
  useIntelligenceAsk,
  useIntelligenceAskHistory,
} from "../../../../hooks/useIntelligence";
import { IntelligenceEmpty, IntelligenceError } from "./states";

export default function AskScreen() {
  const [question, setQuestion] = useState("");
  const ask = useIntelligenceAsk();
  const history = useIntelligenceAskHistory();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }
    ask.mutate(question.trim());
  };

  const result = ask.data;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
          Knowledge
        </p>
        <h1 className="mt-1 text-3xl font-medium text-slate-900">
          Ask & Insights
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-light text-slate-400">
          Known questions read approved fields directly. Other questions search
          indexed document text. The system will not invent missing values.
        </p>
      </section>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <label className="label" htmlFor="intelligence-question">
          Question
        </label>
        <textarea
          id="intelligence-question"
          className="field min-h-28"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Which contracts expire in the next 60 days?"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Which contracts expire in the next 60 days?",
            "Show contracts with no notice period.",
            "Which employees are still on probation?",
            "Which employees are missing mandatory training certificates?",
          ].map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              onClick={() => setQuestion(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={ask.isPending}
          className="mt-4 inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 disabled:opacity-50"
        >
          {ask.isPending ? "Searching…" : "Ask"}
        </button>
      </form>

      {ask.isError ? (
        <IntelligenceError
          message={
            ask.error instanceof Error
              ? ask.error.message
              : "The question could not be answered."
          }
        />
      ) : null}

      {result ? (
        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm leading-6 text-slate-800 whitespace-pre-wrap">
            {result.answer}
          </p>
          <p className="text-xs text-slate-400">
            {result.fact_based
              ? "Answered from approved extracted fields"
              : `Model: ${result.model}`}
            {result.intent ? ` · ${result.intent.replace(/_/g, " ")}` : ""}
          </p>
          {result.citations.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {result.citations.map((item, index) => (
                <li key={`${item.document_id}-${index}`}>
                  <strong className="text-slate-800">{item.document}</strong>
                  {item.employee ? ` · ${item.employee}` : ""}
                  {item.field ? ` · ${item.field}` : ""} · page {item.page}
                  <span className="block text-xs text-slate-400">
                    {item.snippet}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <IntelligenceEmpty
              title="No citations"
              description="Approve extracted records so they can be indexed into pgvector."
            />
          )}
        </article>
      ) : (
        <IntelligenceEmpty
          title="Ask approved documents"
          description="Upload PDF, Word, Excel, or images, run a dataset, then approve records. Ask searches that index, not the raw file store directly."
        />
      )}

      {history.data?.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Recent questions</h2>
          <p className="mt-1 text-sm text-slate-500">
            History is limited to questions you are allowed to see.
          </p>
          <ul className="mt-4 space-y-3">
            {history.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-100 p-3 text-left hover:border-pink-200"
                  onClick={() => setQuestion(item.question)}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {item.question}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {item.answer}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
