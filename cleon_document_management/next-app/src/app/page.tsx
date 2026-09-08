"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pages/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
      Loading dashboard...
    </div>
  );
}
