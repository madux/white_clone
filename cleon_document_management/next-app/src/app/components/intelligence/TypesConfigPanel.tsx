"use client";

import { FormEvent, useState } from "react";
import {
  useCreateIntelligenceType,
  useIntelligenceTypes,
  useUpdateIntelligenceType,
} from "../../../../hooks/useIntelligence";
import { formatFieldLabel } from "../../../../lib/formatLabel";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";
import ModalDialog from "../ModalDialog";

export default function TypesConfigPanel() {
  const types = useIntelligenceTypes();
  const createType = useCreateIntelligenceType();
  const updateType = useUpdateIntelligenceType();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    intelligence_scope: "employee",
    classification_labels: "",
    category: "other",
  });

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await createType.mutateAsync(form);
      setShowForm(false);
      setForm({
        name: "",
        description: "",
        intelligence_scope: "employee",
        classification_labels: "",
        category: "other",
      });
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
          onClick={() => setShowForm(true)}
        >
          Add document type
        </button>
      </div>
      {error ? <IntelligenceError message={error} /> : null}
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
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3">
                    {formatFieldLabel(item.intelligence_scope)}
                  </td>
                  <td className="px-4 py-3">{item.default_profile || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`status ${item.active ? "" : "pending"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-pink"
                      onClick={() =>
                        updateType.mutate({ id: item.id, active: !item.active })
                      }
                    >
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
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
        <ModalDialog
          title="New document type"
          onClose={() => setShowForm(false)}
          size="lg"
          titleClassName="text-xl"
          backdropClassName="bg-slate-900/40"
        >
          <form onSubmit={onCreate}>
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
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
