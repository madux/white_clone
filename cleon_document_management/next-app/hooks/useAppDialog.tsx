"use client";

import { AlertCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ModalDialog from "../src/app/components/ModalDialog";

type DialogTone = "default" | "danger";

type AlertOptions = {
  title?: string;
  eyebrow?: string;
  confirmLabel?: string;
};

type ConfirmOptions = {
  title?: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type DialogRequest = {
  kind: "alert" | "confirm";
  message: string;
  title: string;
  eyebrow: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  resolve: (value: boolean) => void;
};

type AppDialogContextValue = {
  showAlert: (message: string, options?: AlertOptions) => Promise<void>;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function inferTone(message: string, tone?: DialogTone): DialogTone {
  if (tone) return tone;
  if (/delete|cannot be undone|recycle bin|removed from/i.test(message)) {
    return "danger";
  }
  return "default";
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const current = queue[0];

  const enqueue = useCallback((request: DialogRequest) => {
    setQueue((existing) => [...existing, request]);
  }, []);

  const closeCurrent = useCallback((value: boolean) => {
    setQueue((existing) => {
      existing[0]?.resolve(value);
      return existing.slice(1);
    });
  }, []);

  const showAlert = useCallback(
    (message: string, options: AlertOptions = {}) =>
      new Promise<void>((resolve) => {
        enqueue({
          kind: "alert",
          message,
          title: options.title || "Notice",
          eyebrow: options.eyebrow || "Alert",
          confirmLabel: options.confirmLabel || "OK",
          cancelLabel: "Cancel",
          tone: "default",
          resolve: () => resolve(),
        });
      }),
    [enqueue],
  );

  const showConfirm = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        const tone = inferTone(message, options.tone);
        enqueue({
          kind: "confirm",
          message,
          title: options.title || (tone === "danger" ? "Please confirm" : "Please confirm"),
          eyebrow: options.eyebrow || (tone === "danger" ? "Warning" : "Confirm"),
          confirmLabel:
            options.confirmLabel || (tone === "danger" ? "Continue" : "Confirm"),
          cancelLabel: options.cancelLabel || "Cancel",
          tone,
          resolve,
        });
      }),
    [enqueue],
  );

  const value = useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  );

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {current ? (
        <ModalDialog
          title={current.title}
          eyebrow={current.eyebrow}
          onClose={() => closeCurrent(false)}
          size="sm"
          fullscreenable={false}
          zIndex={80}
          backdropClassName="bg-slate-950/45"
          titleClassName="text-xl"
        >
          <div className="flex gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                current.tone === "danger"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-pink-50 text-brand-pink"
              }`}
            >
              <AlertCircle className="h-4 w-4" />
            </span>
            <p className="text-sm leading-6 text-slate-600">{current.message}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {current.kind === "confirm" ? (
              <button
                type="button"
                onClick={() => closeCurrent(false)}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
              >
                {current.cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => closeCurrent(true)}
              className={
                current.kind === "confirm" && current.tone === "danger"
                  ? "rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                  : "rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white"
              }
            >
              {current.confirmLabel}
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return context;
}
