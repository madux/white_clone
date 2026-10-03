"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ComplianceRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "compliance");
    router.replace(`/pages/employee?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="app-page">
      <p className="text-sm text-slate-500">Opening compliance…</p>
    </div>
  );
}
