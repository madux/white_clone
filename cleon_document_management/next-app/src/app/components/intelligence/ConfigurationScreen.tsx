"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IntelligenceEmpty, IntelligenceError, IntelligenceLoading } from "./states";
import ProfilesConfigPanel from "./ProfilesConfigPanel";
import TypesConfigPanel from "./TypesConfigPanel";
import {
  useIntelligenceAuditLogs,
  useIntelligenceHealth,
} from "../../../../hooks/useIntelligence";

const TABS = [
  { name: "Document types", href: "/pages/document-intelligence/configuration/types" },
  { name: "Extraction profiles", href: "/pages/document-intelligence/configuration/profiles" },
  { name: "Intelligence settings", href: "/pages/document-intelligence/configuration/settings" },
  { name: "Audit logs", href: "/pages/document-intelligence/configuration/audit" },
];

export default function ConfigurationScreen({
  section,
}: {
  section: "types" | "profiles" | "settings" | "audit";
}) {
  const pathname = usePathname();
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active =
            routePath.startsWith(tab.href) ||
            (section === "types" &&
              (routePath === "/pages/document-intelligence/configuration" ||
                routePath === "/pages/document-intelligence/configuration/"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-500"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>

      {section === "types" ? <TypesConfigPanel /> : null}
      {section === "profiles" ? <ProfilesConfigPanel /> : null}
      {section === "settings" ? (
        <SettingsHealthPanel />
      ) : null}
      {section === "audit" ? <AuditLogsPanel /> : null}
    </div>
  );
}

function SettingsHealthPanel() {
  const health = useIntelligenceHealth();
  if (health.isLoading) {
    return <IntelligenceLoading />;
  }
  const data = health.data;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <p className="text-slate-600">{data?.extraction}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase text-slate-400">Groq key</dt>
          <dd className="font-semibold text-slate-900">
            {data?.groq_configured ? "Configured on the server" : "Missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-400">pgvector</dt>
          <dd className="font-semibold text-slate-900">
            {data?.pgvector ? "Enabled" : "Not installed on this PostgreSQL"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-400">Ask model</dt>
          <dd>{data?.llm_model}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-400">Vision / scans</dt>
          <dd>{data?.vision_model}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-400">Embeddings</dt>
          <dd>{data?.embedding_model}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-400">
        Set <code>GROQ_API_KEY</code> in the Odoo process environment. The key
        never goes to the browser. Slack, Teams, and PagerDuty stay disconnected.
      </p>
    </div>
  );
}

const AUDIT_CATEGORIES = [
  "",
  "dataset",
  "job",
  "extraction",
  "review",
  "profile",
  "rule",
  "knowledge",
  "query",
  "permission",
];

function AuditLogsPanel() {
  const [category, setCategory] = useState("");
  const logs = useIntelligenceAuditLogs(category || undefined);
  if (logs.isLoading) {
    return <IntelligenceLoading />;
  }
  if (logs.isError) {
    return (
      <IntelligenceError message="Audit logs could not be loaded. Sign in as an administrator." />
    );
  }
  const rows = logs.data || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Category</span>
          <select
            className="field w-56"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {AUDIT_CATEGORIES.map((item) => (
              <option key={item || "all"} value={item}>
                {item || "All events"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    {row.create_date.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">{row.user}</td>
                  <td className="px-4 py-3 capitalize">{row.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`status ${
                        row.severity === "error" || row.severity === "warning"
                          ? "pending"
                          : ""
                      }`}
                    >
                      {row.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.target_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.detail || "—"}
                    {row.before_value || row.after_value ? (
                      <span className="mt-1 block text-xs text-slate-400">
                        {row.before_value || "empty"} → {row.after_value || "empty"}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <IntelligenceEmpty
          title="No intelligence audit events"
          description="Dataset runs, reviews, profile changes, Ask queries, and permission denials appear here."
        />
      )}
    </div>
  );
}
