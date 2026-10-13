"use client";

import { Lock, ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dmsContractsApi,
  type NotificationRuleRow,
} from "../../../../lib/dmsContractsApi";
import { useToast } from "../../../../hooks/useToast";
import { PinkSwitch } from "../PinkSwitch";
import GeneralEmailDeliveryPanel from "./GeneralEmailDeliveryPanel";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";

const MODULE_LABELS: Record<string, string> = {
  employee_files: "Employee Files",
  organizational_files: "Organisational Files",
  templates_forms: "Templates & Forms",
  signatures: "Signatures",
  approvals: "Approvals",
  alerts: "Triggers & Alerts",
  document_intelligence: "Document Intelligence",
  platform: "Platform",
  compliance: "Compliance",
};

const MODULE_ORDER = [
  "employee_files",
  "organizational_files",
  "templates_forms",
  "signatures",
  "approvals",
  "alerts",
  "document_intelligence",
  "platform",
  "compliance",
];

type SidePanel = (typeof MODULE_ORDER)[number] | "delivery_log";

function NotificationRuleCard({
  rule,
  busy,
  showModule,
  onPersist,
}: {
  rule: NotificationRuleRow;
  busy: boolean;
  showModule: boolean;
  onPersist: (
    rule: NotificationRuleRow,
    patch: Partial<NotificationRuleRow>,
  ) => void;
}) {
  const readOnly = rule.compliance_read_only;

  return (
    <li
      className={`rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <div className="min-w-0 space-y-1">
          {showModule ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {MODULE_LABELS[rule.module] || rule.module}
            </p>
          ) : null}
          <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-slate-900">
            {rule.required ? (
              <Lock
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                aria-label="Required"
              />
            ) : null}
            <span>{rule.event_label || rule.name}</span>
          </p>
          <p className="text-sm leading-relaxed text-slate-600 lg:hidden">
            {readOnly ? "Per policy in Compliance" : rule.who_is_told}
          </p>
        </div>

        <p className="hidden text-sm leading-relaxed text-slate-600 lg:block">
          {readOnly ? "Per policy in Compliance" : rule.who_is_told}
        </p>

        <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4 lg:border-0 lg:pt-0">
          <label className="flex min-w-[5.5rem] flex-col items-start gap-2 sm:items-center">
            <span className="text-xs font-semibold text-slate-500">In-app</span>
            {readOnly ? (
              <span className="text-sm text-slate-400">—</span>
            ) : (
              <PinkSwitch
                size="sm"
                label={`Enable ${rule.event_label}`}
                checked={rule.active}
                disabled={rule.required || busy}
                onCheckedChange={(active) => onPersist(rule, { active })}
              />
            )}
          </label>
          <label className="flex min-w-[5.5rem] flex-col items-start gap-2 sm:items-center">
            <span className="text-xs font-semibold text-slate-500">Email</span>
            {readOnly ? (
              <span className="text-sm text-slate-400">—</span>
            ) : (
              <PinkSwitch
                size="sm"
                label={`Email for ${rule.event_label}`}
                checked={rule.channel_email}
                disabled={
                  busy ||
                  !rule.active ||
                  (rule.required && rule.channel_email)
                }
                onCheckedChange={(channel_email) =>
                  onPersist(rule, { channel_email })
                }
              />
            )}
          </label>
        </div>
      </div>
    </li>
  );
}

export default function NotificationRulesSettingsTab() {
  const { showToast } = useToast();
  const [rules, setRules] = useState<NotificationRuleRow[]>([]);
  const [activePanel, setActivePanel] = useState<SidePanel>("employee_files");
  const [search, setSearch] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [deliveryLog, setDeliveryLog] = useState<
    {
      id: number;
      event_type: string;
      recipient_name: string;
      channel: string;
      state: string;
      created_at: string;
    }[]
  >([]);

  const loadRules = useCallback(() => {
    dmsContractsApi.settingsRead().then((result) => {
      if (result.success) {
        setRules(result.data.notification_rules || []);
      }
    });
  }, []);

  useEffect(() => {
    loadRules();
    dmsContractsApi.notificationDeliveryLog(1).then((result) => {
      if (result.success) {
        setDeliveryLog(result.data.items as typeof deliveryLog);
      }
    });
  }, [loadRules]);

  const countsByModule = useMemo(() => {
    const map = new Map<string, number>();
    for (const rule of rules) {
      const key = rule.module || "other";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [rules]);

  const tableRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rules;
    if (term) {
      list = list.filter((rule) => {
        const hay =
          `${rule.event_label} ${rule.event_type} ${rule.who_is_told} ${MODULE_LABELS[rule.module] || ""}`.toLowerCase();
        return hay.includes(term);
      });
    } else if (activePanel !== "delivery_log") {
      list = list.filter((rule) => rule.module === activePanel);
    }
    return list.sort((a, b) => a.sequence - b.sequence || a.id - b.id);
  }, [rules, search, activePanel]);

  const persistRule = async (
    rule: NotificationRuleRow,
    patch: Partial<NotificationRuleRow>,
  ) => {
    const previous = { ...rule };
    const next = { ...rule, ...patch };
    setRules((prev) =>
      prev.map((row) => (row.id === rule.id ? next : row)),
    );
    setPendingIds((prev) => new Set(prev).add(rule.id));
    const result = await dmsContractsApi.notificationRulesSave([
      {
        id: next.id,
        active: next.active,
        channel_email: next.channel_email,
      },
    ]);
    setPendingIds((prev) => {
      const copy = new Set(prev);
      copy.delete(rule.id);
      return copy;
    });
    if (!result.success) {
      setRules((prev) =>
        prev.map((row) => (row.id === rule.id ? previous : row)),
      );
      showToast("Could not update this rule.", "error");
    }
  };

  const showSearchResults = search.trim().length > 0;
  const panelTitle =
    activePanel === "delivery_log"
      ? "Delivery log"
      : MODULE_LABELS[activePanel] || activePanel;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <nav
          className="lg:w-56 lg:shrink-0 lg:rounded-xl lg:border lg:border-slate-200 lg:bg-slate-50/50 lg:p-4"
          aria-label="Notification modules"
        >
          <div className="mb-4 flex justify-end lg:justify-start">
            <SettingsFieldHelp
              label="Notification rules"
              text="Choose a module. In-app notifications follow the On toggle; email is optional. Changes save immediately."
            />
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {MODULE_ORDER.map((moduleKey) => {
              const active = !showSearchResults && activePanel === moduleKey;
              const count = countsByModule.get(moduleKey) || 0;
              return (
                <li key={moduleKey} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActivePanel(moduleKey);
                    }}
                    className={`w-full rounded-xl px-4 py-3 text-left transition ${
                      active
                        ? "bg-white text-brand-pink shadow-sm ring-1 ring-brand-pink/25 lg:bg-white"
                        : "text-slate-700 hover:bg-white/80 lg:hover:bg-white"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {MODULE_LABELS[moduleKey]}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {count} event{count === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="shrink-0 border-t border-slate-200 pt-3 lg:mt-2">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActivePanel("delivery_log");
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left transition ${
                  activePanel === "delivery_log" && !showSearchResults
                    ? "bg-white text-brand-pink shadow-sm ring-1 ring-brand-pink/25"
                    : "text-slate-700 hover:bg-white/80 lg:hover:bg-white"
                }`}
              >
                <ScrollText className="h-4 w-4 shrink-0 opacity-70" />
                <span className="text-sm font-semibold">Delivery log</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {showSearchResults ? (
                <span className="text-sm font-semibold text-slate-700">Search results</span>
              ) : (
                <SettingsFieldHelp
                  label={panelTitle}
                  text={
                    activePanel === "compliance"
                      ? "Read-only here — configure per policy in Compliance."
                      : activePanel === "delivery_log"
                        ? "Recent notification deliveries across channels."
                        : "Scheduled reminders run at 09:00 (see General settings)."
                  }
                />
              )}
            </div>
            {activePanel !== "delivery_log" ? (
              <input
                className="field w-full sm:max-w-xs"
                placeholder="Search all events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search notification events"
              />
            ) : null}
          </div>

          {activePanel === "delivery_log" && !showSearchResults ? (
            <div className="app-table-well app-page-body overflow-hidden rounded-xl">
              {deliveryLog.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  No deliveries logged yet.
                </p>
              ) : (
                <div className="max-h-[min(65vh,560px)] overflow-auto">
                  <table className="ef-table min-w-[640px] text-left text-sm">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Event</th>
                        <th>Recipient</th>
                        <th>Channel</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryLog.slice(0, 50).map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-slate-500">
                            {row.created_at}
                          </td>
                          <td>{row.event_type}</td>
                          <td>{row.recipient_name}</td>
                          <td>{row.channel}</td>
                          <td>{row.state}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {tableRules.length > 0 ? (
                <div
                  className="hidden gap-6 px-1 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:px-2"
                  aria-hidden
                >
                  <span>Event</span>
                  <span>Who is told</span>
                  <span className="text-right pr-2">Notifications</span>
                </div>
              ) : null}
              {tableRules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
                  <p className="text-sm text-slate-500">
                    No events match your search.
                  </p>
                </div>
              ) : (
                <ul className="flex max-h-[min(65vh,560px)] flex-col gap-3 overflow-y-auto pr-1">
                  {tableRules.map((rule) => (
                    <NotificationRuleCard
                      key={rule.id}
                      rule={rule}
                      busy={pendingIds.has(rule.id)}
                      showModule={showSearchResults}
                      onPersist={persistRule}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <GeneralEmailDeliveryPanel />
    </div>
  );
}
