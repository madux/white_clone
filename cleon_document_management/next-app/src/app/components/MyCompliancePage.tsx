"use client";

import { AlertCircle, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useMyCompliance } from "../../../hooks/useDocuments";
import type {
  MyComplianceInboxItem,
  MyComplianceInboxTab,
  MyCompliancePrimaryAction,
} from "../../../lib/types";
import ComplianceSubmitDocumentDialog from "./ComplianceSubmitDocumentDialog";
import ComplianceTaskCompleteDialog from "./ComplianceTaskCompleteDialog";
import ModalDialog from "./ModalDialog";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";

const TABS: { id: MyComplianceInboxTab; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
  { id: "coming_up", label: "Coming up" },
  { id: "exceptions", label: "Exceptions" },
];

function formatDueLine(dueDate?: string) {
  if (!dueDate) return "";
  const due = new Date(String(dueDate).replace(" ", "T").slice(0, 10));
  if (Number.isNaN(due.getTime())) return `due ${String(dueDate).slice(0, 10)}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const formatted = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(due);
  if (diff < 0) return `due ${formatted} — overdue`;
  if (diff === 0) return `due ${formatted} — today`;
  if (diff === 1) return `due ${formatted} — tomorrow`;
  return `due ${formatted} — in ${diff} days`;
}

function actionLabel(action: MyCompliancePrimaryAction, item: MyComplianceInboxItem) {
  if (action === "resubmit") return "Resubmit";
  if (action === "upload") return "Upload";
  if (action === "complete_task") {
    return item.task_type === "upload_evidence" ? "Upload" : "Complete now";
  }
  if (action === "view") return "View";
  return "";
}

function overallStatusLabel(status?: string) {
  if (status === "non_compliant") return "Non-compliant";
  if (status === "at_risk") return "At risk";
  return "Compliant";
}

export default function MyCompliancePage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const compliance = useMyCompliance();
  const data = compliance.data;
  const [tab, setTab] = useState<MyComplianceInboxTab>("todo");
  const [detailItem, setDetailItem] = useState<MyComplianceInboxItem | null>(null);
  const [submitItem, setSubmitItem] = useState<{
    item: MyComplianceInboxItem;
    mode: "upload" | "resubmit";
  } | null>(null);
  const [activeTask, setActiveTask] = useState<MyComplianceInboxItem | null>(null);

  const inbox = data?.inbox;
  const summaryCounts = data?.inbox_summary;

  const tabItems = useMemo(
    () =>
      TABS.map((entry) => ({
        id: entry.id,
        label: entry.label,
        count: summaryCounts?.[entry.id] ?? inbox?.[entry.id]?.length ?? 0,
      })),
    [inbox, summaryCounts],
  );

  const rows = inbox?.[tab] ?? [];

  const runPrimaryAction = (item: MyComplianceInboxItem) => {
    const action = item.primary_action;
    if (action === "upload") {
      setSubmitItem({ item, mode: "upload" });
      return;
    }
    if (action === "resubmit") {
      setSubmitItem({ item, mode: "resubmit" });
      return;
    }
    if (action === "complete_task" && item.kind === "task" && item.task_id) {
      if (item.task_type === "upload_evidence") {
        setSubmitItem({ item, mode: "upload" });
        return;
      }
      setActiveTask(item);
      return;
    }
    setDetailItem(item);
  };

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      {compliance.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Your compliance data could not be loaded. Please try again.</span>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Compliance</h1>
          <p className="mt-1 text-sm text-slate-500">
            What you need to submit, acknowledge, or renew to stay compliant.
          </p>
        </div>
        <StatusPill
          label={overallStatusLabel(data?.overall_status)}
          tone={
            data?.overall_status === "compliant"
              ? "ok"
              : data?.overall_status === "non_compliant"
                ? "danger"
                : "pending"
          }
        />
      </header>

      <SectionTabs
        level="nested"
        ariaLabel="My Compliance sections"
        value={tab}
        onChange={(value) => setTab(value as MyComplianceInboxTab)}
        items={tabItems}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        {compliance.isLoading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length ? (
          <table className="dms-table ef-table min-w-full">
            <thead>
              <tr>
                <th>Item</th>
                <th>Due</th>
                <th>Status</th>
                <th className="dms-col-actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const dueLine = formatDueLine(item.due_date);
                const statusText =
                  item.tab === "waiting"
                    ? item.waiting_label || "Waiting for verification"
                    : item.status_label ||
                      item.rejection_message ||
                      item.reason_message ||
                      "";
                const showRejected =
                  item.rejection_message ||
                  item.status_label?.toLowerCase().includes("rejected");
                const label = actionLabel(item.primary_action, item);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-pink-50/20"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setDetailItem(item)}
                      >
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.subtitle || item.policy}</p>
                        {showRejected && tab === "todo" ? (
                          <p className="mt-1 text-xs font-medium text-red-700">
                            {item.status_label ||
                              `Rejected: ${item.rejection_message || item.reason_message}`}
                          </p>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{dueLine || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {statusText || "—"}
                    </td>
                    <td className="dms-col-actions px-5 py-4">
                      {label ? (
                        <button
                          type="button"
                          className="app-btn app-btn-primary"
                          onClick={() => runPrimaryAction(item)}
                        >
                          {label}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-sm font-semibold text-brand-pink"
                          onClick={() => setDetailItem(item)}
                        >
                          Details
                          <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-8 text-center text-sm text-slate-400">
            Nothing in {TABS.find((t) => t.id === tab)?.label?.toLowerCase()} right now.
          </p>
        )}
      </section>

      {detailItem ? (
        <ModalDialog
          title={detailItem.title}
          eyebrow={detailItem.policy}
          onClose={() => setDetailItem(null)}
          size="md"
        >
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                What you need
              </p>
              <p className="mt-1 text-slate-800">{detailItem.title}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Why
              </p>
              <p className="mt-1">
                {detailItem.policy_description ||
                  detailItem.requirement_description ||
                  detailItem.policy}
              </p>
            </div>
            {detailItem.due_date ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Due
                </p>
                <p className="mt-1">{formatDueLine(detailItem.due_date)}</p>
              </div>
            ) : null}
            {detailItem.instructions ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Instructions
                </p>
                <p className="mt-1 whitespace-pre-wrap">{detailItem.instructions}</p>
              </div>
            ) : null}
            {actionLabel(detailItem.primary_action, detailItem) ? (
              <button
                type="button"
                className="app-btn app-btn-primary w-full"
                onClick={() => {
                  runPrimaryAction(detailItem);
                  setDetailItem(null);
                }}
              >
                {actionLabel(detailItem.primary_action, detailItem)}
              </button>
            ) : null}
          </div>
        </ModalDialog>
      ) : null}

      {submitItem ? (
        <ComplianceSubmitDocumentDialog
          item={submitItem.item}
          mode={submitItem.mode}
          onClose={() => setSubmitItem(null)}
          onSubmitted={() => compliance.refetch()}
        />
      ) : null}

      {activeTask && activeTask.task_id ? (
        <ComplianceTaskCompleteDialog
          task={{
            id: Number(activeTask.task_id),
            title: activeTask.title,
            task_type: String(activeTask.task_type || "read"),
            declaration_text: "",
            evidence_document_type_id: Number(activeTask.document_type_id || 0),
            linked_form_id: 0,
            linked_document_id: Number(activeTask.document_id || 0),
            linked_folder_id: 0,
          }}
          onClose={() => setActiveTask(null)}
          onCompleted={() => compliance.refetch()}
        />
      ) : null}
    </div>
  );
}
