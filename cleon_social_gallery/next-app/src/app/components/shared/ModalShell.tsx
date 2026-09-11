"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export function ModalShell({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
  className = "",
  fullscreenable = true,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
  fullscreenable?: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleClose = useCallback(() => {
    setIsFullscreen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose, isFullscreen]);

  return (
    <div
      className={`modal-backdrop${isFullscreen ? " is-fullscreen" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className={`modal-card ${wide ? "wide" : ""} ${className} ${isFullscreen ? "is-fullscreen" : ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 id="modal-title">{title}</h2>
          </div>
          <div className="modal-header-actions">
            {fullscreenable && (
              <button
                type="button"
                className="modal-icon-button"
                onClick={() => setIsFullscreen((current) => !current)}
                aria-label={isFullscreen ? "Exit full screen" : "Maximize full screen"}
                title={isFullscreen ? "Exit full screen" : "Maximize full screen"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
