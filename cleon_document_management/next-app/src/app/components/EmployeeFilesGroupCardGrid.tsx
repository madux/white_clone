"use client";

import Link from "next/link";
import OrgFolderIcon from "./OrgFolderIcon";
import { useMemo } from "react";
import { employeeFileGroupsForCardView } from "../../../lib/employeeGroupTreeRows";
import type { EmployeeFileGroup } from "../../../lib/types";

export default function EmployeeFilesGroupCardGrid({
  groups,
  search = "",
}: {
  groups: EmployeeFileGroup[];
  search?: string;
}) {
  const displayGroups = useMemo(
    () => employeeFileGroupsForCardView(groups, search),
    [groups, search],
  );

  if (!displayGroups.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        No groups match your search.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {displayGroups.map((group) => (
        <Link
          key={group.id}
          href={`/pages/employee/group?id=${group.id}`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-pink-200 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <OrgFolderIcon
              className="h-10 w-10 shrink-0"
              hasContent={
                group.document_count > 0 || group.employee_count > 0
              }
            />
            <div>
              <p className="font-bold text-slate-900">{group.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                {group.employee_count} employees · {group.document_count} documents
              </p>
              {group.attention_count > 0 ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {group.attention_count} need attention
                </p>
              ) : null}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
