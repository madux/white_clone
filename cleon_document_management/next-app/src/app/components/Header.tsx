"use client";

import { Bell, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useComplianceTargets,
  useCurrentUser,
  useDocuments,
  useFolders,
  useMyWorkspace,
  usePolicies,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { documentViewHref } from "../../../lib/documentLinks";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import { dmsContractsApi } from "../../../lib/dmsContractsApi";
import { groupMetricResults } from "./EmployeeMetricPicker";
import BackButton from "./BackButton";
import Sidebar from "./Sidebar";
import NotificationCentrePanel from "./NotificationCentrePanel";

function UserWidget() {
  const { data: user, isPending, isError } = useCurrentUser();
  const [injectedUser, setInjectedUser] = useState(() => api.injectedUser());

  useEffect(() => {
    const readInjectedUser = () => {
      const currentUser = api.injectedUser();
      if (currentUser) {
        setInjectedUser(currentUser);
        return true;
      }
      return false;
    };

    if (readInjectedUser()) return;
    const timer = window.setInterval(() => {
      if (readInjectedUser()) window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  const displayedUser = injectedUser || user;

  if (isPending && !displayedUser) {
    return (
      <div className="flex items-center gap-2.5 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="w-24 h-4 bg-slate-200 rounded" />
      </div>
    );
  }

  if (isError && !displayedUser) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <UserIcon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-slate-600">Guest</span>
      </div>
    );
  }

  if (!displayedUser) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <UserIcon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-slate-600">Guest</span>
      </div>
    );
  }

  const initials = displayedUser.name
    ? displayedUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "HR";

  // 3. User display
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-brand-pink text-white flex items-center justify-center font-semibold text-xs shadow-sm ring-2 ring-white">
        {initials}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800 transition-colors">
          {displayedUser.name}
        </span>
        {displayedUser.company_name && (
          <span className="text-[10px] text-slate-400 font-medium -mt-0.5">
            {displayedUser.company_name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Header() {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const params = useSearchParams();
  const guideTarget = params.get("guide");
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useCurrentUser();
  const isDocumentManager = Boolean(currentUser.data?.is_document_manager);
  const folders = useFolders();
  const documents = useDocuments(undefined, false, isDocumentManager);
  const myWorkspace = useMyWorkspace();
  const targets = useComplianceTargets(isDocumentManager);
  const policies = usePolicies(isDocumentManager);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, () => setSearchOpen(false));
  useClickOutside(notificationsRef, () => setNotificationsOpen(false));

  useEffect(() => {
    dmsContractsApi.notificationInbox(1, "unread").then((result) => {
      if (result.success) setUnreadCount(result.data.unread_count);
    });
    const timer = window.setInterval(() => {
      dmsContractsApi.notificationInbox(1, "unread").then((result) => {
        if (result.success) setUnreadCount(result.data.unread_count);
      });
    }, 120000);
    return () => window.clearInterval(timer);
  }, []);
  const [registryHits, setRegistryHits] = useState<
    { label: string; detail: string; href: string; kind: string }[]
  >([]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "f" || key === "k")) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setRegistryHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      dmsContractsApi.registrySearch(term).then((result) => {
        if (!result.success) return;
        setRegistryHits(
          (result.data.items as { document_id: number; name: string; document_type: string; source_module: string }[]).map(
            (item) => ({
              label: item.name,
              detail: `${item.document_type} · ${item.source_module}`,
              href: documentViewHref({ id: item.document_id }, isDocumentManager),
              kind: "Document",
            }),
          ),
        );
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, isDocumentManager]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (value: string) =>
      !term || value.toLowerCase().includes(term);
    const items = [
      ...(isDocumentManager ? folders.data ?? [] : [])
        .filter((folder) =>
          matches(`${folder.folder_name} ${folder.description}`),
        )
        .map((folder) => ({
          label: folder.folder_name,
          detail:
            folder.folder_type === "employee"
              ? "Employee folder"
              : "Organizational folder",
          href:
            folder.folder_type === "employee"
              ? `/pages/employee/folder?folder=${folder.id}`
              : `/pages/organization/folder?folder=${folder.id}`,
          kind: "Folder",
        })),
      ...(isDocumentManager ? documents.data ?? [] : [
          ...(myWorkspace.data?.my_files ?? []),
          ...(myWorkspace.data?.shared_documents ?? []),
        ])
        .filter((document) =>
          matches(
            `${document.name} ${document.document_type} ${document.employee_name}`,
          ),
        )
        .map((document) => ({
          label: document.name,
          detail: document.document_type,
          href: documentViewHref(document, isDocumentManager),
          kind: "Document",
        })),
      ...(isDocumentManager
        ? groupMetricResults(
            (targets.data?.employees ?? []).map((employee) => ({
              id: employee.id,
              name: employee.name,
              department_name: employee.department,
              job_title: employee.job_title,
              work_location: employee.work_location || employee.location,
              grade: employee.grade,
            })),
            query,
          ).map((group) => ({
            label: group.label,
            detail: `${group.dimension} · ${group.employees.length} employees`,
            href: `/pages/employee?search=${encodeURIComponent(group.label)}`,
            kind: "Group",
          }))
        : []),
      ...(isDocumentManager ? targets.data?.employees ?? [] : [])
        .filter((employee) =>
          matches(
            `${employee.name} ${employee.job_title} ${employee.department} ${employee.location || ""} ${employee.work_location || ""} ${employee.grade || ""}`,
          ),
        )
        .map((employee) => ({
          label: employee.name,
          detail: [employee.job_title, employee.department].filter(Boolean).join(" · ") || "Employee",
          href: `/pages/employee/profile?employee=${employee.id}`,
          kind: "Employee",
        })),
      ...(isDocumentManager ? policies.data ?? [] : [])
        .filter((policy) => matches(`${policy.name} ${policy.description}`))
        .map((policy) => ({
          label: policy.name,
          detail: "Compliance rule",
          href: `/pages/employee?tab=compliance&rule=${policy.id}`,
          kind: "Policy",
        })),
      ...(!isDocumentManager
        ? [
            {
              label: "Documents",
              detail: "Your personal workspace",
              href: myWorkspaceHref("documents"),
              kind: "Workspace",
            },
            {
              label: "Shared Documents",
              detail: "Documents shared with you",
              href: myWorkspaceHref("documents", { scope: "shared" }),
              kind: "Workspace",
            },
            {
              label: "My Compliance",
              detail: "Your policy evaluations",
              href: myWorkspaceHref("compliance"),
              kind: "Compliance",
            },
          ].filter((item) => matches(`${item.label} ${item.detail}`))
        : []),
    ];
    if (registryHits.length) {
      return registryHits.slice(0, 12);
    }
    return items.slice(0, 12);
  }, [
    documents.data,
    folders.data,
    isDocumentManager,
    myWorkspace.data,
    policies.data,
    query,
    registryHits,
    targets.data,
  ]);
  return (
    <header className="app-chrome">
      <div className="app-chrome-bar">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BackButton variant="header" />
          <div className="header-wordmark">
            Cleon<span>HR</span>
          </div>

          <div
            ref={searchRef}
            className={`relative min-w-0 flex-1 ${guideTarget === "search" ? "guide-emphasis rounded-lg" : ""}`}
          >
            <input
              ref={searchInputRef}
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
              }}
              className="app-chrome-search"
              placeholder="Search documents, employees, templates…"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:inline">
              ⌘ K
            </span>
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/30">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {query ? "Search results" : "Your workspace"}
                </div>
                {query.trim() ? (
                  <Link
                    href={`/pages/search?q=${encodeURIComponent(query.trim())}`}
                    className="mb-2 block rounded-lg px-3 py-2 text-xs font-bold text-brand-pink hover:bg-pink-50"
                    onClick={() => setSearchOpen(false)}
                  >
                    See all results
                  </Link>
                ) : null}
                {results.length ? (
                  results.map((result, index) => (
                    <Link
                      key={`${result.kind}-${result.label}-${index}`}
                      href={result.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-pink-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-[10px] font-bold text-brand-pink">
                        {result.kind.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-slate-800">
                          {result.label}
                        </strong>
                        <small className="block truncate text-xs text-slate-400">
                          {result.detail}
                        </small>
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {result.kind}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-5 text-center text-sm text-slate-400">
                    No matching records found.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions & Profile */}
        <div ref={notificationsRef} className="relative flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-label="Open notifications"
            className={`relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-brand-pink ${
              guideTarget === "notifications" || guideTarget === "approval-inbox"
                ? "guide-emphasis"
                : ""
            }`}
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-pink px-1 text-center text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div className="absolute right-0 top-12 z-[110] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="border-b border-slate-100 px-1 pb-2">
                <strong className="text-sm text-slate-900">Notifications</strong>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  In-app notifications from the last 90 days
                </p>
              </div>
              <NotificationCentrePanel
                onClose={() => setNotificationsOpen(false)}
                onUnreadChange={setUnreadCount}
              />
            </div>
          ) : null}
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <UserWidget />
        </div>
      </div>
      <Sidebar />
    </header>
  );
}
