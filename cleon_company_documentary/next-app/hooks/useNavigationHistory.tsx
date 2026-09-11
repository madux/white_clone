"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  readNavigationStack,
  writeNavigationStack,
  type NavigationEntry,
} from "../lib/navigation";

type NavigationHistoryContextValue<TState> = {
  canGoBack: boolean;
  backLabel: string | null;
  goBack: () => void;
  trackNavigation: (state: TState, label: string, key: string) => void;
  registerRestore: (handler: (state: TState) => void) => void;
};

const NavigationHistoryContext =
  createContext<NavigationHistoryContextValue<unknown> | null>(null);

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<NavigationEntry<unknown>[]>([]);
  const isNavigatingBackRef = useRef(false);
  const restoreRef = useRef<((state: unknown) => void) | null>(null);

  useEffect(() => {
    setStack(readNavigationStack());
  }, []);

  const registerRestore = useCallback((handler: (state: unknown) => void) => {
    restoreRef.current = handler;
  }, []);

  const trackNavigation = useCallback(
    (state: unknown, label: string, key: string) => {
      if (isNavigatingBackRef.current) {
        isNavigatingBackRef.current = false;
        return;
      }

      const currentStack = readNavigationStack();
      const top = currentStack[currentStack.length - 1];
      const second = currentStack[currentStack.length - 2];

      let nextStack = currentStack;
      if (second?.key === key) {
        nextStack = currentStack.slice(0, -1);
      } else if (top?.key !== key) {
        nextStack = [...currentStack, { key, label, state }];
      }

      nextStack = nextStack.slice(-30);
      writeNavigationStack(nextStack);
      setStack(nextStack);
    },
    [],
  );

  const goBack = useCallback(() => {
    const currentStack = readNavigationStack();
    if (currentStack.length <= 1) return;

    const nextStack = currentStack.slice(0, -1);
    const previous = nextStack[nextStack.length - 1];
    if (!previous) return;

    isNavigatingBackRef.current = true;
    writeNavigationStack(nextStack);
    setStack(nextStack);
    restoreRef.current?.(previous.state);
  }, []);

  const value = useMemo<NavigationHistoryContextValue<unknown>>(() => {
    const previous = stack.length > 1 ? stack[stack.length - 2] : null;
    return {
      canGoBack: stack.length > 1,
      backLabel: previous?.label ?? null,
      goBack,
      trackNavigation,
      registerRestore,
    };
  }, [goBack, registerRestore, stack, trackNavigation]);

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory<TState>() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error(
      "useNavigationHistory must be used within NavigationHistoryProvider",
    );
  }
  return context as NavigationHistoryContextValue<TState>;
}
