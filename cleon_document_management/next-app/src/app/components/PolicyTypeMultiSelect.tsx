"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import ThemedSelect from "./ThemedSelect";

type DocumentTypeOption = { id: number; name: string };

type PolicyTypeMultiSelectProps = {
  types: DocumentTypeOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  error?: string;
};

export default function PolicyTypeMultiSelect({
  types,
  selected,
  onChange,
  error,
}: PolicyTypeMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [pickerValue, setPickerValue] = useState("");

  const selectedTypes = useMemo(
    () =>
      selected
        .map((id) => types.find((type) => type.id === id))
        .filter(Boolean) as DocumentTypeOption[],
    [selected, types],
  );

  const availableOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return types
      .filter((type) => !selected.includes(type.id))
      .filter((type) => !normalized || type.name.toLowerCase().includes(normalized))
      .map((type) => ({ value: String(type.id), label: type.name }));
  }, [query, selected, types]);

  const addType = (value: string) => {
    const id = Number(value);
    if (!id || selected.includes(id)) return;
    onChange([...selected, id]);
    setPickerValue("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Add document types one at a time from the dropdown.
        </p>
        <InlineDocumentTypeCreator
          onCreated={(item) => {
            if (!selected.includes(item.id)) {
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
      <ThemedSelect
        value={pickerValue}
        onChange={addType}
        placeholder="Select a document type to add"
        options={availableOptions}
        ariaLabel="Add required document type"
      />
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
                onClick={() => onChange(selected.filter((id) => id !== type.id))}
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
