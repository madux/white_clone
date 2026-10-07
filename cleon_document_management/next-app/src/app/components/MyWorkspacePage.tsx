"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArchiveRestore,
  ClipboardCheck,
  FileText,
  ListChecks,
  Pin,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useCurrentUser } from "../../../hooks/useDocuments";
import {
  canAccessEmployeeFilesAdmin,
  canArchiveEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";
import { canAccessOrgArchived, canAccessOrgLibrary } from "../../../lib/organizationalFilesAccess";
import {
  type WorkspaceTabId,
  myWorkspaceHref,
} from "../../../lib/workspaceRoutes";
import SectionTabs from "./SectionTabs";
import MyDocumentsPage from "./MyDocumentsPage";
import DocumentLifecyclePage from "./DocumentLifecyclePage";
import QuickAccessPage from "./QuickAccessPage";
import MyCompliancePage from "./MyCompliancePage";
import ReviewQueuePage from "./ReviewQueuePage";
import MyReviewsPage from "./MyReviewsPage";
import MyTeamCompliancePage from "./MyTeamCompliancePage";

function tabFromParam(
  value: string | null,
  canArchive: boolean,
  showCompliance: boolean,
): WorkspaceTabId {
  if (value === "archived" && canArchive) return "archived";
  if (value === "recycle") return "recycle";
  if (value === "quick-access") return "quick-access";
  if (value === "compliance" && showCompliance) return "compliance";
  if (
    value === "review-queue" ||
    value === "verifications" ||
    value === "approvals"
  ) {
    return "review-queue";
  }
  if (value === "reviews" || value === "scheduled-reviews") return "reviews";
  if (value === "team") return "team";
  return "documents";
}

export default function MyWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const isManager = user.data?.is_document_manager === true;
  const canArchive =
    canArchiveEmployeeDocuments(user.data) ||
    canAccessOrgArchived(user.data) ||
    (!canAccessEmployeeFilesAdmin(user.data) && !canAccessOrgLibrary(user.data));
  const showCompliance = Boolean(user.data?.id);
  const tab = tabFromParam(searchParams.get("tab"), canArchive, showCompliance);

  const items = useMemo(
    () => [
      { id: "documents" as const, label: "Documents", icon: FileText },
      ...(canArchive
        ? [{ id: "archived" as const, label: "Archived", icon: ArchiveRestore }]
        : []),
      { id: "recycle" as const, label: "Recycle Bin", icon: Trash2 },
      { id: "quick-access" as const, label: "Quick Access", icon: Pin },
      ...(showCompliance
        ? [{ id: "compliance" as const, label: "My Compliance", icon: ShieldCheck }]
        : []),
      {
        id: "review-queue" as const,
        label: "Approvals",
        icon: ClipboardCheck,
      },
      { id: "reviews" as const, label: "Scheduled reviews", icon: ListChecks },
      { id: "team" as const, label: "My Team", icon: Users },
    ],
    [canArchive, showCompliance],
  );

  return (
    <div className="app-page space-y-4">
      <header className="app-page-header">
        <div>
          <h1>My Workspace</h1>
          <p>
            Personal documents, compliance, approvals, scheduled reviews, and team
            status.
          </p>
        </div>
      </header>
      <SectionTabs
        items={items}
        value={tab}
        onChange={(next) => router.replace(myWorkspaceHref(next))}
        level="page"
        ariaLabel="My Workspace sections"
      />
      {tab === "documents" ? <MyDocumentsPage embedded /> : null}
      {tab === "archived" ? (
        <DocumentLifecyclePage lifecycle="archived" embedded />
      ) : null}
      {tab === "recycle" ? (
        <DocumentLifecyclePage lifecycle="recycle_bin" embedded />
      ) : null}
      {tab === "quick-access" ? <QuickAccessPage embedded /> : null}
      {tab === "compliance" ? <MyCompliancePage embedded /> : null}
      {tab === "review-queue" ? <ReviewQueuePage embedded /> : null}
      {tab === "reviews" ? <MyReviewsPage embedded /> : null}
      {tab === "team" ? <MyTeamCompliancePage embedded /> : null}
    </div>
  );
}
