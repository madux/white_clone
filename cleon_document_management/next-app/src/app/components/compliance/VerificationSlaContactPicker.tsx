"use client";

import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { PolicyWizardHint } from "./PolicyWizardField";

export type VerificationSlaContactValue = {
  userId: number | null;
  label: string;
};

export default function VerificationSlaContactPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: VerificationSlaContactValue;
  onChange: (next: VerificationSlaContactValue) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    {
      id: number;
      name: string;
      email: string;
      subtitle: string;
      employee_name: string;
    }[]
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (disabled) {
      setResults([]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearching(true);
      void api
        .searchVerificationSlaContact(trimmed)
        .then((items) => setResults(items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, disabled]);

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      {value.userId && value.label ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm font-medium text-slate-800">{value.label}</span>
          <button
            type="button"
            className="text-xs font-semibold text-brand-pink hover:underline"
            onClick={() => {
              onChange({ userId: null, label: "" });
              setQuery("");
              setResults([]);
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            className="field"
            placeholder="Search by name, email, job title, or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <p className="mt-1">
            <PolicyWizardHint>
              Alerts only—they are not asked to verify on behalf of the assigned verifier.
              If empty, the policy owner is notified when SLA is missed.
            </PolicyWizardHint>
          </p>
          {searching ? (
            <p className="mt-2 text-xs text-slate-400">Searching…</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {results.map((item) => {
                const primary = item.employee_name || item.name;
                const secondary = [item.name !== primary ? item.name : "", item.email, item.subtitle]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-pink-50/50"
                      onClick={() => {
                        const label = secondary ? `${primary} (${secondary})` : primary;
                        onChange({ userId: item.id, label });
                        setQuery("");
                        setResults([]);
                      }}
                    >
                      <span className="font-medium text-slate-800">{primary}</span>
                      {secondary ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{secondary}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {query.trim().length >= 2 && !searching && results.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No people match that search.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
