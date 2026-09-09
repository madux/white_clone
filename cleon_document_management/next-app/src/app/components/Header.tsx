"use client";

import { Bell, Clock3, Mail, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useComplianceTargets,
  useCurrentUser,
  useAdminAttention,
  useApprovalInbox,
  useDashboardStats,
  useDocuments,
  useFolders,
  useMyWorkspace,
  usePolicies,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { useClickOutside } from "../../../hooks/useClickOutside";
import type { AdminAttention, ApprovalInboxItem } from "../../../lib/types";
import BackButton from "./BackButton";

type AttentionItem = AdminAttention["notifications"][number] | ApprovalInboxItem;

function attentionHref(item: AttentionItem, isDocumentManager: boolean) {
  if ("folder_id" in item) {
    if (!isDocumentManager) {
      return `/pages/my-documents?doc=${item.document_id}`;
    }
    return item.folder_type === "employee" && item.employee_id
      ? `/pages/employee/profile?employee=${item.employee_id}`
      : `/pages/organization/folder?folder=${item.folder_id}`;
  }
  if (!isDocumentManager) {
    return item.employee_id
      ? "/pages/my-documents"
      : "/pages/my-documents";
  }
  return item.employee_id
    ? `/pages/employee/profile?employee=${item.employee_id}`
    : "/pages/employee";
}

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
  const attention = useAdminAttention(isDocumentManager);
  const approvalInbox = useApprovalInbox(isDocumentManager);
  const dashboardStats = useDashboardStats(isDocumentManager);
  const [attentionOpen, setAttentionOpen] = useState<"approval-inbox" | "notifications" | null>(null);
  const attentionRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, () => setSearchOpen(false));
  useClickOutside(attentionRef, () => setAttentionOpen(null));
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
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
          href: isDocumentManager
            ? document.employee_id
              ? `/pages/employee/profile?employee=${document.employee_id}`
              : `/pages/organization/folder?folder=${document.folder_id}`
            : `/pages/my-documents?doc=${document.id}`,
          kind: "Document",
        })),
      ...(isDocumentManager ? targets.data?.employees ?? [] : [])
        .filter((employee) =>
          matches(
            `${employee.name} ${employee.job_title} ${employee.department}`,
          ),
        )
        .map((employee) => ({
          label: employee.name,
          detail: employee.job_title || "Employee",
          href: `/pages/employee/profile?employee=${employee.id}`,
          kind: "Employee",
        })),
      ...(isDocumentManager ? policies.data ?? [] : [])
        .filter((policy) => matches(`${policy.name} ${policy.description}`))
        .map((policy) => ({
          label: policy.name,
          detail: "Compliance policy",
          href: "/pages/compliance",
          kind: "Policy",
        })),
      ...(!isDocumentManager
        ? [
            {
              label: "My Documents",
              detail: "Your personal workspace",
              href: "/pages/my-documents",
              kind: "Workspace",
            },
            {
              label: "Shared Documents",
              detail: "Documents shared with you",
              href: "/pages/my-documents?tab=shared",
              kind: "Workspace",
            },
            {
              label: "My Compliance",
              detail: "Your policy evaluations",
              href: "/pages/my-compliance",
              kind: "Compliance",
            },
          ].filter((item) => matches(`${item.label} ${item.detail}`))
        : []),
    ];
    return items.slice(0, 12);
  }, [
    documents.data,
    folders.data,
    isDocumentManager,
    myWorkspace.data,
    policies.data,
    query,
    targets.data,
  ]);
  const attentionItems = attentionOpen === "approval-inbox"
    ? approvalInbox.data?.items ?? []
    : attention.data?.notifications ?? [];
  const panelCount = attentionOpen === "approval-inbox"
    ? approvalInbox.data?.count ?? 0
    : attention.data?.count ?? 0;
  const expiringCount = dashboardStats.data?.expiring_documents ?? 0;
  const notificationBadgeCount =
    (attention.data?.count ?? 0) + (expiringCount > 0 ? 1 : 0);
  return (
    <header className="mx-auto w-full max-w-[1650px] rounded-2xl border border-slate-200 bg-white px-6 py-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <BackButton variant="header" />
          <span className="font-bold text-lg flex items-center tracking-tight text-slate-900 shrink-0">
            Cleon
            <span className="uppercase text-brand-text font-black">HR</span>
          </span>

          <div
            ref={searchRef}
            className={`relative hidden w-full max-w-[430px] sm:block ${guideTarget === "search" ? "guide-emphasis rounded-2xl" : ""}`}
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
              className="w-full rounded-2xl border border-transparent bg-white py-3 pl-11 pr-16 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-brand-pink/30 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
              placeholder="Search documents, employees..."
            />
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
              ⌘ F
            </span>
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/30">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {query ? "Search results" : "Your workspace"}
                </div>
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
        <div ref={attentionRef} className="relative flex items-center gap-2 sm:gap-3">
          {isDocumentManager && <>
          <button
            type="button"
            onClick={() => setAttentionOpen(attentionOpen === "approval-inbox" ? null : "approval-inbox")}
            aria-label="Open approval inbox"
            className={`relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-brand-pink ${guideTarget === "approval-inbox" ? "guide-emphasis" : ""}`}
            title="Approval inbox"
          >
            <Mail className="h-5 w-5" />
            {!!approvalInbox.data?.count && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-pink px-1 text-center text-[9px] font-bold text-white">{approvalInbox.data.count}</span>}
          </button>
          <button
            type="button"
            onClick={() => setAttentionOpen(attentionOpen === "notifications" ? null : "notifications")}
            aria-label="Open notifications"
            className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-brand-pink"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {!!notificationBadgeCount && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-pink px-1 text-center text-[9px] font-bold text-white">{notificationBadgeCount}</span>}
          </button>
          {attentionOpen && <div className="absolute right-0 top-12 z-[110] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-2 pb-3"><div><strong className="text-sm text-slate-900">{attentionOpen === "approval-inbox" ? "Approval Inbox" : "Notifications"}</strong><p className="mt-0.5 text-[11px] text-slate-400">{attentionOpen === "approval-inbox" ? "Documents ready for your decision" : "Workspace activity requiring attention"}</p></div><span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-bold text-brand-pink">{panelCount} {attentionOpen === "approval-inbox" ? "ready" : "pending"}</span></div><div className="max-h-80 overflow-y-auto">{attentionOpen === "notifications" && expiringCount > 0 && <Link href={isDocumentManager ? "/pages/compliance" : "/pages/my-compliance"} onClick={() => setAttentionOpen(null)} className="mb-2 block rounded-xl border border-orange-100 bg-orange-50 px-3 py-3 transition hover:bg-orange-100/70"><div className="flex items-start gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><div><p className="text-xs font-semibold leading-5 text-orange-800">{expiringCount} document{expiringCount === 1 ? "" : "s"} expiring soon</p><p className="mt-1 text-[10px] text-orange-700">Review compliance records within the next 30 days.</p></div></div></Link>}{attentionItems.map((item) => <Link key={`${attentionOpen}-${item.id}`} href={attentionHref(item, isDocumentManager)} onClick={() => setAttentionOpen(null)} className="block border-b border-slate-50 px-2 py-3 hover:bg-pink-50/50"><p className="text-xs font-semibold leading-5 text-slate-700">{item.message}</p><p className="mt-1 text-[10px] text-slate-400">{item.document}{"document_type" in item ? ` · ${item.document_type}` : ""}</p></Link>)}{!panelCount && !(attentionOpen === "notifications" && expiringCount > 0) && <p className="px-2 py-8 text-center text-xs text-slate-400">{attentionOpen === "approval-inbox" ? "No approval tasks are assigned to you." : "No actions require your attention."}</p>}</div></div>}
          </>}
          <div className="h-4 w-[1px] bg-slate-200" />
          <UserWidget />
        </div>
      </div>
    </header>
  );
}
