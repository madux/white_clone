"use client";

import { useMemo, useState } from "react";
import { useCreateIntelligenceType } from "../../../../../hooks/useIntelligence";
import type { IntelligenceDocumentType } from "../../../../../lib/intelligence-api";

export default function DocumentTypesStep({
  types,
  loading,
  error,
  source,
  autoClassify,
  selectedIds,
  isAdmin,
  onAutoClassify,
  onToggle,
  onCreated,
}: {
  types: IntelligenceDocumentType[];
  loading: boolean;
  error: boolean;
  source: string;
  autoClassify: boolean;
  selectedIds: number[];
  isAdmin: boolean;
  onAutoClassify: (value: boolean) => void;
  onToggle: (id: number) => void;
  onCreated: (type: IntelligenceDocumentType) => void;
}) {
  const createType = useCreateIntelligenceType();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    intelligence_scope: source === "organizational" ? "organization" : "employee",
  });

  const preferredScope =
    source === "organizational" ? "organization" : "employee";

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const active = types.filter((item) => item.active);
    const matched = needle
      ? active.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            (item.description || "").toLowerCase().includes(needle) ||
            (item.default_profile || "").toLowerCase().includes(needle),
        )
      : active;
    const preferred = matched.filter(
      (item) => item.intelligence_scope === preferredScope,
    );
    const other = matched.filter(
      (item) => item.intelligence_scope !== preferredScope,
    );
    return { preferred, other };
  }, [preferredScope, query, types]);

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError("Enter a document type name.");
      return;
    }
    setFormError("");
    try {
      const created = await createType.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        intelligence_scope: form.intelligence_scope,
        category: "other",
        active: true,
      });
      onCreated(created);
      setForm({
        name: "",
        description: "",
        intelligence_scope: preferredScope,
      });
      setShowForm(false);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Could not create the type.",
      );
    }
  };

  const card = (item: IntelligenceDocumentType) => {
    const selected = selectedIds.includes(item.id);
    const fields = item.field_count || 0;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onToggle(item.id)}
        className={`rounded-2xl border p-4 text-left transition ${
          selected
            ? "border-brand-pink bg-pink-50 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
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
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {item.intelligence_scope === "organization"
              ? "Organization"
              : "Employee"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {fields} {fields === 1 ? "field" : "fields"}
          </span>
          {item.default_profile ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              {item.default_profile}
            </span>
          ) : null}
          {fields === 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
              Classification only
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Which document types?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick types to extract, or let the job classify files when they arrive.
          Types with no extraction fields can still be used for classification.
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
            Each file is matched to a registered type, then that type’s default
            profile is used. Low-confidence matches go to review.
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
        {isAdmin ? (
          <button
            type="button"
            className="rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink"
            onClick={() => setShowForm(true)}
          >
            New type
          </button>
        ) : null}
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
      {loading ? (
        <p className="text-sm text-slate-500">Loading document types…</p>
      ) : null}

      {filtered.preferred.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.preferred.map(card)}
        </div>
      ) : !loading ? (
        <p className="text-sm text-slate-500">
          No types match this search for{" "}
          {preferredScope === "organization" ? "organizational" : "employee"}{" "}
          files.
        </p>
      ) : null}

      {filtered.other.length ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Other scopes
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.other.map(card)}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowForm(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900">New document type</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a type here, then attach extraction fields in Configuration if
              needed.
            </p>
            <label className="mt-4 block">
              <span className="label">Name</span>
              <input
                autoFocus
                className="field"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Employment Contract"
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Scope</span>
              <select
                className="field"
                value={form.intelligence_scope}
                onChange={(event) =>
                  setForm({ ...form, intelligence_scope: event.target.value })
                }
              >
                <option value="employee">Employee</option>
                <option value="organization">Organization</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">Description</span>
              <textarea
                className="field min-h-20"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            {formError ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 font-semibold text-slate-500"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createType.isPending}
                className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 font-semibold text-white disabled:opacity-50"
                onClick={() => void submit()}
              >
                {createType.isPending ? "Creating…" : "Create and select"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
