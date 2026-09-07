"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IntelligenceEmpty } from "./states";
import ProfilesConfigPanel from "./ProfilesConfigPanel";
import TypesConfigPanel from "./TypesConfigPanel";

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
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
          Admin
        </p>
        <h1 className="mt-1 text-3xl font-medium text-slate-900">
          Configuration
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-light text-slate-400">
          Document Intelligence settings stay separate from general Document
          Management menus.
        </p>
      </section>

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
        <IntelligenceEmpty
          title="Settings are not persisted yet"
          description="Processing mode, thresholds, OCR, deduplication, concurrency, and notifications will apply to new jobs only. Slack, Teams, and PagerDuty stay disconnected until a real health check succeeds."
        />
      ) : null}
      {section === "audit" ? (
        <IntelligenceEmpty
          title="No intelligence audit events"
          description="Dataset, job, classification, extraction, review, query, and permission events will appear here in a later phase."
        />
      ) : null}
    </div>
  );
}
