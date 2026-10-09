"use client";

import { MonitorSmartphone, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { WorkspaceGrant } from "../../../lib/types";
import {
  REMOTE_SESSION_CLOSE_MESSAGE,
  remoteSessionFrameName,
} from "../../../lib/workspaceGrantRpc";
import { ROUTE_MODULE_PREFIXES } from "../../../lib/workspaceModuleRoutes";

const APP_BASE_PATH = "/document-management";

function formatUntil(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(`${String(value).replace(" ", "T")}Z`));
}

function startPathFor(moduleKeys: string[]) {
  const allowed = new Set(moduleKeys);
  const entry = ROUTE_MODULE_PREFIXES.find((item) => allowed.has(item.moduleKey));
  return `${APP_BASE_PATH}${entry?.prefix ?? "/pages/my-workspace"}/`;
}

export default function RemoteSessionWindow({
  grant,
  onClose,
}: {
  grant: WorkspaceGrant;
  onClose: () => void;
}) {
  const src = useMemo(() => startPathFor(grant.module_keys), [grant.module_keys]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === REMOTE_SESSION_CLOSE_MESSAGE) onClose();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose]);

  const until = formatUntil(grant.valid_until);
  const moduleCount = grant.module_keys.length;

  return (
    <div
      className="fixed inset-0 flex bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5"
      style={{ zIndex: 200 }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-session-title"
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
              <MonitorSmartphone className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-pink">
                Remote session
              </p>
              <h2
                id="remote-session-title"
                className="truncate text-base font-bold text-slate-900"
              >
                {grant.owner_name}&apos;s workspace
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="hidden text-xs text-slate-500 sm:block">
              {until ? `Ends ${until}` : null}
              {until && moduleCount ? " · " : null}
              {moduleCount ? `${moduleCount} module${moduleCount === 1 ? "" : "s"}` : null}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
              aria-label="Close remote session"
              title="Close remote session"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <iframe
          key={grant.id}
          name={remoteSessionFrameName(grant.id)}
          src={src}
          title={`${grant.owner_name}'s workspace`}
          className="min-h-0 w-full flex-1 border-0 bg-slate-50"
        />
      </div>
    </div>
  );
}
