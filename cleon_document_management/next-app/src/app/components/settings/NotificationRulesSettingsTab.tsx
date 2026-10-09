"use client";

import { Lock, ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dmsContractsApi,
  type NotificationRuleRow,
} from "../../../../lib/dmsContractsApi";
import { useToast } from "../../../../hooks/useToast";
import { PinkSwitch } from "../PinkSwitch";

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
    <div className="flex max-w-6xl flex-col gap-4 lg:min-h-[min(70vh,640px)] lg:flex-row lg:gap-0">
      <nav
        className="lg:w-52 lg:shrink-0 lg:border-r lg:border-slate-200 lg:pr-4"
        aria-label="Notification modules"
      >
        <p className="mb-3 hidden text-xs text-slate-500 lg:block">
          Pick a module — one section at a time. In-app is on when enabled; email
          is optional. Changes apply immediately.
        </p>
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
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
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition lg:px-3 lg:py-2.5 ${
                    active
                      ? "bg-pink-50 text-brand-pink"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="block truncate">{MODULE_LABELS[moduleKey]}</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {count} events
                  </span>
                </button>
              </li>
            );
          })}
          <li className="shrink-0 border-t border-slate-100 pt-2 lg:mt-2">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActivePanel("delivery_log");
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                activePanel === "delivery_log" && !showSearchResults
                  ? "bg-pink-50 text-brand-pink"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ScrollText className="h-4 w-4 shrink-0 opacity-70" />
              Delivery log
            </button>
          </li>
        </ul>
      </nav>

      <div className="min-w-0 flex-1 lg:pl-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {showSearchResults ? "Search results" : panelTitle}
            </h2>
            {activePanel === "compliance" && !showSearchResults ? (
              <p className="mt-0.5 text-xs text-slate-500">
                Read-only here — configure per policy in Compliance.
              </p>
            ) : activePanel !== "delivery_log" && !showSearchResults ? (
              <p className="mt-0.5 text-xs text-slate-500">
                Reminders at 09:00 (General tab).
              </p>
            ) : null}
          </div>
          {activePanel !== "delivery_log" ? (
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
              placeholder="Search all events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : null}
        </div>

        {activePanel === "delivery_log" && !showSearchResults ? (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {deliveryLog.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No deliveries logged yet.</p>
            ) : (
              <div className="max-h-[min(60vh,520px)] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Time</th>
                      <th className="px-4 py-2 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold">Recipient</th>
                      <th className="px-4 py-2 font-semibold">Channel</th>
                      <th className="px-4 py-2 font-semibold">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLog.slice(0, 50).map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                          {row.created_at}
                        </td>
                        <td className="px-4 py-2">{row.event_type}</td>
                        <td className="px-4 py-2">{row.recipient_name}</td>
                        <td className="px-4 py-2">{row.channel}</td>
                        <td className="px-4 py-2">{row.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {tableRules.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No events match your search.</p>
            ) : (
              <div className="max-h-[min(60vh,520px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      {showSearchResults ? (
                        <th className="px-4 py-2.5 w-28">Module</th>
                      ) : null}
                      <th className="px-4 py-2.5">Event</th>
                      <th className="hidden px-4 py-2.5 md:table-cell">Who is told</th>
                      <th className="px-4 py-2.5 w-16 text-center">On</th>
                      <th className="px-4 py-2.5 w-16 text-center">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRules.map((rule) => {
                      const readOnly = rule.compliance_read_only;
                      const busy = pendingIds.has(rule.id);
                      return (
                        <tr
                          key={rule.id}
                          className={`border-t border-slate-100 ${
                            busy ? "opacity-50" : ""
                          }`}
                        >
                          {showSearchResults ? (
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {MODULE_LABELS[rule.module] || rule.module}
                            </td>
                          ) : null}
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                              {rule.required ? (
                                <Lock
                                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                                  aria-label="Required"
                                />
                              ) : null}
                              {rule.event_label || rule.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500 md:hidden">
                              {rule.who_is_told}
                            </span>
                          </td>
                          <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">
                            {readOnly
                              ? "Per policy in Compliance"
                              : rule.who_is_told}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {readOnly ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              <PinkSwitch
                                size="sm"
                                label={`Enable ${rule.event_label}`}
                                checked={rule.active}
                                disabled={rule.required || busy}
                                onCheckedChange={(active) =>
                                  persistRule(rule, { active })
                                }
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {readOnly ? (
                              <span className="text-xs text-slate-400">—</span>
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
                                  persistRule(rule, { channel_email })
                                }
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
