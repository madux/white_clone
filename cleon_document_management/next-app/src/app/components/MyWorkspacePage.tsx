"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  Activity,
  FileText,
  ListTodo,
  ScrollText,
  Send,
} from "lucide-react";
import {
  type WorkspaceTabId,
  MY_WORKSPACE_PATH,
  myWorkspaceHref,
  resolveWorkspaceTab,
  mapLegacyDocumentsParams,
} from "../../../lib/workspaceRoutes";
import SectionTabs from "./SectionTabs";
import MyDocumentsPage from "./MyDocumentsPage";
import DocumentLifecyclePage from "./DocumentLifecyclePage";
import QuickAccessPage from "./QuickAccessPage";
import ActivityPage from "./ActivityPage";
import WorkspaceTodoTab from "./WorkspaceTodoTab";
import WorkspacePoliciesTab from "./WorkspacePoliciesTab";
import WorkspaceMyRequestsTab from "./WorkspaceMyRequestsTab";
import OutOfOfficeBanner from "./OutOfOfficeBanner";

export default function MyWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind");
  const tab = resolveWorkspaceTab(searchParams.get("tab"), kind);
  const lifecycle = searchParams.get("lifecycle");
  const scope = searchParams.get("scope");

  useEffect(() => {
    const legacyTab = searchParams.get("tab");
    if (
      !legacyTab ||
      !["archived", "recycle", "quick-access", "compliance", "review-queue"].includes(
        legacyTab,
      )
    ) {
      return;
    }
    const next = mapLegacyDocumentsParams(searchParams);
    const target = `${MY_WORKSPACE_PATH}/?${next.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      router.replace(target);
    }
  }, [router, searchParams]);

  const items = useMemo(
    () => [
      { id: "todo" as const, label: "To do", icon: ListTodo },
      { id: "documents" as const, label: "My Documents", icon: FileText },
      { id: "policies" as const, label: "Policies", icon: ScrollText },
      { id: "requests" as const, label: "My Requests", icon: Send },
      { id: "activity" as const, label: "Activity", icon: Activity },
    ],
    [],
  );

  const documentsView =
    lifecycle === "archived"
      ? <DocumentLifecyclePage lifecycle="archived" embedded />
      : lifecycle === "recycle"
        ? <DocumentLifecyclePage lifecycle="recycle_bin" embedded />
        : scope === "quick-access"
          ? <QuickAccessPage embedded />
          : <MyDocumentsPage embedded />;

  return (
    <div className="app-page space-y-4">
      <OutOfOfficeBanner />
      <header className="app-page-header">
        <div>
          <h1>My Workspace</h1>
          <p>Everything that is yours: to do, documents, policies, requests, and activity.</p>
        </div>
      </header>
      <SectionTabs
        items={items}
        value={tab}
        onChange={(next: WorkspaceTabId) =>
          router.replace(myWorkspaceHref(next, kind ? { kind } : undefined))
        }
        level="page"
        ariaLabel="My Workspace sections"
      />
      {tab === "todo" ? <WorkspaceTodoTab kind={kind} /> : null}
      {tab === "documents" ? documentsView : null}
      {tab === "policies" ? <WorkspacePoliciesTab /> : null}
      {tab === "requests" ? <WorkspaceMyRequestsTab /> : null}
      {tab === "activity" ? <ActivityPage embedded /> : null}
    </div>
  );
}
