"use client";
import {
  Brain,
  Building2,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Links = { name: string; link: string; icon: any };

export default function Sidebar() {
  const pathname = usePathname();
  const routePath =
    pathname?.replace(/^\/document-management(?=\/|$)/, "") || "/";

  const coreLinks: Links[] = [
    { name: "Dashboard", link: "/", icon: LayoutDashboard },
    { name: "Employee Files", link: "/pages/employee", icon: Users },
    {
      name: "Organizational Files",
      link: "/pages/organization",
      icon: Building2,
    },
  ];

  const intelligenceLinks: Links[] = [
    {
      name: "Document Intelligence",
      link: "/pages/document-intelligence",
      icon: Brain,
    },
  ];

  return (
    <aside className="flex w-60 shrink-0 border border-slate-200 p-2">
      <div className="flex flex-col gap-5 w-full">
        <div className="flex flex-col sgap-3 p-3">
          <span className="font-bold text-sm">Document Management</span>
          <span className="text-brand-gray text-sm">Intelligence Engine</span>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
          <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Core
          </span>
          <div className="flex flex-col gap-1">
            {coreLinks.map((l) => {
              const Icon = l.icon;
              const isActive =
                l.name === "Dashboard"
                  ? routePath === "/"
                  : routePath.startsWith(l.link);
              return (
                <Link
                  key={l.name}
                  href={l.link}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative overflow-hidden flex items-center px-4 py-2.5 rounded-md cursor-pointer transition-colors duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200"
                      : "text-slate-500"
                  }`}
                >
                  {!isActive && (
                    <span className="absolute inset-0 m-auto aspect-square w-full scale-0 rounded-full bg-pink-400 opacity-0 transition-all duration-500 ease-out group-hover:scale-150 group-hover:opacity-100 pointer-events-none" />
                  )}
                  <div
                    className={`relative z-10 flex items-center gap-2 transition-colors duration-300 ${
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="text-sm font-semibold tracking-tight">
                      {l.name}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* INTELLIGENCE SECTION */}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
          <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Intelligence
          </span>
          <div className="flex flex-col gap-1">
            {intelligenceLinks.map((l) => {
              const Icon = l.icon;
              const isActive = routePath.startsWith(l.link);
              return (
                <Link
                  key={l.name}
                  href={l.link}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative overflow-hidden flex items-center px-4 py-2.5 rounded-md cursor-pointer transition-colors duration-300 ${
                    isActive
                      ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200"
                      : "text-slate-500"
                  }`}
                >
                  {!isActive && (
                    <span className="absolute inset-0 m-auto aspect-square w-full scale-0 rounded-full bg-pink-400 opacity-0 transition-all duration-500 ease-out group-hover:scale-150 group-hover:opacity-100 pointer-events-none" />
                  )}
                  <div
                    className={`relative z-10 flex items-center gap-2 transition-colors duration-300 ${
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <div className="text-sm font-semibold tracking-tight">
                      {l.name}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
