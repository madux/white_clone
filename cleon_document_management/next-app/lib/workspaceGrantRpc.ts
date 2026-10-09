/**
 * Remote (delegated) access only ever runs inside the remote session window's iframe.
 * The grant id lives in that iframe's `window.name`, so the delegate's own tab is never
 * switched into the owner's workspace.
 */
const FRAME_NAME_PREFIX = "cleon-remote-grant-";
const LEGACY_STORAGE_KEY = "cleon_workspace_active_grant_id";

export const REMOTE_SESSION_CLOSE_MESSAGE = "cleon:remote-session-close";

export function remoteSessionFrameName(grantId: number) {
  return `${FRAME_NAME_PREFIX}${grantId}`;
}

export function readFrameWorkspaceGrantId(): number | null {
  if (typeof window === "undefined" || window.self === window.top) return null;
  const name = window.name || "";
  if (!name.startsWith(FRAME_NAME_PREFIX)) return null;
  const parsed = Number(name.slice(FRAME_NAME_PREFIX.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getActiveWorkspaceGrantId(): number | null {
  return readFrameWorkspaceGrantId();
}

export function clearLegacyWorkspaceGrant() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function requestRemoteSessionClose() {
  if (typeof window === "undefined" || window.self === window.top) return;
  window.parent.postMessage(
    { type: REMOTE_SESSION_CLOSE_MESSAGE, grantId: readFrameWorkspaceGrantId() },
    window.location.origin,
  );
}
