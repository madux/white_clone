"use client";

import { ChevronRight, Loader2, Workflow, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  documentAutomations,
  type AutomationLibrary,
} from "../../../lib/documentAutomationApi";
import {
  ORG_AUTOMATION_ACTIONS,
  ORG_AUTOMATION_TRIGGERS,
  automationActionLabel,
  automationConditionLabel,
  automationConditionsFor,
  automationTriggerLabel,
  defaultAutomationCondition,
  isValidAutomationTriple,
} from "../../../lib/orgAutomateCatalog";
import type { OrgDocumentAutomationRule } from "../../../lib/types";
import { useAppDialog } from "../../../hooks/useAppDialog";
import AutomationRuleEditor from "./AutomationRuleEditor";
import AppSelect from "./AppSelect";
import CheckboxDropdown from "./CheckboxDropdown";
import FormWindowShell from "./FormWindowShell";
import EmptyState from "./EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NotifyCandidate = { id: number; name: string; email?: string };

function lastRunSummary(item: OrgDocumentAutomationRule) {
  if (!item.last_run_at) return "Never run";
  const when = new Date(item.last_run_at).toLocaleString();
  const result = item.last_result || "";
  if (result === "ok") return `Last run: success · ${when}`;
  if (result.startsWith("skipped")) return `Last run: skipped · ${when}`;
  return `Last run: ${result} · ${when}`;
}

