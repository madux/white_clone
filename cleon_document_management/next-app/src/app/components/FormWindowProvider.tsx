"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

export type HostedModalEntry = {
  id: string;
  title: string;
  minimized: boolean;
  content: ReactNode;
  onClose: () => void;
};

/** @deprecated legacy tray chip shape — use hosted modals */
export type MinimizedForm = {
  id: string;
  title: string;
  restore: () => void;
  dismiss?: () => void;
};

type FormWindowActions = {
  hostModal: (entry: HostedModalEntry) => void;
  setHostedMinimized: (id: string, minimized: boolean) => void;
  unhostModal: (id: string) => void;
  minimize: (form: MinimizedForm) => void;
  removeMinimized: (id: string) => void;
};

const FormWindowActionsContext = createContext<FormWindowActions | null>(null);
const HostedModalsContext = createContext<HostedModalEntry[]>([]);

export function useFormWindowTray() {
  const actions = useContext(FormWindowActionsContext);
  const hosted = useContext(HostedModalsContext);
  if (!actions) return null;
  const minimized = hosted
    .filter((entry) => entry.minimized)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      restore: () => actions.setHostedMinimized(entry.id, false),
      dismiss: entry.onClose,
    }));
  return {
    ...actions,
    hosted,
    minimized,
    getHostedModal: (id: string) => hosted.find((entry) => entry.id === id),
  };
}

export function FormWindowProvider({ children }: { children: ReactNode }) {
  const [hosted, setHosted] = useState<HostedModalEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const hostModal = useCallback((entry: HostedModalEntry) => {
    setHosted((current) => {
      const without = current.filter((item) => item.id !== entry.id);
      return [...without, entry];
    });
  }, []);

  const setHostedMinimized = useCallback((id: string, minimized: boolean) => {
    setHosted((current) =>
      current.map((item) => (item.id === id ? { ...item, minimized } : item)),
    );
  }, []);

  const unhostModal = useCallback((id: string) => {
    setHosted((current) => current.filter((item) => item.id !== id));
  }, []);

  const minimize = useCallback((form: MinimizedForm) => {
    setHostedMinimized(form.id, true);
    form.restore();
  }, [setHostedMinimized]);

  const removeMinimized = useCallback(
    (id: string) => {
      unhostModal(id);
    },
    [unhostModal],
  );

  const actions = useMemo(
    () => ({
      hostModal,
      setHostedMinimized,
      unhostModal,
      minimize,
      removeMinimized,
    }),
    [hostModal, setHostedMinimized, unhostModal, minimize, removeMinimized],
  );

  const minimizedEntries = hosted.filter((entry) => entry.minimized);

  const tray =
    mounted && minimizedEntries.length > 0
      ? createPortal(
          <div
            className="form-window-tray"
            role="region"
            aria-label="Minimised forms"
          >
            {minimizedEntries.map((form) => (
              <div key={form.id} className="form-window-tray__item">
                <button
                  type="button"
                  className="form-window-tray__restore"
                  onClick={() => setHostedMinimized(form.id, false)}
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  <span className="truncate">{form.title}</span>
                </button>
                <button
                  type="button"
                  className="form-window-tray__dismiss"
                  aria-label={`Close ${form.title}`}
                  onClick={() => {
                    form.onClose();
                    unhostModal(form.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  const openHosted =
    mounted && hosted.some((entry) => !entry.minimized)
      ? createPortal(
          <>
            {hosted
              .filter((entry) => !entry.minimized)
              .map((entry) => (
                <div key={entry.id}>{entry.content}</div>
              ))}
          </>,
          document.body,
        )
      : null;

  return (
    <FormWindowActionsContext.Provider value={actions}>
      <HostedModalsContext.Provider value={hosted}>
        {children}
        {openHosted}
        {tray}
      </HostedModalsContext.Provider>
    </FormWindowActionsContext.Provider>
  );
}
