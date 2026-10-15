"use client";

import Link from "next/link";

export default function OrganizationalPolicyAssignmentsBanner() {
  return (
    <Link
      href="/pages/organization/policy-assignments"
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-pink px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
    >
      Policy assignments
    </Link>
  );
}
