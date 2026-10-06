"use client";

import Link from "next/link";
import { ChevronRight, UserCheck, Workflow } from "lucide-react";

const links = [
  {
    href: "/pages/organization/automation",
    title: "Automation hub",
    description:
      "Browse document automation rules, run history, and lifecycle notifications.",
    icon: Workflow,
    accent: "bg-gradient-to-r from-brand-text to-brand-pink",
  },
  {
    href: "/pages/organization/policy-assignments",
    title: "Policy assignments",
    description: "Track which employees have organisational policies assigned to their file.",
    icon: UserCheck,
    accent: "bg-emerald-600",
  },
] as const;

export default function OrganizationalLibraryAdminLinks() {
  return (
    <nav
      aria-label="Organisational library tools"
      className="grid gap-3 px-4 sm:grid-cols-2"
    >
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${item.accent}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                {item.title}
                <ChevronRight
                  className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-pink"
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-600">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
