"use client";

import { Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import ThemedSelect from "./ThemedSelect";
import { useToast } from "../../../hooks/useToast";

type RuleForm = {
  id?: number;
  document_type_id: string;
  archive_after_value: string;
  archive_after_unit: string;
  delete_after_value: string;
  delete_after_unit: string;
  clock_start: string;
  backup_required: boolean;
  active: boolean;
};

const emptyRule = (documentTypeId = ""): RuleForm => ({
  document_type_id: documentTypeId,
  archive_after_value: "7",
  archive_after_unit: "years",
  delete_after_value: "7",
  delete_after_unit: "years",
  clock_start: "upload_date",
  backup_required: false,
  active: true,
});

export default function RetentionSettingsPanel({
  documentTypes,
}: {
  documentTypes: Array<{ id: number; name: string }>;
}) {
  const { showToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RuleForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    void api
      .listRetentionSettings()
      .then((result) => {
        if (result.success) setRules(result.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const typesWithoutRule = useMemo(() => {
    const covered = new Set(rules.map((r) => r.document_type_id));
    return documentTypes.filter((t) => !covered.has(t.id));
  }, [documentTypes, rules]);

  const saveRule = async () => {
    if (!editing?.document_type_id) {
      showToast("Select a document type.", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await api.saveRetentionSettings({
        id: editing.id,
        document_type_id: Number(editing.document_type_id),
        archive_after_value: Number(editing.archive_after_value),
        archive_after_unit: editing.archive_after_unit,
        delete_after_value: Number(editing.delete_after_value),
        delete_after_unit: editing.delete_after_unit,
        clock_start: editing.clock_start,
        backup_required: editing.backup_required,
        active: editing.active,
      });
      if (!result.success) {
        throw new Error(result.message || "Save failed");
      }
      setEditing(null);
      load();
      showToast("Retention rule saved.");
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Could not save rule.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="app-page-body space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <h4 className="text-sm font-bold text-slate-900">Employee file retention</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          One rule per document type. Compliance retention policies read these
          settings; they cannot be edited in the compliance wizard.
        </p>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">Document type</span>
            <ThemedSelect
              value={editing.document_type_id}
              onChange={(v) => setEditing({ ...editing, document_type_id: v })}
              placeholder="Select type"
              options={documentTypes.map((t) => ({
                value: String(t.id),
                label: t.name,
              }))}
            />
          </label>
          <label>
            <span className="label">Archive after</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="field flex-1"
                value={editing.archive_after_value}
                onChange={(e) =>
                  setEditing({ ...editing, archive_after_value: e.target.value })
                }
              />
              <ThemedSelect
                value={editing.archive_after_unit}
                onChange={(v) => setEditing({ ...editing, archive_after_unit: v })}
                options={[
                  { value: "days", label: "Days" },
                  { value: "months", label: "Months" },
                  { value: "years", label: "Years" },
                ]}
              />
            </div>
          </label>
          <label>
            <span className="label">Delete after</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="field flex-1"
                value={editing.delete_after_value}
                onChange={(e) =>
                  setEditing({ ...editing, delete_after_value: e.target.value })
                }
              />
              <ThemedSelect
                value={editing.delete_after_unit}
                onChange={(v) => setEditing({ ...editing, delete_after_unit: v })}
                options={[
                  { value: "days", label: "Days" },
                  { value: "months", label: "Months" },
                  { value: "years", label: "Years" },
                ]}
              />
            </div>
          </label>
          <label>
            <span className="label">Clock starts</span>
            <ThemedSelect
              value={editing.clock_start}
              onChange={(v) => setEditing({ ...editing, clock_start: v })}
              options={[
                { value: "upload_date", label: "Upload date" },
                { value: "document_expiry", label: "Document expiry" },
                { value: "employment_end", label: "Employment end" },
              ]}
            />
          </label>
          <label className="flex items-end pb-1">
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.backup_required}
                onChange={(e) =>
                  setEditing({ ...editing, backup_required: e.target.checked })
                }
                className="h-4 w-4 accent-pink-600 rounded"
              />
              Backup required before archive/delete
            </span>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRule()}
              className="app-btn app-btn-primary inline-flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save rule"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="app-btn app-btn-primary inline-flex items-center gap-2"
          onClick={() =>
            setEditing(emptyRule(String(typesWithoutRule[0]?.id || "")))
          }
        >
          <Plus className="h-4 w-4" /> Add retention rule
        </button>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="ef-table min-w-[720px] text-left">
            <thead>
              <tr>
                <th>Document type</th>
                <th>Archive</th>
                <th>Delete</th>
                <th>Clock</th>
                <th>Backup</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="font-medium">{rule.document_type_name}</td>
                  <td>
                    {rule.archive_after_value} {rule.archive_after_unit}
                  </td>
                  <td>
                    {rule.delete_after_value} {rule.delete_after_unit}
                  </td>
                  <td>{rule.clock_start}</td>
                  <td>{rule.backup_required ? "Yes" : "No"}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-pink"
                      onClick={() =>
                        setEditing({
                          id: rule.id,
                          document_type_id: String(rule.document_type_id),
                          archive_after_value: String(rule.archive_after_value),
                          archive_after_unit: rule.archive_after_unit,
                          delete_after_value: String(rule.delete_after_value),
                          delete_after_unit: rule.delete_after_unit,
                          clock_start: rule.clock_start,
                          backup_required: rule.backup_required,
                          active: rule.active,
                        })
                      }
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
