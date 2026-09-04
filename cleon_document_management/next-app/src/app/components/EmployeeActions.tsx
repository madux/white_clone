"use client";

import { Copy, Download, Ellipsis, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useRef } from "react";
import { useClickOutside } from "../../../hooks/useClickOutside";

export default function EmployeeActions({ employeeId }: { employeeId: number }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  useClickOutside(menuRef, () => { if (menuRef.current) menuRef.current.open = false; });
  const openProfile = () => router.push(`/pages/employee/profile?employee=${employeeId}`);
  const copyProfile = async () => {
    await navigator.clipboard?.writeText(`${window.location.origin}/document-management/pages/employee/profile?employee=${employeeId}`);
    window.alert("Employee profile link copied.");
  };
  return <div className="group relative" onClick={(event) => event.stopPropagation()}><details ref={menuRef} className="relative"><summary className="list-none cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><Ellipsis className="h-5 w-5" /></summary><div className="absolute right-0 z-30 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"><button type="button" onClick={openProfile} className="menu-item"><ExternalLink />Open profile</button><button type="button" onClick={() => api.downloadEmployee(employeeId)} className="menu-item"><Download />Download files</button><button type="button" onClick={copyProfile} className="menu-item"><Copy />Copy profile link</button></div></details></div>;
}
