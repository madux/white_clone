"use client";

import { FormEvent, useState } from "react";
import type { IntelligenceDocumentType } from "../../../../lib/intelligence-api";
import {
  useCreateIntelligenceType,
  useIntelligenceTypes,
  useUpdateIntelligenceType,
} from "../../../../hooks/useIntelligence";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

const EMPTY_FORM = {
  name: "",
  description: "",
  intelligence_scope: "employee",
  classification_labels: "",
  category: "other",
};

export default function TypesConfigPanel() {
  const types = useIntelligenceTypes();
  const createType = useCreateIntelligenceType();
  const updateType = useUpdateIntelligenceType();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const busy = createType.isPending || updateType.isPending;

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

  const openEdit = (item: IntelligenceDocumentType) => {
    setError("");
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || "",
      intelligence_scope: item.intelligence_scope || "employee",
      classification_labels: item.classification_labels || "",
      category: item.category || "other",
    });
    setShowForm(true);
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await updateType.mutateAsync({ id: editingId, ...form });
      } else {
        await createType.mutateAsync(form);
      }
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save type.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      ) : types.data?.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Profile</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.data.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <b className="block text-slate-900">{item.name}</b>
                    <small className="text-slate-400">
                      {item.classification_labels || item.description || "—"}
                    </small>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {item.intelligence_scope}
                  </td>
                  <td className="px-4 py-3">{item.default_profile || "—"}</td>
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
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-pink"
                        onClick={() =>
                          updateType.mutate({ id: item.id, active: !item.active })
                        }
                      >
                        {item.active ? "Deactivate" : "Activate"}
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
          description="Create types such as Employment Contract so extraction profiles have something to attach to."
        />
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={onSave}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
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
                className="field min-h-20"
                value={form.classification_labels}
                onChange={(event) =>
                  setForm({ ...form, classification_labels: event.target.value })
                }
              />
            </label>
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
    </div>
  );
}
