"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  dedupeDocumentTypeIds,
  documentTypeExpiryApplicable,
  documentTypesForPicker,
} from "../../../lib/complianceDocumentTypes";
import type { DocumentType } from "../../../lib/types";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";

type DocumentTypeOption = Pick<DocumentType, "id" | "name"> &
  Partial<Pick<DocumentType, "expiry_applicable">>;

type ComplianceDocumentTypeMultiSelectProps = {
  types: DocumentTypeOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  placeholder?: string;
  /** Renewable document rules: only expiry-enabled types; inline create defaults expiry on. */
  expiryTypesOnly?: boolean;
  /** Full checklist UI without the summary dropdown trigger (for modals). */
  presentation?: "dropdown" | "panel";
  listMaxHeightClassName?: string;
};

function typeId(value: number | string) {
  return Number(value);
}

export default function ComplianceDocumentTypeMultiSelect({
  types,
  selected,
  onChange,
  error,
  placeholder = "Select document types",
  expiryTypesOnly = false,
  presentation = "dropdown",
  listMaxHeightClassName = "max-h-48",
}: ComplianceDocumentTypeMultiSelectProps) {
  const isPanel = presentation === "panel";
  const [open, setOpen] = useState(isPanel);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || isPanel) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, isPanel]);

  const uniqueTypes = useMemo(() => {
    const picked = documentTypesForPicker(types);
    if (!expiryTypesOnly) return picked;
    return picked.filter((type) => documentTypeExpiryApplicable(type));
  }, [types, expiryTypesOnly]);
  const normalizedSelected = useMemo(
    () => dedupeDocumentTypeIds(selected),
    [selected],
  );

  const selectedTypes = useMemo(
    () =>
      normalizedSelected
        .map((id) => uniqueTypes.find((type) => typeId(type.id) === typeId(id)))
        .filter(Boolean) as DocumentTypeOption[],
    [normalizedSelected, uniqueTypes],
  );

  const filteredTypes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return uniqueTypes;
    return uniqueTypes.filter((type) =>
      type.name.toLowerCase().includes(normalized),
    );
  }, [query, uniqueTypes]);

  const emitSelected = (ids: number[]) => {
    onChange(dedupeDocumentTypeIds(ids));
  };

  const toggle = (id: number) => {
    if (normalizedSelected.some((item) => typeId(item) === typeId(id))) {
      emitSelected(
        normalizedSelected.filter((item) => typeId(item) !== typeId(id)),
      );
    } else {
      emitSelected([...normalizedSelected, id]);
    }
  };

  const summary =
    selectedTypes.length === 0
      ? placeholder
      : selectedTypes.length <= 2
        ? selectedTypes.map((type) => type.name).join(", ")
        : `${selectedTypes
            .slice(0, 2)
            .map((type) => type.name)
            .join(", ")} +${selectedTypes.length - 2}`;

  const pickerPanel = (
        <div
          className={`w-full overflow-hidden rounded-lg border border-slate-200 bg-white ${
            isPanel ? "" : "mt-1 shadow-md"
          }`}
        >
          <div className="relative border-b border-slate-100 p-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents..."
              className="field pl-8"
            />
          </div>
          <div className={`${listMaxHeightClassName} overflow-y-auto p-1`}>
            {filteredTypes.length ? (
              filteredTypes.map((type) => {
                const checked = normalizedSelected.some(
                  (id) => typeId(id) === typeId(type.id),
                );
                return (
                  <label
                    key={`doc-type-${typeId(type.id)}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-pink-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(typeId(type.id))}
                      className="h-4 w-4 rounded accent-pink-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{type.name}</span>
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-3 text-center text-xs text-slate-400">
                No matching documents.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5">
            <InlineDocumentTypeCreator
              defaultExpiryApplicable={expiryTypesOnly}
              onCreated={(item) => {
                if (
                  expiryTypesOnly &&
                  item.expiry_applicable !== true
                ) {
                  return;
                }
                if (
                  !normalizedSelected.some(
                    (id) => typeId(id) === typeId(item.id),
                  )
                ) {
                  emitSelected([...normalizedSelected, item.id]);
                }
              }}
            />
            {normalizedSelected.length > 0 ? (
              <button
                type="button"
                className="text-[11px] font-semibold text-slate-400 hover:text-brand-pink"
                onClick={() => emitSelected([])}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
  );

  if (isPanel) {
    return (
      <div ref={rootRef} className="w-full">
        {pickerPanel}
        {error ? (
          <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-white px-2.5 text-left text-sm outline-none transition-colors ${
          error
            ? "border-red-400"
            : "border-slate-200 hover:border-pink-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        } ${selectedTypes.length ? "text-slate-800" : "text-muted-foreground"}`}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open ? pickerPanel : null}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
