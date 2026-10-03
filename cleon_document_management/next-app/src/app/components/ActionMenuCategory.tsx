"use client";

export default function ActionMenuCategory({ label }: { label: string }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
  );
}
