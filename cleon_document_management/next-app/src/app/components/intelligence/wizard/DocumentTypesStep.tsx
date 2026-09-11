"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { IntelligenceDocumentType } from "../../../../../lib/intelligence-api";

export default function DocumentTypesStep({
  types,
  loading,
  error,
  source,
  autoClassify,
  selectedIds,
  selectedKeys,
  allowedTypeIds,
  untypedCount = 0,
  loadingEstimate,
  onAutoClassify,
  onToggle,
  onToggleField,
  onSetTypeFields,
}: {
  types: IntelligenceDocumentType[];
  loading: boolean;
  error: boolean;
  source: string;
  autoClassify: boolean;
  selectedIds: number[];
  selectedKeys: string[];
  allowedTypeIds?: number[];
  untypedCount?: number;
  loadingEstimate?: boolean;
  onAutoClassify: (value: boolean) => void;
  onToggle: (id: number) => void;
  onToggleField: (key: string) => void;
  onSetTypeFields: (typeId: number, mode: "all" | "none") => void;
}) {
  const [query, setQuery] = useState("");
  const preferredScope =
    source === "organizational" ? "organization" : "employee";
  const filterByScope = Array.isArray(allowedTypeIds);
  const allowed = useMemo(
    () => new Set(allowedTypeIds || []),
    [allowedTypeIds],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return types.filter((item) => {
      if (!item.active) return false;
      if (filterByScope && !allowed.has(item.id)) return false;
      if (!filterByScope && item.intelligence_scope !== preferredScope) {
        return false;
      }
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.description || "").toLowerCase().includes(needle) ||
        (item.default_profile || "").toLowerCase().includes(needle)
      );
    });
  }, [allowed, filterByScope, preferredScope, query, types]);

  const card = (item: IntelligenceDocumentType) => {
    const selected = selectedIds.includes(item.id);
    const profileFields =
      item.profile && typeof item.profile === "object"
        ? item.profile.fields || []
        : [];
    const fields = item.extraction_fields?.length
      ? item.extraction_fields
      : profileFields;
    const fieldCount = fields.length || item.field_count || 0;
    const selectedFieldCount = fields.filter((field) =>
      selectedKeys.includes(field.key),
    ).length;
    return (
      <div
        key={item.id}
        className={`rounded-2xl border p-4 text-left transition ${
          selected
            ? "border-brand-pink bg-pink-50 shadow-sm"
            : "border-slate-200 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div>
            <p className="font-semibold text-slate-900">{item.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {item.description ||
                item.classification_labels ||
                "No description yet."}
            </p>
          </div>
          <input
            type="checkbox"
            readOnly
            checked={selected}
            className="mt-1 h-4 w-4 accent-pink-600"
          />
        </button>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {item.intelligence_scope === "organization"
              ? "Organization"
              : "Employee"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {selected
              ? `${selectedFieldCount} of ${fieldCount} ${
                  fieldCount === 1 ? "field" : "fields"
                }`
              : `${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`}
          </span>
          {item.default_profile ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              {item.default_profile}
            </span>
          ) : null}
          {fieldCount === 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
              Classification only
            </span>
          ) : null}
        </div>
        {selected ? (
          <div className="mt-4 border-t border-pink-100 pt-3">
            {fields.length ? (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fields for this dataset
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-pink"
                      onClick={() => onSetTypeFields(item.id, "all")}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-500"
                      onClick={() => onSetTypeFields(item.id, "none")}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {fields.map((field) => {
                    const checked = selectedKeys.includes(field.key);
                    return (
                      <label
                        key={field.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl bg-white px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-pink-600"
                          checked={checked}
                          onChange={() => onToggleField(field.key)}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            {field.name}
                            {field.required ? (
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand-pink">
                                Required
                              </span>
                            ) : null}
                          </span>
                          {field.description ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {field.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                This type has no extraction fields yet. Add them in{" "}
                <Link
                  href="/pages/document-intelligence/configuration/types"
                  className="font-semibold text-brand-pink underline"
                >
                  Configuration
                </Link>
                .
              </p>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Which document types?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Automatic classification stays available. The types below are the ones
          already on the files in this scope. Open a type to add or remove the
          fields this dataset should extract.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-pink-600"
          checked={autoClassify}
          onChange={(event) => onAutoClassify(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Automatic classification
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            Cleon AI reads each file and picks the matching type. Selecting a type
            here does not force every file into that type. Untyped files still go
            through classification when this is on.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search types"
        />
        <p className="text-sm text-slate-500">
          {selectedIds.length} selected
          {autoClassify ? " · auto-classify on" : ""}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          Document types could not be loaded from Odoo.
        </p>
      ) : null}

      {loading || loadingEstimate ? (
        <p className="text-sm text-slate-500">
          Looking up document types on the selected files…
        </p>
      ) : (
        <>
          {untypedCount > 0 ? (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {untypedCount}{" "}
              {untypedCount === 1 ? "file has" : "files have"} no document type
              yet. Turn on automatic classification to label{" "}
              {untypedCount === 1 ? "it" : "them"}.
            </p>
          ) : null}
          {!visible.length ? (
            <p className="text-sm text-slate-500">
              {query.trim()
                ? "No types match this search."
                : filterByScope
                  ? `None of the selected files have a ${
                      preferredScope === "organization"
                        ? "organizational"
                        : "employee"
                    } document type yet. Turn on automatic classification, or assign types in the library.`
                  : "No types match this scope."}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{visible.map(card)}</div>
          )}
        </>
      )}
    </div>
  );
}
