"use client";

import { FormEvent, useState } from "react";
import { IntelligenceEmpty } from "./states";

export default function AskScreen() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

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
          Questions run against approved structured records only. Answers must
          cite document, employee, page, or field sources. Authorization is
          applied before retrieval.
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
          onChange={(event) => {
            setQuestion(event.target.value);
            setSubmitted(false);
          }}
          placeholder="Which contracts expire in the next 60 days?"
        />
        <button
          type="submit"
          className="mt-4 inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
        >
          Ask
        </button>
      </form>

      {submitted ? (
        <IntelligenceEmpty
          title="No indexed evidence yet"
          description="There are no approved extraction records to search. The system will say so rather than inventing an answer."
        />
      ) : (
        <IntelligenceEmpty
          title="No query history"
          description="History is shown only to authorized users once Ask is connected to approved data."
        />
      )}
    </div>
  );
}