export default function DocumentAutomateDialog({
  library = "organizational",
  documentId,
  documentName,
  onClose,
}: {
  library?: AutomationLibrary;
  documentId: number;
  documentName: string;
  onClose: () => void;
}) {
  const { showAlert } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<OrgDocumentAutomationRule[]>([]);
  const [candidates, setCandidates] = useState<NotifyCandidate[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("approaching_expiry");
  const [action, setAction] = useState("notify_owner");
  const [condition, setCondition] = useState("always");
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>([]);

  const conditionOptions = useMemo(
    () => automationConditionsFor(trigger, action),
    [trigger, action],
  );

  useEffect(() => {
    if (!isValidAutomationTriple(trigger, action, condition)) {
      setCondition(defaultAutomationCondition(trigger, action));
    }
  }, [trigger, action, condition]);

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
  }, [documentId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await documentAutomations(library, {
        document_id: documentId,
        op: "list",
      });
      setItems((result.data?.items as OrgDocumentAutomationRule[]) ?? []);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to load automations.",
        { title: "Automation" },
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [documentId, library, showAlert]);

  useEffect(() => {
    void load();
    void loadCandidates();
  }, [load, loadCandidates]);

  const candidateOptions = useMemo(
    () =>
      candidates.map((user) => ({
        value: String(user.id),
        label: user.name,
        hint: user.email || undefined,
      })),
    [candidates],
  );

  const createRule = async () => {
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
        op: "create",
        name: trimmed,
        trigger,
        action,
        condition,
        notify_user_ids:
          action === "notify_audience"
            ? notifyUserIds.map((value) => Number(value))
            : undefined,
      });
      if (result.data) {
        setItems((current) => [
          result.data as unknown as OrgDocumentAutomationRule,
          ...current,
        ]);
      }
      setName("");
      setNotifyUserIds([]);
      setCondition(defaultAutomationCondition(trigger, action));
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to save automation.",
        { title: "Automation" },
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (item: OrgDocumentAutomationRule, event: React.MouseEvent) => {
    event.stopPropagation();
    const nextStatus = item.status === "active" ? "disabled" : "active";
    try {
      await documentAutomations(library, {
        document_id: documentId,
        op: "update",
        id: item.id,
        status: nextStatus,
      });
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, status: nextStatus } : row)),
      );
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to update rule.",
        { title: "Automation" },
      );
    }
  };

  return (
    <>
      <FormWindowShell
        title="Document automation"
        eyebrow={documentName}
        description="Lifecycle rules for expiry reminders, notifications, and archive."
        onClose={onClose}
        defaultMode="modal"
        zIndex={110}
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="box-border w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
          <section
            className="box-border w-full max-w-full overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/90 to-white p-3 sm:p-4"
          >
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm"
                aria-hidden
              >
                <Workflow className="h-5 w-5" />
              </span>
              <div className="min-w-0 w-full flex-1 basis-0 overflow-hidden sm:min-w-0">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">Add rule</h3>
                  <p className="text-xs leading-snug text-slate-600">
                    Rules apply only to this document. Pick a condition that matches the trigger
                    and action.
                  </p>
                </div>
                <div
                  className="mt-3 grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:[grid-template-columns:repeat(2,minmax(0,1fr))]"
                >
                  <label className="flex min-w-0 w-full max-w-full flex-col gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium text-slate-700">Rule name</span>
                    <Input
                      className="box-border w-full max-w-full min-w-0"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Expiry reminder to HR"
                    />
                  </label>
                  <label className="flex min-w-0 w-full max-w-full flex-col gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">When (trigger)</span>
                    <AppSelect
                      value={trigger}
                      onChange={setTrigger}
                      options={ORG_AUTOMATION_TRIGGERS}
                      ariaLabel="Automation trigger"
                    />
                  </label>
                  <label className="flex min-w-0 w-full max-w-full flex-col gap-1.5 text-sm">
                    <span className="font-medium text-slate-700">Then (action)</span>
                    <AppSelect
                      value={action}
                      onChange={setAction}
                      options={ORG_AUTOMATION_ACTIONS}
                      ariaLabel="Automation action"
                    />
                  </label>
                  <label className="flex min-w-0 w-full max-w-full flex-col gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium text-slate-700">Condition</span>
                    <AppSelect
                      value={condition}
                      onChange={setCondition}
                      options={conditionOptions}
                      ariaLabel="Automation condition"
                    />
                  </label>
                  {action === "notify_audience" ? (
                    <div className="flex min-w-0 w-full flex-col gap-1.5 text-sm sm:col-span-2">
                      <CheckboxDropdown
                        label="Notify audience"
                        placeholder="Select people to notify"
                        options={candidateOptions}
                        values={notifyUserIds}
                        onChange={setNotifyUserIds}
                        emptyLabel="No eligible users in this folder"
                      />
                      <p className="text-xs text-slate-500">
                        Only people who can access this document in this folder.
                      </p>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createRule()}
                  className="mt-3 inline-flex w-full max-w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Zap className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Save rule
                </button>
              </div>
            </div>
          </section>

          <section className="box-border w-full max-w-full min-w-0 overflow-hidden">
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-brand-text to-brand-pink text-white"
                aria-hidden
              >
                <Workflow className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                Active rules
              </h3>
            </div>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Loading rules…
              </p>
            ) : !items.length ? (
              <EmptyState
                title="No rules yet"
                description="Add a rule above to notify owners or archive when expiry approaches."
              />
            ) : (
              <ul className="min-w-0 space-y-2">
                {items.map((item) => {
                  const active = item.status === "active";
                  const audienceNames =
                    item.action === "notify_audience" && item.notify_users?.length
                      ? item.notify_users.map((user) => user.name).join(", ")
                      : "";
                  const conditionLabel =
                    item.condition && item.condition !== "always"
                      ? automationConditionLabel(item.condition)
                      : "";
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setEditingRuleId(item.id)}
                        className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-pink-200 hover:bg-pink-50/30 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
                      >
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="flex items-center gap-1 truncate font-semibold text-slate-900">
                            {item.name}
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-slate-400"
                              aria-hidden
                            />
                          </p>
                          <p className="mt-0.5 break-words text-xs leading-snug text-slate-600">
                            {automationTriggerLabel(item.trigger)} →{" "}
                            {automationActionLabel(item.action)}
                            {conditionLabel ? ` · if ${conditionLabel}` : ""}
                            {audienceNames ? ` · notify ${audienceNames}` : ""}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {lastRunSummary(item)}
                          </p>
                        </div>
                        <div
                          className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              active
                                ? "bg-pink-100 text-brand-text"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {active ? "Active" : "Paused"}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={(event) => void toggleRule(item, event)}
                          >
                            {active ? "Pause" : "Resume"}
                          </Button>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </FormWindowShell>

      {editingRuleId ? (
        <AutomationRuleEditor
          library={library}
          documentId={documentId}
          documentName={documentName}
          ruleId={editingRuleId}
          onClose={() => setEditingRuleId(null)}
          onSaved={(rule) => {
            setItems((current) =>
              current.map((row) => (row.id === rule.id ? rule : row)),
            );
          }}
          onDeleted={() => {
            setItems((current) => current.filter((row) => row.id !== editingRuleId));
            setEditingRuleId(null);
          }}
        />
      ) : null}
    </>
  );
}
