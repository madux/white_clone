"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useFormWindowTray } from "./FormWindowProvider";

export type FormWindowMode = "full" | "modal";

type FormWindowShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  defaultMode?: FormWindowMode;
  zIndex?: number;
};

export default function FormWindowShell({
  title,
  eyebrow,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  defaultMode = "modal",
  zIndex = 80,
}: FormWindowShellProps) {
  const pathname = usePathname();
  const trayId = useId();
  const tray = useFormWindowTray();
  const removeMinimizedRef = useRef(tray?.removeMinimized);
  removeMinimizedRef.current = tray?.removeMinimized;
  const allowMinimize = !pathname?.includes("/pages/document-intelligence");
  const [mode, setMode] = useState<FormWindowMode | "minimized">(defaultMode);

  const handleClose = useCallback(() => {
    if (closeDisabled) return;
    removeMinimizedRef.current?.(trayId);
    onClose();
  }, [closeDisabled, onClose, trayId]);

  const restoreFromTray = useCallback(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const handleMinimize = () => {
    if (!allowMinimize || !tray) return;
    tray.minimize({
      id: trayId,
      title,
      restore: restoreFromTray,
      dismiss: handleClose,
    });
    setMode("minimized");
  };

  useEffect(() => {
    return () => removeMinimizedRef.current?.(trayId);
  }, [trayId]);

  if (mode === "minimized") {
    return null;
  }

  const isFull = mode === "full";

  return (
    <div
      className={`fixed inset-0 flex backdrop-blur-sm ${
        isFull ? "items-stretch justify-stretch bg-white" : "items-center justify-center bg-slate-900/30 p-4"
      }`}
      style={{ zIndex }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-window-title"
        className={`flex min-w-0 flex-col overflow-hidden bg-white shadow-2xl ${
          isFull
            ? "h-full w-full rounded-none"
            : "max-h-[92vh] w-full max-w-2xl rounded-3xl"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 md:px-10">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                {eyebrow}
              </p>
            ) : null}
            <h2 id="form-window-title" className="mt-1 text-2xl font-bold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {allowMinimize && tray ? (
              <button
                type="button"
                className="form-window-control"
                aria-label="Minimise form"
                title="Minimise"
                onClick={handleMinimize}
              >
                <Minus className="h-4 w-4" />
              </button>
            ) : null}
            {isFull ? (
              <button
                type="button"
                className="form-window-control"
                aria-label="Open as modal"
                title="Modal"
                onClick={() => setMode("modal")}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="form-window-control"
                aria-label="Expand to full page"
                title="Expand"
                onClick={() => setMode("full")}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {!closeDisabled ? (
              <button
                type="button"
                className="form-window-control"
                aria-label="Close"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 md:px-10">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-slate-100 px-6 py-4 md:px-10">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
