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
  useMyReviewAlerts,
  usePolicies,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { useClickOutside } from "../../../hooks/useClickOutside";
import type {
  AdminAttention,
  ApprovalInboxItem,
  DocDocument,
  ExpiringDocument,
  ReviewAlertItem,
} from "../../../lib/types";
import {
  acknowledgementViewHref,
  documentViewHref,
} from "../../../lib/documentLinks";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import { groupMetricResults } from "./EmployeeMetricPicker";
import BackButton from "./BackButton";
import Sidebar from "./Sidebar";

type AttentionItem = AdminAttention["notifications"][number] | ApprovalInboxItem;

function attentionHref(item: AttentionItem, isDocumentManager: boolean) {
  if ("document_id" in item && item.document_id) {
    return documentViewHref(
      {
        id: item.document_id,
        folder_id: "folder_id" in item ? item.folder_id : undefined,
        employee_id: item.employee_id,
        folder_type: "folder_type" in item ? item.folder_type : undefined,
      },
      isDocumentManager,
    );
  }
  if (!isDocumentManager) {
    return myWorkspaceHref("documents");
  }
  return item.employee_id
    ? `/pages/employee/profile/?employee=${item.employee_id}`
    : "/pages/employee/";
}

function formatExpiryDate(value: string) {
  if (!value) return "soon";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(String(value).replace(" ", "T")));
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
  const reviewAlerts = useMyReviewAlerts(true);
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
          detail: "Compliance policy",
          href: "/pages/compliance",
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
  const attentionNotifications = (attention.data?.notifications ?? []).filter(
    (item) => Boolean(item.employee_id),
  );
  const approvalItems = (approvalInbox.data?.items ?? []).filter(
    (item) => item.folder_type !== "organizational",
  );
  const pendingAcknowledgements = (myWorkspace.data?.shared_documents ?? []).filter(
    (document: DocDocument) => document.acknowledged === false,
  );
  const attentionItems = attentionOpen === "approval-inbox"
    ? approvalItems
    : attentionNotifications;
  const expiringItems: ExpiringDocument[] = isDocumentManager
    ? dashboardStats.data?.expiring_items ?? []
    : myWorkspace.data?.expiring_documents ?? [];
  const reviewAlertCount = reviewAlerts.data?.count ?? 0;
  const acknowledgementCount = pendingAcknowledgements.length;
  const panelCount = attentionOpen === "approval-inbox"
    ? approvalItems.length
    : attentionNotifications.length +
      expiringItems.length +
      reviewAlertCount +
      acknowledgementCount;
  const notificationBadgeCount =
    attentionNotifications.length +
    expiringItems.length +
    reviewAlertCount +
    acknowledgementCount;
  const employeeNotificationCount =
    reviewAlertCount + expiringItems.length + acknowledgementCount;
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
              placeholder="Search documents, employees, departments..."
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:inline">
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
          {isDocumentManager ? (
          <>
          <button
            type="button"
            onClick={() => setAttentionOpen(attentionOpen === "approval-inbox" ? null : "approval-inbox")}
            aria-label="Open approval inbox"
            className={`relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-brand-pink ${guideTarget === "approval-inbox" ? "guide-emphasis" : ""}`}
            title="Approval inbox"
          >
            <Mail className="h-5 w-5" />
            {!!approvalItems.length && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-pink px-1 text-center text-[9px] font-bold text-white">{approvalItems.length}</span>}
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
          {attentionOpen ? (
            <div className="absolute right-0 top-12 z-[110] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-3">
                <div>
                  <strong className="text-sm text-slate-900">
                    {attentionOpen === "approval-inbox"
                      ? "Approval Inbox"
                      : "Notifications"}
                  </strong>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {attentionOpen === "approval-inbox"
                      ? "Documents ready for your decision"
                      : "Documents to acknowledge and other workspace activity"}
                  </p>
                </div>
                <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-bold text-brand-pink">
                  {panelCount}{" "}
                  {attentionOpen === "approval-inbox" ? "ready" : "pending"}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {attentionOpen === "notifications" &&
                  pendingAcknowledgements.map((document) => (
                    <Link
                      key={`ack-${document.id}`}
                      href={acknowledgementViewHref(document.id)}
                      onClick={() => setAttentionOpen(null)}
                      className="mb-2 block rounded-xl border border-pink-100 bg-pink-50 px-3 py-3 transition hover:bg-pink-100/70"
                    >
                      <p className="text-xs font-semibold leading-5 text-pink-900">
                        You need to acknowledge {document.name}
                      </p>
                      <p className="mt-1 text-[10px] text-pink-700">
                        {document.document_type}
                        {document.folder_name ? ` · ${document.folder_name}` : ""}
                      </p>
                    </Link>
                  ))}
                {attentionOpen === "notifications" &&
                  (reviewAlerts.data?.items ?? []).map((item: ReviewAlertItem) => (
                    <Link
                      key={`review-alert-${item.id}`}
                      href={myWorkspaceHref("documents", {
                        scope: "files",
                        doc: String(item.document_id),
                      })}
                      onClick={() => setAttentionOpen(null)}
                      className="mb-2 block rounded-xl border border-red-100 bg-red-50 px-3 py-3 transition hover:bg-red-100/70"
                    >
                      <p className="text-xs font-semibold leading-5 text-red-900">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[10px] text-red-700">
                        {item.document}
                        {item.rejection_reason ? ` · ${item.rejection_reason}` : ""}
                      </p>
                    </Link>
                  ))}
                {attentionOpen === "notifications" &&
                  expiringItems.map((item) => (
                    <Link
                      key={`expiring-${item.id}`}
                      href={documentViewHref(item, isDocumentManager)}
                      onClick={() => setAttentionOpen(null)}
                      className="mb-2 block rounded-xl border border-orange-100 bg-orange-50 px-3 py-3 transition hover:bg-orange-100/70"
                    >
                      <div className="flex items-start gap-3">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                        <div>
                          <p className="text-xs font-semibold leading-5 text-orange-900">
                            {item.name}
                          </p>
                          <p className="mt-1 text-[10px] text-orange-700">
                            {item.document_type} · Expires{" "}
                            {formatExpiryDate(item.expiry_date)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                {attentionItems.map((item) => (
                  <Link
                    key={`${attentionOpen}-${item.id}`}
                    href={attentionHref(item, isDocumentManager)}
                    onClick={() => setAttentionOpen(null)}
                    className="block border-b border-slate-50 px-2 py-3 hover:bg-pink-50/50"
                  >
                    <p className="text-xs font-semibold leading-5 text-slate-700">
                      {item.message}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {item.document}
                      {"document_type" in item ? ` · ${item.document_type}` : ""}
                    </p>
                  </Link>
                ))}
                {!panelCount && (
                  <p className="px-2 py-8 text-center text-xs text-slate-400">
                    {attentionOpen === "approval-inbox"
                      ? "No approval tasks are assigned to you."
                      : "No actions require your attention."}
                  </p>
                )}
              </div>
            </div>
          ) : null}
          </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  setAttentionOpen(attentionOpen === "notifications" ? null : "notifications")
                }
                aria-label="Open notifications"
                className="relative rounded-xl p-2.5 text-slate-400 transition hover:bg-white hover:text-brand-pink"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {!!employeeNotificationCount && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-pink px-1 text-center text-[9px] font-bold text-white">
                    {employeeNotificationCount}
                  </span>
                )}
              </button>
              {attentionOpen === "notifications" && (
                <div className="absolute right-0 top-12 z-[110] w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-3">
                    <div>
                      <strong className="text-sm text-slate-900">Notifications</strong>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Documents to acknowledge and other alerts
                      </p>
                    </div>
                    <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-bold text-brand-pink">
                      {employeeNotificationCount} pending
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pendingAcknowledgements.map((document) => (
                      <Link
                        key={`ack-${document.id}`}
                        href={acknowledgementViewHref(document.id)}
                        onClick={() => setAttentionOpen(null)}
                        className="mb-2 block rounded-xl border border-pink-100 bg-pink-50 px-3 py-3 transition hover:bg-pink-100/70"
                      >
                        <p className="text-xs font-semibold leading-5 text-pink-900">
                          You need to acknowledge {document.name}
                        </p>
                        <p className="mt-1 text-[10px] text-pink-700">
                          {document.document_type}
                          {document.folder_name ? ` · ${document.folder_name}` : ""}
                        </p>
                      </Link>
                    ))}
                    {(reviewAlerts.data?.items ?? []).map((item: ReviewAlertItem) => (
                      <Link
                        key={`review-alert-${item.id}`}
                        href={myWorkspaceHref("documents", { scope: "files", doc: String(item.document_id) })}
                        onClick={() => setAttentionOpen(null)}
                        className="mb-2 block rounded-xl border border-red-100 bg-red-50 px-3 py-3 transition hover:bg-red-100/70"
                      >
                        <p className="text-xs font-semibold leading-5 text-red-900">
                          {item.message}
                        </p>
                        <p className="mt-1 text-[10px] text-red-700">
                          {item.document}
                          {item.rejection_reason ? ` · ${item.rejection_reason}` : ""}
                        </p>
                      </Link>
                    ))}
                    {expiringItems.map((item) => (
                      <Link
                        key={`expiring-${item.id}`}
                        href={documentViewHref(item, isDocumentManager)}
                        onClick={() => setAttentionOpen(null)}
                        className="mb-2 block rounded-xl border border-orange-100 bg-orange-50 px-3 py-3 transition hover:bg-orange-100/70"
                      >
                        <div className="flex items-start gap-3">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                          <div>
                            <p className="text-xs font-semibold leading-5 text-orange-900">
                              {item.name}
                            </p>
                            <p className="mt-1 text-[10px] text-orange-700">
                              {item.document_type} · Expires{" "}
                              {formatExpiryDate(item.expiry_date)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {!employeeNotificationCount && (
                      <p className="px-2 py-8 text-center text-xs text-slate-400">
                        No actions require your attention.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <UserWidget />
        </div>
      </div>
      <Sidebar />
    </header>
  );
}
