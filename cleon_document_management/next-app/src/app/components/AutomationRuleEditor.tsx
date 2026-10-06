"use client";

import { Loader2, Trash2, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  documentAutomations,
  type AutomationLibrary,
} from "../../../lib/documentAutomationApi";
import {
  ORG_AUTOMATION_ACTIONS,
  ORG_AUTOMATION_TRIGGERS,
  automationConditionLabel,
  automationConditionsFor,
  defaultAutomationCondition,
  isValidAutomationTriple,
} from "../../../lib/orgAutomateCatalog";
import type {
  OrgDocumentAutomationRule,
  OrgDocumentAutomationRun,
} from "../../../lib/types";
import { useAppDialog } from "../../../hooks/useAppDialog";
import AppSelect from "./AppSelect";
import CheckboxDropdown from "./CheckboxDropdown";
import FormWindowShell from "./FormWindowShell";
import EmptyState from "./EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NotifyCandidate = { id: number; name: string; email?: string };

function outcomeBadgeClass(outcome: string) {
  if (outcome === "success") return "bg-emerald-100 text-emerald-800";
  if (outcome === "failed") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export default function AutomationRuleEditor({
  library = "organizational",
  documentId,
  documentName,
  ruleId,
  readOnly = false,
  onClose,
  onSaved,
  onDeleted,
  zIndex = 120,
}: {
  library?: AutomationLibrary;
  documentId: number;
  documentName: string;
  ruleId: number;
  readOnly?: boolean;
  onClose: () => void;
  onSaved?: (rule: OrgDocumentAutomationRule) => void;
  onDeleted?: () => void;
  zIndex?: number;
}) {
  const { showAlert, showConfirm } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runs, setRuns] = useState<OrgDocumentAutomationRun[]>([]);
  const [candidates, setCandidates] = useState<NotifyCandidate[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("approaching_expiry");
  const [action, setAction] = useState("notify_owner");
  const [condition, setCondition] = useState("always");
  const [status, setStatus] = useState("active");
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>([]);
  const [notifyUserLabels, setNotifyUserLabels] = useState<string>("");

  const conditionOptions = useMemo(
    () => automationConditionsFor(trigger, action),
    [trigger, action],
  );

  useEffect(() => {
    if (!isValidAutomationTriple(trigger, action, condition)) {
      setCondition(defaultAutomationCondition(trigger, action));
    }
  }, [trigger, action, condition]);

  const loadRule = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentAutomations(library, {
        document_id: documentId,
        op: "get",
        id: ruleId,
      });
      const rule = result.data as unknown as OrgDocumentAutomationRule;
      setName(rule.name);
      setTrigger(rule.trigger);
      setAction(rule.action);
      setCondition(rule.condition || "always");
      setStatus(rule.status);
      setNotifyUserIds((rule.notify_user_ids ?? []).map((id) => String(id)));
      setNotifyUserLabels(
        (rule.notify_users ?? []).map((user) => user.name).join(", "),
      );
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load rule.",
        { title: "Automation" },
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }, [documentId, library, ruleId, onClose, showAlert]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const result = await documentAutomations(library, {
        document_id: documentId,
        op: "runs",
        id: ruleId,
        limit: 50,
      });
      setRuns((result.data?.items as OrgDocumentAutomationRun[]) ?? []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [documentId, library, ruleId]);

  const loadCandidates = useCallback(async () => {
    try {
      const result = await documentAutomations(library, {
        document_id: documentId,
        op: "notify_candidates",
      });
      setCandidates((result.data?.users as NotifyCandidate[]) ?? []);
    } catch {
      setCandidates([]);
    }
  }, [documentId, library]);

  useEffect(() => {
    void loadRule();
    void loadRuns();
    if (!readOnly) {
      void loadCandidates();
    }
  }, [loadRule, loadRuns, loadCandidates, readOnly]);

  const candidateOptions = useMemo(
    () =>
      candidates.map((user) => ({
        value: String(user.id),
        label: user.name,
        hint: user.email || undefined,
      })),
    [candidates],
  );

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert("Enter a name for this rule.", { title: "Automation" });
      return;
    }
    if (action === "notify_audience" && notifyUserIds.length === 0) {
      await showAlert("Select at least one person to notify.", { title: "Automation" });
      return;
    }
    setSaving(true);
    try {
      const result = await documentAutomations(library, {
        document_id: documentId,
        op: "update",
        id: ruleId,
        name: trimmed,
        trigger,
        action,
        condition,
        status,
        notify_user_ids:
          action === "notify_audience"
            ? notifyUserIds.map((value) => Number(value))
            : [],
      });
      if (result.data) {
        onSaved?.(result.data as unknown as OrgDocumentAutomationRule);
      }
      await showAlert("Rule saved.", { title: "Automation" });
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to save rule.",
        { title: "Automation" },
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    const confirmed = await showConfirm("Delete this automation rule?", {
      title: "Delete rule",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await documentAutomations(library, {
        document_id: documentId,
        op: "delete",
        id: ruleId,
      });
      onDeleted?.();
      onClose();
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to delete rule.",
        { title: "Automation" },
      );
    }
  };

  return (
    <FormWindowShell
      title={readOnly ? "Automation rule" : "Edit automation rule"}
      eyebrow={documentName}
      description={
        readOnly
          ? "View configuration and run history (read-only)."
          : "Update configuration and review run history."
      }
      onClose={onClose}
      defaultMode="modal"
      zIndex={zIndex}
      footer={
        readOnly ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => void deleteRule()}
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled={saving || loading} onClick={() => void save()}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Save changes
              </Button>
            </div>
          </div>
        )
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading rule…
        </p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-pink-100 bg-pink-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-brand-pink" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-900">Configuration</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">Rule name</span>
                {readOnly ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                    {name}
                  </p>
                ) : (
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">When (trigger)</span>
                {readOnly ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                    {ORG_AUTOMATION_TRIGGERS.find((item) => item.value === trigger)?.label ??
                      trigger}
                  </p>
                ) : (
                  <AppSelect
                    value={trigger}
                    onChange={setTrigger}
                    options={ORG_AUTOMATION_TRIGGERS}
                    ariaLabel="Automation trigger"
                  />
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Then (action)</span>
                {readOnly ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                    {ORG_AUTOMATION_ACTIONS.find((item) => item.value === action)?.label ??
                      action}
                  </p>
                ) : (
                  <AppSelect
                    value={action}
                    onChange={setAction}
                    options={ORG_AUTOMATION_ACTIONS}
                    ariaLabel="Automation action"
                  />
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">Condition</span>
                {readOnly ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                    {automationConditionLabel(condition)}
                  </p>
                ) : (
                  <AppSelect
                    value={condition}
                    onChange={setCondition}
                    options={conditionOptions}
                    ariaLabel="Automation condition"
                  />
                )}
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">Status</span>
                {readOnly ? (
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 capitalize">
                    {status === "disabled" ? "Paused" : status}
                  </p>
                ) : (
                  <AppSelect
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "disabled", label: "Paused" },
                    ]}
                    ariaLabel="Rule status"
                  />
                )}
              </label>
              {action === "notify_audience" ? (
                <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                  {readOnly ? (
                    <>
                      <span className="font-medium text-slate-700">Notify audience</span>
                      <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900">
                        {notifyUserLabels || "—"}
                      </p>
                    </>
                  ) : (
                    <CheckboxDropdown
                      label="Notify audience"
                      placeholder="Select people to notify"
                      options={candidateOptions}
                      values={notifyUserIds}
                      onChange={setNotifyUserIds}
                      emptyLabel="No eligible users in this folder"
                    />
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Run history</h3>
            {runsLoading ? (
              <p className="text-sm text-slate-500">Loading history…</p>
            ) : !runs.length ? (
              <EmptyState
                title="No runs yet"
                description="This rule has not run yet."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2 font-medium">When</th>
                      <th className="p-2 font-medium">Trigger</th>
                      <th className="p-2 font-medium">Outcome</th>
                      <th className="p-2 font-medium">Detail</th>
                      <th className="p-2 font-medium">Condition</th>
                      <th className="p-2 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-t border-slate-100">
                        <td className="p-2 whitespace-nowrap text-slate-700">
                          {new Date(run.occurred_at).toLocaleString()}
                        </td>
                        <td className="p-2 text-slate-700">{run.trigger_label}</td>
                        <td className="p-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${outcomeBadgeClass(run.outcome)}`}
                          >
                            {run.outcome_label}
                          </span>
                        </td>
                        <td className="max-w-[12rem] truncate p-2 text-slate-600">
                          {run.result_message}
                        </td>
                        <td className="p-2 text-slate-600">
                          {automationConditionLabel(run.condition)}
                          {run.condition_met ? "" : " (not met)"}
                        </td>
                        <td className="p-2 text-slate-600">{run.source_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </FormWindowShell>
  );
}
