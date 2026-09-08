"use client";

import {
  ClipboardCheck,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { name: "Overview", href: "/pages/document-intelligence", icon: LayoutDashboard },
  { name: "Dataset", href: "/pages/document-intelligence/datasets", icon: Database },
  { name: "Validate", href: "/pages/document-intelligence/validate", icon: ClipboardCheck },
  { name: "Ask & Insights", href: "/pages/document-intelligence/ask", icon: MessageSquareText },
  { name: "Configuration", href: "/pages/document-intelligence/configuration", icon: Settings2 },
];

export default function IntelligenceNav() {
  const pathname = usePathname();
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {LINKS.map(({ name, href, icon: Icon }) => {
        const isOverview = href === "/pages/document-intelligence";
        const isActive = isOverview
          ? routePath === href || routePath === `${href}/`
          : routePath.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200"
                : "border border-slate-200 bg-white text-slate-500 hover:border-pink-200 hover:text-brand-text"
            }`}
          >
            <Icon className="h-4 w-4" />
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
