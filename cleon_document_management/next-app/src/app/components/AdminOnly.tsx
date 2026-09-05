"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "../../../hooks/useDocuments";

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    if (!user.isPending && user.data?.is_document_manager !== true) router.replace("/pages/my-documents");
  }, [router, user.data?.is_document_manager, user.isPending]);
  if (user.isPending || user.data?.is_document_manager !== true) return <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">Loading workspace...</div>;
  return <>{children}</>;
}
