"use client";

import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  isTopModalLayer,
  registerModalLayer,
  unregisterModalLayer,
} from "../../../lib/modalLayerStack";
import { useFormWindowTray } from "./FormWindowProvider";

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

export type ModalDialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  fullscreenable?: boolean;
  /** When false, hide minimise (e.g. Document Intelligence). Default: on except /document-intelligence routes. */
  minimizable?: boolean;
  zIndex?: number;
  footer?: ReactNode;
  headerActions?: ReactNode;
  backdropClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  panelClassName?: string;
  closeDisabled?: boolean;
  /** Rendered from FormWindowProvider after minimise (survives route changes). */
  hostedInTray?: boolean;
  traySessionId?: string;
  /** When set, minimise hosts this tree instead of cloning only this dialog (keeps parent state). */
  renderHostedOnMinimize?: (args: {
    sessionId: string;
    onClose: () => void;
  }) => ReactNode;
};

export default function ModalDialog({
  title,
  eyebrow,
  description,
  onClose,
  children,
  size = "lg",
  fullscreenable = true,
  minimizable,
  zIndex = 50,
  footer,
  headerActions,
  backdropClassName = "bg-slate-900/30",
  titleClassName = "text-2xl",
  bodyClassName,
  panelClassName = "",
  closeDisabled = false,
  hostedInTray = false,
  traySessionId,
  renderHostedOnMinimize,
}: ModalDialogProps) {
  const pathname = usePathname();
  const tray = useFormWindowTray();
  const trayId = useId();
  const sessionId = traySessionId ?? trayId;
  const handedOffRef = useRef(false);
  const unhostRef = useRef(tray?.unhostModal);
  unhostRef.current = tray?.unhostModal;

  const hostedEntry =
    hostedInTray && tray ? tray.getHostedModal?.(sessionId) : undefined;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const layerIdRef = useRef(-1);

  const allowMinimize =
    minimizable ??
    !pathname?.includes("/pages/document-intelligence");

  const isMinimized = hostedInTray
    ? (hostedEntry?.minimized ?? false)
    : handedOff;

  const handleClose = useCallback(() => {
    if (closeDisabled) return;
    setIsFullscreen(false);
    unhostRef.current?.(sessionId);
    onClose();
  }, [closeDisabled, onClose, sessionId]);

  const handleMinimize = useCallback(() => {
    if (!allowMinimize || !tray || closeDisabled) return;

    if (hostedInTray) {
      tray.setHostedMinimized(sessionId, true);
      setIsFullscreen(false);
      return;
    }

    const closeHandler = () => {
      tray.unhostModal(sessionId);
      onClose();
    };

    const hostedContent = renderHostedOnMinimize
      ? renderHostedOnMinimize({ sessionId, onClose: closeHandler })
      : (
        <ModalDialog
          hostedInTray
          traySessionId={sessionId}
          title={title}
          eyebrow={eyebrow}
          description={description}
          onClose={closeHandler}
          size={size}
          fullscreenable={fullscreenable}
          minimizable={minimizable}
          zIndex={zIndex}
          footer={footer}
          headerActions={headerActions}
          backdropClassName={backdropClassName}
          titleClassName={titleClassName}
          bodyClassName={bodyClassName}
          panelClassName={panelClassName}
          closeDisabled={closeDisabled}
        >
          {children}
        </ModalDialog>
      );

    tray.hostModal({
      id: sessionId,
      title,
      minimized: true,
      onClose: closeHandler,
      content: hostedContent,
    });
    handedOffRef.current = true;
    setHandedOff(true);
    setIsFullscreen(false);
  }, [
    allowMinimize,
    tray,
    closeDisabled,
    hostedInTray,
    sessionId,
    title,
    eyebrow,
    description,
    onClose,
    size,
    fullscreenable,
    minimizable,
    zIndex,
    footer,
    headerActions,
    backdropClassName,
    titleClassName,
    bodyClassName,
    panelClassName,
    children,
    renderHostedOnMinimize,
  ]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || isMinimized) return;
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
  }, [isMinimized]);

  useEffect(() => {
    if (isMinimized) {
      if (layerIdRef.current >= 0) {
        unregisterModalLayer(layerIdRef.current);
        layerIdRef.current = -1;
      }
      return;
    }
    const id = registerModalLayer(handleClose);
    layerIdRef.current = id;
    return () => unregisterModalLayer(id);
  }, [handleClose, isMinimized]);

  useEffect(() => {
    return () => {
      if (handedOffRef.current) return;
      if (hostedInTray) return;
      unhostRef.current?.(sessionId);
    };
  }, [hostedInTray, sessionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isMinimized) {
        return;
      }
      if (!isTopModalLayer(layerIdRef.current)) return;
      if (isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
        return;
      }
      event.preventDefault();
      handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isFullscreen, isMinimized]);

  if (!hostedInTray && handedOff) {
    return null;
  }

  if (isMinimized) {
    return null;
  }

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
        className={`flex w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl transition-all ${
          isFullscreen
            ? "h-screen max-w-none rounded-none p-8"
            : `max-h-[92vh] rounded-3xl p-6 ${SIZE_CLASSES[size]} ${panelClassName}`
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                {eyebrow}
              </p>
            )}
            <h2
              id="modal-dialog-title"
              className={`mt-1 break-words font-bold text-slate-900 ${titleClassName}`}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {allowMinimize && tray ? (
              <button
                type="button"
                onClick={handleMinimize}
                disabled={closeDisabled}
                className="form-window-control disabled:opacity-40"
                aria-label="Minimise dialog"
                title="Minimise"
              >
                <Minus className="h-4 w-4" />
              </button>
            ) : null}
            {fullscreenable && (
              <button
                type="button"
                onClick={() => setIsFullscreen((current) => !current)}
                className="form-window-control"
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
            {!closeDisabled ? (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
        <div
          className={`min-h-0 min-w-0 flex-1 overflow-x-hidden pt-4 ${bodyClassName || "overflow-y-auto"}`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-slate-100 pt-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
