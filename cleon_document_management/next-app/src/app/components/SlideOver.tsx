"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function SlideOver({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-over-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="slide-over-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-100 px-5 py-4">{footer}</div>
        ) : null}
      </aside>
    </div>
  );
}
