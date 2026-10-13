"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
  kind: "default" | "progress";
  detail?: string;
  progressPercent?: number;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
  showProgressToast: (message: string, detail?: string, progressPercent?: number) => number;
  updateProgressToast: (
    id: number,
    message: string,
    detail?: string,
    progressPercent?: number,
  ) => void;
  finishProgressToast: (id: number, message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type, kind: "default" }]);
  }, []);

  const showProgressToast = useCallback(
    (message: string, detail?: string, progressPercent = 0) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [
        ...current,
        {
          id,
          message,
          type: "success",
          kind: "progress",
          detail,
          progressPercent,
        },
      ]);
      return id;
    },
    [],
  );

  const updateProgressToast = useCallback(
    (
      id: number,
      message: string,
      detail?: string,
      progressPercent?: number,
    ) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id && toast.kind === "progress"
            ? {
                ...toast,
                message,
                detail,
                progressPercent:
                  progressPercent ?? toast.progressPercent ?? 0,
              }
            : toast,
        ),
      );
    },
    [],
  );

  const finishProgressToast = useCallback(
    (id: number, message: string, type: ToastType) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id
            ? {
                ...toast,
                message,
                type,
                kind: "default",
                detail: undefined,
                progressPercent: undefined,
              }
            : toast,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const dismissible = toasts.filter((toast) => toast.kind === "default");
    if (!dismissible.length) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => {
        const firstDefault = current.find((item) => item.kind === "default");
        if (!firstDefault) return current;
        return current.filter((item) => item.id !== firstDefault.id);
      });
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showProgressToast,
        updateProgressToast,
        finishProgressToast,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`app-toast ${toast.type}${toast.kind === "progress" ? " progress" : ""}`}
            role={toast.kind === "progress" ? "status" : undefined}
          >
            <span>
              {toast.kind === "progress" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : toast.type === "success" ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug">{toast.message}</p>
              {toast.detail ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500">{toast.detail}</p>
              ) : null}
              {toast.kind === "progress" ? (
                <div
                  className="app-toast-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={toast.progressPercent ?? 0}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, toast.progressPercent ?? 0))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
