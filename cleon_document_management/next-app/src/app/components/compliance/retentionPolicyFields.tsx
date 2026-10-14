"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../../lib/api";
import type { PolicyCreateFormState } from "../../../../lib/policyCreateForm";
import type { RetentionSettingRule } from "../../../../lib/types";
import { PolicyWizardField, PolicyWizardHint } from "./PolicyWizardField";

export const RETENTION_CLOCK_LABELS: Record<string, string> = {
  upload_date: "Document created",
  document_expiry: "Document expiry",
  employment_end: "Employment end",
};

const UNIT_LABELS: Record<string, string> = {
  days: "days",
  months: "months",
  years: "years",
};

export const RETENTION_MODE_OPTIONS = [
  {
    value: "report_only",
    label: "Report only",
    help: "Show what is due; take no action",
  },
  {
    value: "owner_approval",
    label: "Owner approves each batch",
    help: "The Policy Owner confirms before archive or delete",
  },
  {
    value: "automatic",
    label: "Automatic",
    help: "Act on the due date after safeguards pass",
  },
];

export const RETENTION_MODE_LABELS: Record<string, string> = {
  report_only: "Report only",
  owner_approval: "Owner approves each batch",
  automatic: "Automatic",
};

export function formatRetentionPeriod(value: number, unit: string) {
  if (!value) return "—";
  const unitLabel = UNIT_LABELS[unit] || unit;
  if (unit === "years" && value === 1) return "1 year";
  return `${value} ${unitLabel}`;
}

export function useRetentionSettingRules(documentTypeIds: number[]) {
  const [rules, setRules] = useState<RetentionSettingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const idKey = documentTypeIds.join(",");

  useEffect(() => {
    if (!documentTypeIds.length) {
      setRules([]);
      return;
    }
    setLoading(true);
    void api
      .listRetentionSettings(documentTypeIds)
      .then((result) => {
        if (result.success) {
          setRules(result.data || []);
        }
      })
      .finally(() => setLoading(false));
  }, [idKey]);

  const missingTypeIds = useMemo(() => {
    return documentTypeIds.filter((id) => {
      const rule = rules.find((r) => r.document_type_id === id);
      return !rule || !rule.compliance_complete;
    });
  }, [documentTypeIds, rules]);

  return { rules, loading, missingTypeIds };
}

type RulesTableProps = {
  documentTypeIds: number[];
  rules: RetentionSettingRule[];
  loading: boolean;
  missingTypeIds: number[];
  compactNote?: boolean;
};

