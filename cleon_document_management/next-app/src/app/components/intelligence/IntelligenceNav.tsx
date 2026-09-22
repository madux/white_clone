"use client";

import {
  ClipboardCheck,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import SectionTabs from "../SectionTabs";

const LINKS = [
  { name: "Overview", href: "/pages/document-intelligence", icon: LayoutDashboard },
  { name: "Dataset", href: "/pages/document-intelligence/datasets", icon: Database },
  { name: "Validate", href: "/pages/document-intelligence/validate", icon: ClipboardCheck },
  { name: "Ask & Insights", href: "/pages/document-intelligence/ask", icon: MessageSquareText },
  { name: "Configuration", href: "/pages/document-intelligence/configuration", icon: Settings2 },
];

function resolveActiveHref(routePath: string) {
  const match = LINKS.find(({ href }) => {
    if (href === "/pages/document-intelligence") {
      return routePath === href || routePath === `${href}/`;
    }
    return routePath.startsWith(href);
  });
  return match?.href ?? LINKS[0].href;
}

export default function IntelligenceNav() {
  const pathname = usePathname();
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";
  const activeHref = useMemo(
    () => resolveActiveHref(routePath),
    [routePath],
  );

  return (
    <SectionTabs
      items={LINKS.map(({ name, href, icon }) => ({
        id: href,
        label: name,
        icon,
        href,
      }))}
      value={activeHref}
      ariaLabel="Document intelligence sections"
    />
  );
}
