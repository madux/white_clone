"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { dmsContractsApi } from "../../../lib/dmsContractsApi";
import {
  Activity,
  Archive,
  FileText,
  ListTodo,
  ScrollText,
  Search,
  Send,
  Share2,
  Trash2,
} from "lucide-react";
import {
  type WorkspaceTabId,
  MY_WORKSPACE_PATH,
  myWorkspaceHref,
  resolveWorkspaceTab,
  mapLegacyDocumentsParams,
} from "../../../lib/workspaceRoutes";
import type { WorkspaceWorkItemsPayload } from "../../../lib/workspaceWorkItems";
import SectionTabs from "./SectionTabs";

type DocumentsSubview = "active" | "archived" | "recycle";

function resolveDocumentsSubview(
  lifecycle: string | null,
): DocumentsSubview {
  if (lifecycle === "archived") return "archived";
  if (lifecycle === "recycle") return "recycle";
  return "active";
}
import MyDocumentsPage from "./MyDocumentsPage";
import DocumentLifecyclePage from "./DocumentLifecyclePage";
import QuickAccessPage from "./QuickAccessPage";
import ActivityPage from "./ActivityPage";
import WorkspaceTodoTab from "./WorkspaceTodoTab";
import WorkspacePoliciesTab from "./WorkspacePoliciesTab";
import WorkspaceMyRequestsTab from "./WorkspaceMyRequestsTab";
import WorkspaceSharingPanel from "./WorkspaceSharingPanel";
import OutOfOfficeBanner from "./OutOfOfficeBanner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export default function MyWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind");
  const tab = resolveWorkspaceTab(searchParams.get("tab"), kind);
  const lifecycle = searchParams.get("lifecycle");
  const scope = searchParams.get("scope");
  const [workPayload, setWorkPayload] = useState<WorkspaceWorkItemsPayload | null>(
    null,
  );
  const [todoSearch, setTodoSearch] = useState("");
  const [debouncedTodoSearch, setDebouncedTodoSearch] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(
    () => searchParams.get("share") === "1",
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTodoSearch(todoSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [todoSearch]);

  useEffect(() => {
    if (searchParams.get("scope") === "outstanding") {
      router.replace(myWorkspaceHref("policies", { inbox: "todo" }));
    }
  }, [router, searchParams]);

  useEffect(() => {
    const legacyTab = searchParams.get("tab");
    if (
      !legacyTab ||
      ![
        "archived",
        "recycle",
        "quick-access",
        "compliance",
        "review-queue",
        "remote-access",
      ].includes(legacyTab)
    ) {
      return;
    }
    const next = mapLegacyDocumentsParams(searchParams);
    const target = `${MY_WORKSPACE_PATH}/?${next.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      router.replace(target);
    }
  }, [router, searchParams]);

  const [workLoading, setWorkLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setWorkLoading(true);
    const search = tab === "todo" ? debouncedTodoSearch : "";
    dmsContractsApi
      .workItems(search)
      .then((result) => {
        if (!active) return;
        setWorkPayload(result.success ? result.data : null);
      })
      .catch(() => {
        if (!active) return;
        setWorkPayload(null);
      })
      .finally(() => {
        if (active) setWorkLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, debouncedTodoSearch]);

  const profileLine = useMemo(() => {
    const profile = workPayload?.profile;
    if (!profile) return null;
    return [profile.name, profile.job_title, profile.department]
      .filter(Boolean)
      .join(" • ");
  }, [workPayload]);

  const items = useMemo(
    () => [
      {
        id: "todo" as const,
        label: "To do",
        icon: ListTodo,
        count: workPayload?.tab_counts?.todo,
      },
      { id: "documents" as const, label: "My Documents", icon: FileText },
      {
        id: "policies" as const,
        label: "Policies",
        icon: ScrollText,
        count: workPayload?.tab_counts?.policies,
      },
      { id: "requests" as const, label: "My Requests", icon: Send },
      { id: "activity" as const, label: "Activity", icon: Activity },
      { id: "sharing" as const, label: "Workspace sharing", icon: Share2 },
    ],
    [workPayload],
  );

  const documentsSubview = resolveDocumentsSubview(lifecycle);

  const documentsSubnavItems = useMemo(
    () => [
      { id: "active" as const, label: "Active", icon: FileText },
      { id: "archived" as const, label: "Archived", icon: Archive },
      { id: "recycle" as const, label: "Recycle bin", icon: Trash2 },
    ],
    [],
  );

  const documentsView =
    documentsSubview === "archived"
      ? <DocumentLifecyclePage lifecycle="archived" embedded />
      : documentsSubview === "recycle"
        ? <DocumentLifecyclePage lifecycle="recycle_bin" embedded />
        : scope === "quick-access"
          ? <QuickAccessPage embedded />
          : <MyDocumentsPage embedded />;

  return (
    <div className="app-page space-y-4">
      <OutOfOfficeBanner />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {profileLine ? (
          <p className="text-sm font-medium text-slate-600">{profileLine}</p>
        ) : (
          <span className="sr-only">My Workspace</span>
        )}
        {tab === "todo" ? (
          <InputGroup className="w-full max-w-xs sm:mt-1">
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={todoSearch}
              onChange={(event) => setTodoSearch(event.target.value)}
              placeholder="Search my items"
              aria-label="Search my items"
            />
          </InputGroup>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 sm:mt-1"
            onClick={() => router.push(myWorkspaceHref("todo"))}
          >
            <Search className="h-4 w-4" data-icon="inline-start" />
            Search my items
          </Button>
        )}
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
      {tab === "todo" ? (
        <WorkspaceTodoTab payload={workPayload} loading={workLoading} />
      ) : null}
      {tab === "documents" ? (
        <div className="space-y-4">
          <SectionTabs
            items={documentsSubnavItems}
            value={documentsSubview}
            onChange={(next: DocumentsSubview) => {
              if (next === "active") {
                router.replace(myWorkspaceHref("documents"));
                return;
              }
              router.replace(myWorkspaceHref(next));
            }}
            level="nested"
            ariaLabel="My documents views"
          />
          {documentsView}
        </div>
      ) : null}
      {tab === "policies" ? <WorkspacePoliciesTab /> : null}
      {tab === "requests" ? <WorkspaceMyRequestsTab /> : null}
      {tab === "activity" ? <ActivityPage embedded /> : null}
      {tab === "sharing" ? (
        <WorkspaceSharingPanel
          embedded
          shareModalOpen={shareModalOpen}
          onShareModalOpenChange={setShareModalOpen}
        />
      ) : null}
    </div>
  );
}
