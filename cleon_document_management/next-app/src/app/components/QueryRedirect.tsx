"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function QueryRedirect({
  href,
}: {
  href: (search: URLSearchParams) => string;
}) {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    router.replace(href(new URLSearchParams(search.toString())));
  }, [href, router, search]);

  return (
    <div className="app-page text-sm text-slate-500">Redirecting…</div>
  );
}
