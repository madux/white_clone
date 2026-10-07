"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import type { RetentionSettingRule } from "../../../lib/types";
import { buildScopePayload } from "../../../lib/policyScope";
function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

const CLOCK_LABELS: Record<string, string> = {
  upload_date: "Upload date",
  document_expiry: "Document expiry",
  employment_end: "Employment end",
};

const UNIT_LABELS: Record<string, string> = {
  days: "days",
  months: "months",
  years: "years",
};

const MODE_OPTIONS = [
  { value: "report_only", label: "Report only (no changes to files)" },
  { value: "owner_approval", label: "Owner approval before action" },
  { value: "automatic", label: "Automatic archive and delete" },
];

function formatPeriod(value: number, unit: string) {
  if (!value) return "—";
  return `${value} ${UNIT_LABELS[unit] || unit}`;
}

export default function ComplianceRetentionFields({
  form,
  setForm,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
}) {
  const [rules, setRules] = useState<RetentionSettingRule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!form.document_type_ids.length) {
      setRules([]);
      return;
    }
    setLoading(true);
    void api
      .listRetentionSettings(form.document_type_ids)
      .then((result) => {
        if (result.success) {
          setRules(result.data || []);
        }
      })
      .finally(() => setLoading(false));
  }, [form.document_type_ids.join(",")]);

  const missingTypes = useMemo(() => {
    const covered = new Set(rules.map((r) => r.document_type_id));
    return form.document_type_ids.filter((id) => {
      const rule = rules.find((r) => r.document_type_id === id);
      return !rule || !rule.compliance_complete;
    });
  }, [form.document_type_ids, rules]);

  return (
    <>
      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            Retention rules (from Settings)
          </p>
          <Link
            href="/pages/settings?section=retention_compliance"
            className="text-xs font-semibold text-brand-pink hover:underline"
          >
            Edit in Settings
          </Link>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Rules are read-only here. Legal hold is always enforced at action time.
        </p>
        {loading ? (
          <p className="mt-3 text-xs text-slate-400">Loading rules…</p>
        ) : !form.document_type_ids.length ? (
          <p className="mt-3 text-xs text-slate-400">
            Select document types to view retention rules.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-2 pr-2 font-semibold">Type</th>
                  <th className="pb-2 pr-2 font-semibold">Archive after</th>
                  <th className="pb-2 pr-2 font-semibold">Delete after</th>
                  <th className="pb-2 pr-2 font-semibold">Clock</th>
                  <th className="pb-2 font-semibold">Backup</th>
                </tr>
              </thead>
              <tbody>
                {form.document_type_ids.map((typeId) => {
                  const rule = rules.find((r) => r.document_type_id === typeId);
                  const incomplete = !rule || !rule.compliance_complete;
                  return (
                    <tr
                      key={typeId}
                      className={incomplete ? "text-red-700" : "text-slate-700"}
                    >
                      <td className="py-1.5 pr-2 font-medium">
                        {rule?.document_type_name || `Type #${typeId}`}
                        {incomplete ? " (incomplete)" : ""}
                      </td>
                      <td className="py-1.5 pr-2">
                        {rule
                          ? formatPeriod(
                              rule.archive_after_value,
                              rule.archive_after_unit,
                            )
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {rule
                          ? formatPeriod(
                              rule.delete_after_value,
                              rule.delete_after_unit,
                            )
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {rule
                          ? CLOCK_LABELS[rule.clock_start] || rule.clock_start
                          : "—"}
                      </td>
                      <td className="py-1.5">
                        {rule?.backup_required ? "Required" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {missingTypes.length ? (
          <p className="mt-2 text-xs font-medium text-red-700">
            Complete retention settings for all selected document types before
            activating this rule.
          </p>
        ) : null}
      </div>

      <Field label="Action mode" full>
        <div className="space-y-2">
          {MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"
            >
              <input
                type="radio"
                name="retention_action_mode"
                checked={form.retention_action_mode === option.value}
                onChange={() =>
                  setForm({ ...form, retention_action_mode: option.value })
                }
                className="mt-1 h-4 w-4 accent-pink-600"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {form.retention_action_mode === "owner_approval" ? (
        <Field label="Notify owner (days before due)">
          <input
            type="number"
            min={1}
            className="field"
            value={form.retention_owner_notice_days}
            onChange={(e) =>
              setForm({
                ...form,
                retention_owner_notice_days: Number(e.target.value),
              })
            }
          />
        </Field>
      ) : null}
    </>
  );
}

export function useRetentionPreview(
  form: PolicyCreateFormState,
  enabled: boolean,
) {
  const [preview, setPreview] = useState<{
    archive_within_90_days: number;
    delete_within_90_days: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !form.document_type_ids.length) {
      setPreview(null);
      return;
    }
    const scope = buildScopePayload(form.scope);
    void api
      .retentionPreview({
        document_type_ids: form.document_type_ids,
        applies_to: form.applies_to === "all" ? "all" : scope.applies_to,
        department_ids: scope.department_ids,
        grade_ids: scope.grade_ids,
        employee_ids: scope.employee_ids,
        work_location_ids: scope.work_location_ids,
        employment_type_ids: scope.employment_type_ids,
        branch_ids: scope.branch_ids,
      })
      .then((result) => {
        if (result.success && result.data) {
          setPreview(result.data);
        }
      });
  }, [
    enabled,
    form.document_type_ids.join(","),
    form.applies_to,
    form.scope,
  ]);

  return preview;
}
