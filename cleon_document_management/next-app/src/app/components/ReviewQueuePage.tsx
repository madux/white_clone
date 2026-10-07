"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { api } from "../../../lib/api";
import { canApproveEmployeeDocuments } from "../../../lib/employeeFilesAccess";
import { canApproveOrgRequests } from "../../../lib/organizationalFilesAccess";
import {
  DEFAULT_REVIEW_QUEUE_SECTION,
  parseReviewQueueSection,
  reviewQueueHref,
  type ReviewQueueSection,
} from "../../../lib/reviewQueue";
import { useCurrentUser } from "../../../hooks/useDocuments";
import ComplianceVerificationsSection from "./ComplianceVerificationsSection";
import EmployeeFilesPendingApprovalsPanel from "./EmployeeFilesPendingApprovalsPanel";
import OrganizationalApprovalRequestsPage from "./OrganizationalApprovalRequestsPage";
import SectionTabs from "./SectionTabs";

function firstAllowedSection(
  canEmployee: boolean,
  canOrg: boolean,
): ReviewQueueSection {
  return DEFAULT_REVIEW_QUEUE_SECTION;
}

function isSectionAllowed(
  section: ReviewQueueSection,
  canEmployee: boolean,
  canOrg: boolean,
): boolean {
  if (section === "compliance") return true;
  if (section === "employee") return canEmployee;
  if (section === "org") return canOrg;
  return false;
}

export default function ReviewQueuePage({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser().data;
  const canEmployee = canApproveEmployeeDocuments(user);
  const canOrg = canApproveOrgRequests(user);
  const parsed = parseReviewQueueSection(searchParams.get("section"));
  const section = isSectionAllowed(parsed, canEmployee, canOrg)
    ? parsed
    : firstAllowedSection(canEmployee, canOrg);

  useEffect(() => {
    if (parsed !== section || searchParams.get("section") === "all") {
      router.replace(reviewQueueHref(section), { scroll: false });
    }
  }, [parsed, section, router, searchParams]);

  const verifications = useQuery({
    queryKey: ["compliance", "my-verifications"],
    queryFn: () => api.getMyVerifications(),
  });
  const complianceItems = verifications.data?.data ?? [];
  const complianceDocumentIds = useMemo(
    () => new Set(complianceItems.map((item) => item.document_id)),
    [complianceItems],
  );

  const tabItems = useMemo(() => {
    const items: { id: ReviewQueueSection; label: string; count?: number }[] = [
      { id: "compliance", label: "Compliance", count: complianceItems.length },
    ];
    if (canEmployee) {
      items.push({ id: "employee", label: "Employee files" });
    }
    if (canOrg) {
      items.push({ id: "org", label: "Organisational" });
    }
    return items;
  }, [canEmployee, canOrg, complianceItems.length]);

  const activeSection = tabItems.some((item) => item.id === section)
    ? section
    : tabItems[0]?.id ?? DEFAULT_REVIEW_QUEUE_SECTION;

  const setSection = (next: ReviewQueueSection) => {
    router.replace(reviewQueueHref(next), { scroll: false });
  };

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compliance verifications, employee upload approvals, and organisational
          change requests waiting for your decision.
        </p>
      </header>

      <SectionTabs
        level="nested"
        ariaLabel="Approvals sections"
        value={activeSection}
        onChange={setSection}
        items={tabItems}
      />

      {activeSection === "compliance" ? (
        <ComplianceVerificationsSection embedded />
      ) : null}

      {activeSection === "employee" && canEmployee ? (
        <EmployeeFilesPendingApprovalsPanel
          excludeDocumentIds={complianceDocumentIds}
        />
      ) : null}

      {activeSection === "org" && canOrg ? (
        <OrganizationalApprovalRequestsPage embedded />
      ) : null}

      {!canEmployee && !canOrg && !complianceItems.length && !verifications.isLoading ? (
        <p className="text-sm text-slate-500">No approvals assigned to you.</p>
      ) : null}
    </div>
  );
}
