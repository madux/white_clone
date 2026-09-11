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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildRouteHref,
  getNavigationLabel,
  normalizeRoutePath,
  readNavigationStack,
  type NavigationEntry,
  writeNavigationStack,
} from "../lib/navigation";

type NavigationHistoryContextValue = {
  canGoBack: boolean;
  backLabel: string | null;
  goBack: () => void;
};

const NavigationHistoryContext =
  createContext<NavigationHistoryContextValue | null>(null);

function NavigationHistoryTracker({
  onStackChange,
  isNavigatingBackRef,
}: {
  onStackChange: (stack: NavigationEntry[]) => void;
  isNavigatingBackRef: React.MutableRefObject<boolean>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const route = normalizeRoutePath(pathname);
    const search = searchParams.toString();
    const href = buildRouteHref(route, search);
    const label = getNavigationLabel(route, searchParams);

    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }

    const currentStack = readNavigationStack();
    const top = currentStack[currentStack.length - 1];
    const second = currentStack[currentStack.length - 2];

    let nextStack = currentStack;
    if (second?.href === href) {
      nextStack = currentStack.slice(0, -1);
    } else if (top?.href !== href) {
      nextStack = [...currentStack, { href, label }];
    }

    nextStack = nextStack.slice(-30);
    writeNavigationStack(nextStack);
    onStackChange(nextStack);
  }, [isNavigatingBackRef, onStackChange, pathname, searchParams]);

  return null;
}

export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [stack, setStack] = useState<NavigationEntry[]>([]);
  const isNavigatingBackRef = useRef(false);

  useEffect(() => {
    setStack(readNavigationStack());
  }, []);

  const goBack = useCallback(() => {
    const currentStack = readNavigationStack();
    if (currentStack.length <= 1) {
      router.back();
      return;
    }

    const nextStack = currentStack.slice(0, -1);
    const previous = nextStack[nextStack.length - 1];
    if (!previous) {
      router.back();
      return;
    }

    isNavigatingBackRef.current = true;
    writeNavigationStack(nextStack);
    setStack(nextStack);
    router.push(previous.href);
  }, [router]);

  const value = useMemo<NavigationHistoryContextValue>(() => {
    const previous = stack.length > 1 ? stack[stack.length - 2] : null;
    return {
      canGoBack: stack.length > 1,
      backLabel: previous?.label ?? null,
      goBack,
    };
  }, [goBack, stack]);

  return (
    <NavigationHistoryContext.Provider value={value}>
      <NavigationHistoryTracker
        onStackChange={setStack}
        isNavigatingBackRef={isNavigatingBackRef}
      />
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error(
      "useNavigationHistory must be used within NavigationHistoryProvider",
    );
  }
  return context;
}
