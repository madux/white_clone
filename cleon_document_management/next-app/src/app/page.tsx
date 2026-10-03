"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Home() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const resolveTarget = () => {
      const user = api.injectedUser();
      if (!user) return false;
      const isAppAdmin = user.is_document_admin === true || user.is_admin === true;
      setTarget(isAppAdmin ? "/pages/dashboard" : "/pages/my-workspace");
      return true;
    };
    if (resolveTarget()) return;
    const timer = window.setInterval(() => {
      if (resolveTarget()) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!target) return;
    router.replace(target);
  }, [router, target]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-400">
      Loading workspace...
    </div>
  );
}