export function RetentionSettingsRulesTable({
  documentTypeIds,
  rules,
  loading,
  missingTypeIds,
  compactNote,
}: RulesTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      {loading ? (
        <p className="text-xs text-slate-400">Loading rules…</p>
      ) : !documentTypeIds.length ? (
        <p className="text-xs text-slate-400">
          Select document types to view retention rules.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Document type</th>
                <th className="pb-2 pr-3 font-semibold">Clock starts</th>
                <th className="pb-2 pr-3 font-semibold">Keep for</th>
                <th className="pb-2 pr-3 font-semibold">Archive after</th>
                <th className="pb-2 pr-3 font-semibold">Delete after</th>
                <th className="pb-2 font-semibold">Backup</th>
              </tr>
            </thead>
            <tbody>
              {documentTypeIds.map((typeId) => {
                const rule = rules.find((r) => r.document_type_id === typeId);
                const incomplete = !rule || !rule.compliance_complete;
                return (
                  <tr
                    key={typeId}
                    className={
                      incomplete
                        ? "text-red-700"
                        : "border-t border-slate-100 text-slate-700"
                    }
                  >
                    <td className="py-2.5 pr-3 font-medium">
                      {rule?.document_type_name || `Type #${typeId}`}
                      {incomplete ? " (incomplete)" : ""}
                    </td>
                    <td className="py-2.5 pr-3">
                      {rule
                        ? RETENTION_CLOCK_LABELS[rule.clock_start] ||
                          rule.clock_start
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {rule
                        ? formatRetentionPeriod(
                            rule.retention_value,
                            rule.retention_unit,
                          )
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {rule
                        ? formatRetentionPeriod(
                            rule.archive_after_value,
                            rule.archive_after_unit,
                          )
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {rule
                        ? formatRetentionPeriod(
                            rule.delete_after_value,
                            rule.delete_after_unit,
                          )
                        : "—"}
                    </td>
                    <td className="py-2.5">
                      {rule?.backup_required ? "Required" : "No"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">
        Read only. Change these in{" "}
        <Link
          href="/pages/settings?section=retention_compliance"
          className="font-semibold text-brand-pink hover:underline"
        >
          Settings → Retention Settings
        </Link>
        {compactNote ? null : "."}
        {!compactNote ? (
          <>
            . Legal hold is always enforced at action time.
          </>
        ) : null}
      </p>
      {missingTypeIds.length ? (
        <p className="mt-2 text-xs font-medium text-red-700">
          Complete retention settings for all selected document types before
          activating this policy.
        </p>
      ) : null}
    </div>
  );
}

export function RetentionActionModeFields({
  form,
  setForm,
  layout = "wizard",
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  layout?: "wizard" | "grid";
}) {
  const showOwnerNotice = form.retention_action_mode === "owner_approval";

  const modeRowClass =
    layout === "grid"
      ? "sm:col-span-2 flex flex-wrap items-start gap-x-6 gap-y-4"
      : "flex flex-wrap items-start gap-x-6 gap-y-4 lg:gap-x-8";

  const secondaryRowClass =
    layout === "grid"
      ? "sm:col-span-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
      : "flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8";

  return (
    <div className={layout === "grid" ? "contents" : "space-y-4"}>
      <div className={modeRowClass}>
        {layout === "grid" ? (
          <span className="label w-full sm:w-auto">Action mode</span>
        ) : null}
        {RETENTION_MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-w-[10rem] max-w-[15rem] flex-1 cursor-pointer flex-col gap-1.5"
          >
            <span className="flex items-start gap-2.5 text-sm text-slate-800">
              <input
                type="radio"
                name="retention_action_mode"
                checked={form.retention_action_mode === option.value}
                onChange={() =>
                  setForm({ ...form, retention_action_mode: option.value })
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-pink-600"
              />
              <span className={layout === "wizard" ? "font-medium" : ""}>
                {option.label}
              </span>
            </span>
            <PolicyWizardHint>
              <span className="block pl-6 leading-snug">{option.help}</span>
            </PolicyWizardHint>
          </label>
        ))}
      </div>

      <div className={secondaryRowClass}>
        {showOwnerNotice ? (
          layout === "wizard" ? (
            <PolicyWizardField
              label="Owner notice before deletion *"
              className="min-w-0 flex-1"
            >
              <div className="flex max-w-xs items-center gap-2">
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
                <span className="text-sm text-slate-500">days</span>
              </div>
            </PolicyWizardField>
          ) : (
            <label className="min-w-0 flex-1">
              <span className="label">Owner notice before deletion</span>
              <input
                type="number"
                min={1}
                className="field max-w-xs"
                value={form.retention_owner_notice_days}
                onChange={(e) =>
                  setForm({
                    ...form,
                    retention_owner_notice_days: Number(e.target.value),
                  })
                }
              />
            </label>
          )
        ) : null}

        {layout === "wizard" ? (
          <PolicyWizardField label="Legal hold check" className="min-w-0 flex-1">
            <div
              className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
              aria-readonly
            >
              <Lock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              Always enforced
            </div>
          </PolicyWizardField>
        ) : (
          <label className="min-w-0 flex-1">
            <span className="label">Legal hold check</span>
            <div
              className="flex max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
              aria-readonly
            >
              <Lock className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              Always enforced
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
