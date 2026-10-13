const PREFIX = "cleon.formDraft.v1:";

export function sessionFormDraftStorageKey(id: string): string {
  return `${PREFIX}${id}`;
}

export function readSessionFormDraft<T>(id: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionFormDraftStorageKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSessionFormDraft<T>(id: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(sessionFormDraftStorageKey(id), JSON.stringify(value));
  } catch {
    // Ignore quota or serialization errors.
  }
}

export function clearSessionFormDraft(id: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(sessionFormDraftStorageKey(id));
}
