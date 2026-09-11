"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  IntelligenceDocumentType,
  IntelligenceField,
} from "../../../../lib/intelligence-api";
import {
  useCreateIntelligenceType,
  useDeleteIntelligenceTypes,
  useIntelligenceTypes,
  useUpdateIntelligenceType,
} from "../../../../hooks/useIntelligence";
import { intelligenceApi } from "../../../../lib/intelligence-api";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

const EMPTY_FIELD: IntelligenceField = {
  name: "",
  key: "",
  field_type: "text",
  required: false,
  description: "",
  example: "",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  intelligence_scope: "employee",
  classification_labels: "",
  category: "other",
  extraction_instructions: "",
  fields: [{ ...EMPTY_FIELD, name: "Employee name", key: "employee_name" }],
};

type ConfirmState =
  | { kind: "deactivate"; item: IntelligenceDocumentType }
  | { kind: "delete"; ids: number[]; names: string };

export default function TypesConfigPanel() {
  const types = useIntelligenceTypes();
  const createType = useCreateIntelligenceType();
  const updateType = useUpdateIntelligenceType();
  const deleteTypes = useDeleteIntelligenceTypes();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const busy =
    createType.isPending || updateType.isPending || deleteTypes.isPending;
  const rows = useMemo(() => {
    const list = [...(types.data || [])];
    list.sort((left, right) => Number(right.active) - Number(left.active));
    return list;
  }, [types.data]);
  const visibleIds = rows.map((item) => item.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setError("");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = async (item: IntelligenceDocumentType) => {
    setError("");
    setEditingId(item.id);
    setShowForm(true);
    let fields =
      item.extraction_fields ||
      (item.profile && item.profile.fields) ||
      [];
    let instructions =
      item.extraction_instructions ||
      (item.profile && item.profile.extraction_instructions) ||
      "";
    if (!fields.length) {
      try {
        const profiles = await intelligenceApi.getProfiles({
          document_type_id: item.id,
        });
        const ranked = [...profiles].sort(
          (left, right) => (right.fields?.length || 0) - (left.fields?.length || 0),
        );
        const preferred =
          ranked.find((row) => row.id === item.default_profile_id && row.fields?.length) ||
          ranked[0];
        fields = preferred?.fields || [];
        instructions = preferred?.extraction_instructions || instructions;
      } catch {
        fields = [];
      }
    }
    setForm({
      name: item.name,
      description: item.description || "",
      intelligence_scope: item.intelligence_scope || "employee",
      classification_labels: item.classification_labels || "",
      category: item.category || "other",
      extraction_instructions: instructions,
      fields: fields.length ? fields.map((field) => ({ ...field })) : [{ ...EMPTY_FIELD }],
    });
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const fields = form.fields.filter((field) => field.name && field.key);
    if (!fields.length) {
      setError("Add at least one extraction field.");
      return;
    }
    const payload = {
      name: form.name,
      description: form.description,
      intelligence_scope: form.intelligence_scope,
      classification_labels: form.classification_labels,
      category: form.category,
      profile: {
        name: form.name,
        extraction_instructions: form.extraction_instructions,
        fields,
      },
    };
    try {
      if (editingId) {
        await updateType.mutateAsync({ id: editingId, ...payload });
      } else {
        await createType.mutateAsync(payload);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save type.");
    }
  };

  const runConfirm = async () => {
    if (!confirm) {
      return;
    }
    setError("");
    try {
      if (confirm.kind === "deactivate") {
        await updateType.mutateAsync({ id: confirm.item.id, active: false });
      } else {
        await deleteTypes.mutateAsync(confirm.ids);
        setSelected((current) => current.filter((id) => !confirm.ids.includes(id)));
      }
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action could not be completed.");
    }
  };

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const selectedRows = rows.filter((item) => selected.includes(item.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selected.length ? (
          <button
            type="button"
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
            onClick={() =>
              setConfirm({
                kind: "delete",
                ids: selected,
                names: selectedRows.map((item) => item.name).join(", "),
              })
            }
          >
            Delete selected ({selected.length})
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
          onClick={openCreate}
        >
          Add document type
        </button>
      </div>
      {error && !showForm ? <IntelligenceError message={error} /> : null}
      {types.isError ? (
        <IntelligenceError message="Document types could not be loaded. Confirm you are logged into Odoo." />
      ) : null}
      {types.isLoading ? (
        <IntelligenceLoading />
      ) : rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-none border-slate-300 accent-pink-600"
                    checked={allSelected}
                    aria-label="Select all document types"
                    onChange={() =>
                      setSelected(allSelected ? [] : visibleIds)
                    }
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Fields</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-slate-100 ${
                    item.active ? "" : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded-none border-slate-300 accent-pink-600"
                      checked={selected.includes(item.id)}
                      aria-label={`Select ${item.name}`}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </td>
                  <td className={`px-4 py-3 ${item.active ? "" : "opacity-60"}`}>
                    <b className="block text-slate-900">{item.name}</b>
                    <small className="text-slate-400">
                      {item.classification_labels || item.description || "—"}
                    </small>
                  </td>
                  <td className="px-4 py-3 capitalize">{item.intelligence_scope}</td>
                  <td className="px-4 py-3">{item.field_count || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`status ${item.active ? "" : "pending"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-sm font-semibold text-slate-600 hover:text-brand-text"
                        onClick={() => void openEdit(item)}
                      >
                        Edit
                      </button>
                      {item.active ? (
                        <button
                          type="button"
                          className="text-sm font-semibold text-brand-pink"
                          onClick={() => setConfirm({ kind: "deactivate", item })}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-sm font-semibold text-brand-pink"
                          onClick={() =>
                            updateType.mutate({ id: item.id, active: true })
                          }
                        >
                          Activate
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-600"
                        onClick={() =>
                          setConfirm({
                            kind: "delete",
                            ids: [item.id],
                            names: item.name,
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <IntelligenceEmpty
          title="No document types"
          description="Create types such as Employment Contract and define the fields to extract."
        />
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={onSave}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-xl font-bold">
              {editingId ? "Edit document type" : "New document type"}
            </h2>
            {error ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <label className="mt-4 block">
              <span className="label">Name</span>
              <input
                required
                className="field"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Description</span>
              <textarea
                className="field min-h-16"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
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
              <span className="label">Classification labels</span>
              <textarea
                className="field min-h-16"
                value={form.classification_labels}
                onChange={(event) =>
                  setForm({ ...form, classification_labels: event.target.value })
                }
              />
            </label>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-base font-semibold text-slate-900">
                Extraction profile
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Fields and instructions used when this type is extracted.
              </p>
              <label className="mt-3 block">
                <span className="label">Extraction instructions</span>
                <textarea
                  className="field min-h-20"
                  value={form.extraction_instructions}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      extraction_instructions: event.target.value,
                    })
                  }
                />
              </label>
              <div className="mt-4 space-y-3">
                <p className="label">Fields</p>
                {form.fields.map((field, index) => (
                  <div
                    key={`${field.key}-${index}`}
                    className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2"
                  >
                    <input
                      className="field"
                      placeholder="Label"
                      value={field.name}
                      onChange={(event) => {
                        const fields = [...form.fields];
                        fields[index] = { ...field, name: event.target.value };
                        setForm({ ...form, fields });
                      }}
                    />
                    <input
                      className="field"
                      placeholder="key"
                      value={field.key}
                      onChange={(event) => {
                        const fields = [...form.fields];
                        fields[index] = { ...field, key: event.target.value };
                        setForm({ ...form, fields });
                      }}
                    />
                    <select
                      className="field"
                      value={field.field_type}
                      onChange={(event) => {
                        const fields = [...form.fields];
                        fields[index] = {
                          ...field,
                          field_type: event.target.value,
                        };
                        setForm({ ...form, fields });
                      }}
                    >
                      {[
                        "text",
                        "date",
                        "email",
                        "phone",
                        "integer",
                        "decimal",
                        "currency",
                        "boolean",
                        "employee_reference",
                      ].map((typeName) => (
                        <option key={typeName} value={typeName}>
                          {typeName}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded-none accent-pink-600"
                        checked={field.required}
                        onChange={(event) => {
                          const fields = [...form.fields];
                          fields[index] = {
                            ...field,
                            required: event.target.checked,
                          };
                          setForm({ ...form, fields });
                        }}
                      />
                      Required
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-pink"
                  onClick={() =>
                    setForm({
                      ...form,
                      fields: [...form.fields, { ...EMPTY_FIELD }],
                    })
                  }
                >
                  Add field
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={closeForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">
              {confirm.kind === "deactivate"
                ? "Deactivate this type?"
                : confirm.ids.length > 1
                  ? "Delete these types?"
                  : "Delete this type?"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {confirm.kind === "deactivate"
                ? `${confirm.item.name} will move to the bottom of the list and stay greyed out until you activate it again.`
                : `“${confirm.names}” will be removed. This cannot be undone.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  confirm.kind === "deactivate" ? "bg-brand-pink" : "bg-red-600"
                }`}
                onClick={() => void runConfirm()}
              >
                {busy
                  ? "Working…"
                  : confirm.kind === "deactivate"
                    ? "Deactivate"
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
