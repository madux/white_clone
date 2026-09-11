"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-lg",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-4xl",
  "3xl": "max-w-5xl",
  "5xl": "max-w-6xl",
};

type ModalDialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  fullscreenable?: boolean;
  zIndex?: number;
  footer?: ReactNode;
  headerActions?: ReactNode;
  backdropClassName?: string;
  titleClassName?: string;
};

export default function ModalDialog({
  title,
  eyebrow,
  description,
  onClose,
  children,
  size = "lg",
  fullscreenable = true,
  zIndex = 50,
  footer,
  headerActions,
  backdropClassName = "bg-slate-900/30",
  titleClassName = "text-2xl",
}: ModalDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
        return;
      }
      handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isFullscreen]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center backdrop-blur-sm ${backdropClassName} ${isFullscreen ? "" : "p-4"}`}
      style={{ zIndex }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-dialog-title"
        className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-all ${
          isFullscreen
            ? "h-screen max-w-none rounded-none p-8"
            : `max-h-[92vh] rounded-3xl p-6 ${SIZE_CLASSES[size]}`
        }`}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 pb-4">
          <div>
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                {eyebrow}
              </p>
            )}
            <h2
              id="modal-dialog-title"
              className={`mt-1 font-bold text-slate-900 ${titleClassName}`}
            >
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {fullscreenable && (
              <button
                type="button"
                onClick={() => setIsFullscreen((current) => !current)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-brand-pink hover:text-brand-pink"
                aria-label={isFullscreen ? "Exit full screen" : "Maximize full screen"}
                title={isFullscreen ? "Exit full screen" : "Maximize full screen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-100 pt-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
