"use client";

import { useMemo, useState } from "react";
import {
  useCreateIntelligenceProfile,
  useUpdateIntelligenceProfile,
} from "../../../../../hooks/useIntelligence";
import type {
  IntelligenceDocumentType,
  IntelligenceField,
  IntelligenceProfile,
} from "../../../../../lib/intelligence-api";

const PAGE_SIZE = 12;

const FIELD_TYPES = [
  ["text", "Text"],
  ["integer", "Number"],
  ["date", "Date"],
  ["currency", "Currency"],
  ["boolean", "Boolean"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["employee_reference", "ID"],
  ["enum", "List"],
] as const;

type CatalogField = IntelligenceField & { profile: string };

function slugKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function BusinessFieldsStep({
  catalog,
  selectedKeys,
  types,
  profiles,
  isAdmin,
  onChange,
  onAddedField,
}: {
  catalog: CatalogField[];
  selectedKeys: string[];
  types: IntelligenceDocumentType[];
  profiles: IntelligenceProfile[];
  isAdmin: boolean;
  onChange: (keys: string[]) => void;
  onAddedField: (typeId: number, key: string) => void;
}) {
  const createProfile = useCreateIntelligenceProfile();
  const updateProfile = useUpdateIntelligenceProfile();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    document_type_id: types[0]?.id || 0,
    name: "",
    key: "",
    field_type: "text",
    required: false,
    description: "",
    example: "",
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalog;
    return catalog.filter(
      (field) =>
        field.name.toLowerCase().includes(needle) ||
        field.key.toLowerCase().includes(needle) ||
        field.profile.toLowerCase().includes(needle) ||
        (field.description || "").toLowerCase().includes(needle),
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogField[]>();
    for (const field of filtered) {
      const list = map.get(field.profile) || [];
      list.push(field);
      map.set(field.profile, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const visibleGroups = useMemo(() => {
    const map = new Map<string, CatalogField[]>();
    for (const field of visible) {
      const list = map.get(field.profile) || [];
      list.push(field);
      map.set(field.profile, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const toggle = (key: string) => {
    onChange(
      selectedKeys.includes(key)
        ? selectedKeys.filter((item) => item !== key)
        : [...selectedKeys, key],
    );
  };

  const addField = async () => {
    const name = form.name.trim();
    const key = (form.key.trim() || slugKey(name)).replace(/[^a-z0-9_]/g, "_");
    if (!name || !key) {
      setFormError("Name and a stable key are required.");
      return;
    }
    if (catalog.some((field) => field.key === key)) {
      setFormError("That field key already exists. Choose a different key.");
      return;
    }
    const typeId = Number(form.document_type_id);
    if (!typeId) {
      setFormError("Choose which document type this field belongs to.");
      return;
    }
    setFormError("");
    const profile = profiles.find(
      (item) => item.document_type_id === typeId && item.active,
    );
    const nextField = {
      name,
      key,
      field_type: form.field_type,
      required: form.required,
      description: form.description,
      example: form.example,
    };
    try {
      if (profile) {
        await updateProfile.mutateAsync({
          id: profile.id,
          name: profile.name,
          document_type_id: profile.document_type_id,
          extraction_instructions: profile.extraction_instructions,
          examples: profile.examples,
          fields: [
            ...profile.fields.map((field) => ({
              name: field.name,
              key: field.key,
              field_type: field.field_type,
              required: field.required,
              description: field.description,
              example: field.example,
              sequence: field.sequence,
            })),
            nextField,
          ],
        });
      } else {
        const typeName =
          types.find((item) => item.id === typeId)?.name || "Custom";
        await createProfile.mutateAsync({
          name: `${typeName} profile`,
          document_type_id: typeId,
          extraction_instructions: "",
          examples: "",
          fields: [nextField],
        });
      }
      onAddedField(typeId, key);
      setShowForm(false);
      setForm({ ...form, name: "", key: "", description: "", example: "" });
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Could not add the field.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Which fields to extract?</h2>
        <p className="mt-1 text-sm text-slate-500">
          {selectedKeys.length} of {catalog.length} fields selected. Required
          fields from the type’s profile are selected by default. Changing a
          field’s type after a job has run belongs in Configuration so older
          results stay intact.
        </p>
      </div>

      {!catalog.length ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          No extraction fields yet. Select types that have a profile, or add
          fields in Configuration.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field max-w-md"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          placeholder="Search fields"
        />
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          onClick={() => onChange(catalog.map((field) => field.key))}
        >
          Select all
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          onClick={() =>
            onChange(
              catalog
                .filter((field) => field.required)
                .map((field) => field.key),
            )
          }
        >
          Required only
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          onClick={() => onChange([])}
        >
          Deselect all
        </button>
        {isAdmin ? (
          <button
            type="button"
            className="rounded-full border border-brand-pink px-3 py-2 text-xs font-semibold text-brand-pink"
            onClick={() => setShowForm(true)}
          >
            Add field
          </button>
        ) : (
          <p className="text-xs text-slate-400">
            Admins can add custom fields here or in Configuration.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {visibleGroups.map(([profile, fields]) => (
          <div key={profile}>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {profile}
            </p>
            <div className="grid gap-2">
              {fields.map((field) => {
                const selected = selectedKeys.includes(field.key);
                return (
                  <label
                    key={field.key}
                    className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3 text-sm ${
                      selected
                        ? "border-brand-pink bg-pink-50"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">
                        {field.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {field.field_type}
                        {field.required ? " · required" : ""} · {field.key}
                      </span>
                      {field.description ? (
                        <span className="mt-1 block text-xs text-slate-400">
                          {field.description}
                        </span>
                      ) : null}
                      {field.example ? (
                        <span className="mt-1 block text-xs text-slate-400">
                          Example: {field.example}
                        </span>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-pink-600"
                      checked={selected}
                      onChange={() => toggle(field.key)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <button
            type="button"
            disabled={safePage === 0}
            className="font-semibold disabled:opacity-40"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <span>
            Page {safePage + 1} of {pages} · {grouped.length} profiles
          </span>
          <button
            type="button"
            disabled={safePage >= pages - 1}
            className="font-semibold disabled:opacity-40"
            onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}
          >
            Next
          </button>
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
            <h3 className="text-xl font-bold">Add a field</h3>
            <p className="mt-1 text-sm text-slate-500">
              This writes onto the type’s current extraction profile.
            </p>
            <label className="mt-4 block">
              <span className="label">Document type</span>
              <select
                className="field"
                value={String(form.document_type_id)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    document_type_id: Number(event.target.value),
                  })
                }
              >
                {(types.length ? types : []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">Name</span>
              <input
                className="field"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                    key: form.key || slugKey(event.target.value),
                  })
                }
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Key</span>
              <input
                className="field"
                value={form.key}
                onChange={(event) =>
                  setForm({ ...form, key: slugKey(event.target.value) })
                }
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Type</span>
              <select
                className="field"
                value={form.field_type}
                onChange={(event) =>
                  setForm({ ...form, field_type: event.target.value })
                }
              >
                {FIELD_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">Description</span>
              <input
                className="field"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(event) =>
                  setForm({ ...form, required: event.target.checked })
                }
              />
              Required
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
                disabled={createProfile.isPending || updateProfile.isPending}
                className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 font-semibold text-white disabled:opacity-50"
                onClick={() => void addField()}
              >
                Save field
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
