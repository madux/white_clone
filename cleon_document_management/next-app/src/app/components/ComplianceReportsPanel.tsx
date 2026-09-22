"use client";

import {
  AlertCircle,
  BarChart3,
  Building2,
  ClipboardList,
  Download,
  FileWarning,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { api } from "../../../lib/api";
import { downloadCsv } from "../../../lib/csvExport";
import { formatStatusLabel } from "../../../lib/formatLabel";
import type { ComplianceReportKey } from "../../../lib/types";

type ReportConfig = {
  id: ComplianceReportKey;
  label: string;
  description: string;
  icon: LucideIcon;
  csvHeaders: string[];
  csvRow: (item: Record<string, unknown>) => (string | number)[];
  filename: string;
};

const REPORTS: ReportConfig[] = [
  {
    id: "summary",
    label: "Compliance summary",
    description:
      "Overall compliance summary across all run dates and policies, including employee counts and average completion rates.",
    icon: BarChart3,
    filename: "compliance-summary.csv",
    csvHeaders: [
      "Run date",
      "Policy",
      "Employees",
      "Compliant",
      "Partial",
      "Non-compliant",
      "Excepted",
      "Completion rate",
    ],
    csvRow: (item) => [
      String(item.evaluated_at || ""),
      String(item.policy || ""),
      Number(item.employee_count || 0),
      Number(item.compliant_count || 0),
      Number(item.partial_count || 0),
      Number(item.non_compliant_count || 0),
      Number(item.excepted_count || 0),
      Number(item.completion_rate || 0),
    ],
  },
  {
    id: "missing_per_run",
    label: "Missing documents per policy run",
    description:
      "Missing document requirements broken down by policy run, employee, and document type.",
    icon: FileWarning,
    filename: "missing-documents-per-run.csv",
    csvHeaders: [
      "Run date",
      "Policy",
      "Employee",
      "Department",
      "Document type",
      "Required",
      "Matched",
      "Status",
    ],
    csvRow: (item) => [
      String(item.evaluated_at || ""),
      String(item.policy || ""),
      String(item.employee || ""),
      String(item.department || ""),
      String(item.document_type || ""),
      Number(item.required_count || 0),
      Number(item.matched_count || 0),
      formatStatusLabel(String(item.status || "")),
    ],
  },
  {
    id: "expired_per_run",
    label: "Expired documents per employee per run",
    description:
      "Documents that were expired at the time of each policy run, grouped by employee.",
    icon: AlertCircle,
    filename: "expired-documents-per-run.csv",
    csvHeaders: [
      "Run date",
      "Policy",
      "Employee",
      "Department",
      "Document",
      "Document type",
      "Expiry date",
    ],
    csvRow: (item) => [
      String(item.evaluated_at || ""),
      String(item.policy || ""),
      String(item.employee || ""),
      String(item.department || ""),
      String(item.document || ""),
      String(item.document_type || ""),
      String(item.expiry_date || ""),
    ],
  },
  {
    id: "policy_compliance",
    label: "Policy compliance",
    description:
      "Each policy with its last run date, employee scope, and overall compliance rate.",
    icon: ClipboardList,
    filename: "policy-compliance.csv",
    csvHeaders: [
      "Policy",
      "Last run",
      "Employee scope",
      "Employees evaluated",
      "Compliant",
      "Compliance rate",
    ],
    csvRow: (item) => [
      String(item.policy || ""),
      String(item.last_run_at || ""),
      Number(item.employee_scope || 0),
      Number(item.employee_count || 0),
      Number(item.compliant_count || 0),
      Number(item.compliance_rate || 0),
    ],
  },
  {
    id: "expiring_soon",
    label: "Expiring soon (60 days)",
    description:
      "Approved documents expiring within the next 60 days across all employees.",
    icon: FileWarning,
    filename: "expiring-soon-60-days.csv",
    csvHeaders: ["Employee", "Department", "Document", "Document type", "Expiry date"],
    csvRow: (item) => [
      String(item.employee || ""),
      String(item.department || ""),
      String(item.document || ""),
      String(item.document_type || ""),
      String(item.expiry_date || ""),
    ],
  },
  {
    id: "department_compliance",
    label: "Department compliance",
    description:
      "Compliance rates and evaluation counts grouped by department.",
    icon: Building2,
    filename: "department-compliance.csv",
    csvHeaders: [
      "Department",
      "Employees",
      "Evaluations",
      "Compliant",
      "Partial",
      "Non-compliant",
      "Excepted",
      "Compliance rate",
    ],
    csvRow: (item) => [
      String(item.department || ""),
      Number(item.employee_count || 0),
      Number(item.evaluation_count || 0),
      Number(item.compliant_count || 0),
      Number(item.partial_count || 0),
      Number(item.non_compliant_count || 0),
      Number(item.excepted_count || 0),
      Number(item.compliance_rate || 0),
    ],
  },
  {
    id: "exceptions",
    label: "Exception report",
    description:
      "All compliance exceptions with employee, policy, reason, validity, and status.",
    icon: ShieldAlert,
    filename: "exception-report.csv",
    csvHeaders: [
      "Employee",
      "Department",
      "Policy",
      "Reason",
      "Valid until",
      "Status",
      "Active",
    ],
    csvRow: (item) => [
      String(item.employee || ""),
      String(item.department || ""),
      String(item.policy || ""),
      String(item.reason || ""),
      String(item.valid_until || ""),
      formatStatusLabel(String(item.status || "")),
      item.active ? "Yes" : "No",
    ],
  },
  {
    id: "employee_scores",
    label: "Employee compliance scores",
    description:
      "Per-employee compliance scores across all policies with status breakdowns.",
    icon: UserCheck,
    filename: "employee-compliance-scores.csv",
    csvHeaders: [
      "Employee",
      "Department",
      "Policies",
      "Average score",
      "Compliant",
      "Partial",
      "Non-compliant",
      "Excepted",
    ],
    csvRow: (item) => [
      String(item.employee || ""),
      String(item.department || ""),
      Number(item.policy_count || 0),
      Number(item.average_score || 0),
      Number(item.compliant || 0),
      Number(item.partial || 0),
      Number(item.non_compliant || 0),
      Number(item.excepted || 0),
    ],
  },
];

export default function ComplianceReportsPanel() {
  const [exportingId, setExportingId] = useState<ComplianceReportKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(report: ReportConfig) {
    setExportingId(report.id);
    setError(null);
    try {
      const response = await api.getComplianceReport(report.id, {
        export: true,
        page: 1,
        page_size: 5000,
      });
      downloadCsv(
        report.filename,
        report.csvHeaders,
        response.data.map((item) => report.csvRow(item as Record<string, unknown>)),
      );
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : `Could not generate ${report.label}.`,
      );
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-sm text-slate-500">
          Generate CSV exports for compliance reporting. Each report downloads the full dataset.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isExporting = exportingId === report.id;
          return (
            <article
              key={report.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">{report.label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    {report.description}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => handleGenerate(report)}
                  disabled={exportingId !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-pink/30 hover:bg-pink-50 hover:text-brand-pink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Generating..." : "Generate CSV"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
