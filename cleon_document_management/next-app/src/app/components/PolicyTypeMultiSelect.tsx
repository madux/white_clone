"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";

type DocumentTypeOption = { id: number; name: string };

type PolicyTypeMultiSelectProps = {
  types: DocumentTypeOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  error?: string;
};

function typeId(value: number | string) {
  return Number(value);
}

export default function PolicyTypeMultiSelect({
  types,
  selected,
  onChange,
  error,
}: PolicyTypeMultiSelectProps) {
  const [query, setQuery] = useState("");

  const selectedTypes = useMemo(
    () =>
      selected
        .map((id) => types.find((type) => typeId(type.id) === typeId(id)))
        .filter(Boolean) as DocumentTypeOption[],
    [selected, types],
  );

  const filteredTypes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return types
      .filter((type) => !selected.some((id) => typeId(id) === typeId(type.id)))
      .filter((type) => type.name.toLowerCase().includes(normalized));
  }, [query, selected, types]);

  const addType = (id: number) => {
    if (!id || selected.some((item) => typeId(item) === typeId(id))) return;
    onChange([...selected, id]);
    setQuery("");
  };

  return (
    <div className="policy-type-picker max-w-md space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Search, then click a result to add it.
        </p>
        <InlineDocumentTypeCreator
          onCreated={(item) => {
            if (!selected.some((id) => typeId(id) === typeId(item.id))) {
              onChange([...selected, item.id]);
            }
          }}
        />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search document types..."
          className="field pl-10"
        />
      </div>
      {query.trim() ? (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {filteredTypes.length ? (
            filteredTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => addType(typeId(type.id))}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-pink-50"
              >
                <span>{type.name}</span>
                <span className="text-xs font-semibold text-brand-pink">Add</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-slate-400">No matching document types.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Start typing to find document types.
        </p>
      )}
      {selectedTypes.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {selectedTypes.map((type) => (
            <span
              key={type.id}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
            >
              {type.name}
              <button
                type="button"
                onClick={() =>
                  onChange(selected.filter((id) => typeId(id) !== typeId(type.id)))
                }
                className="rounded-full p-0.5 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
                aria-label={`Remove ${type.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
          No document types selected yet.
        </p>
      )}
      {error && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
