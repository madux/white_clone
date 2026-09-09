export type NavigationEntry<TState = Record<string, unknown>> = {
  key: string;
  label: string;
  state: TState;
};

export const NAVIGATION_STACK_KEY = "cleon-social-gallery-navigation-stack";

export function readNavigationStack<TState>(): NavigationEntry<TState>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(NAVIGATION_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NavigationEntry<TState>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeNavigationStack<TState>(stack: NavigationEntry<TState>[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NAVIGATION_STACK_KEY, JSON.stringify(stack.slice(-30)));
}
