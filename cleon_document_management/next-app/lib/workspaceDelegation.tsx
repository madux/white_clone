"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceGrant } from "./types";
import {
  clearLegacyWorkspaceGrant,
  readFrameWorkspaceGrantId,
  requestRemoteSessionClose,
} from "./workspaceGrantRpc";
import { api } from "./api";

type WorkspaceDelegationContextValue = {
  activeGrant: WorkspaceGrant | null;
  activeGrantId: number | null;
  /** True only inside the remote session window. */
  isRemoteMode: boolean;
  moduleKeys: string[];
  ownerName: string;
  /** Closes the remote session window (no-op outside it). */
  exitRemoteSession: () => void;
};

const WorkspaceDelegationContext =
  createContext<WorkspaceDelegationContextValue | null>(null);

const noopSubscribe = () => () => {};

function RemoteSessionNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <button
          type="button"
          className="app-btn app-btn-secondary mt-6"
          onClick={requestRemoteSessionClose}
        >
          Close remote session
        </button>
      </div>
    </div>
  );
}

export function WorkspaceDelegationProvider({ children }: { children: ReactNode }) {
  const frameGrantId = useSyncExternalStore(
    noopSubscribe,
    readFrameWorkspaceGrantId,
    () => null,
  );

  useEffect(() => {
    clearLegacyWorkspaceGrant();
  }, []);

  const session = useQuery({
    queryKey: ["workspace-access", "frame-session", frameGrantId],
    queryFn: () => api.workspaceAccessSession(frameGrantId!),
    enabled: Boolean(frameGrantId),
    refetchInterval: 60_000,
    retry: false,
  });

  const activeGrant =
    frameGrantId && session.data?.state === "active" ? session.data : null;

  const value = useMemo<WorkspaceDelegationContextValue>(
    () => ({
      activeGrant,
      activeGrantId: activeGrant?.id ?? null,
      isRemoteMode: Boolean(activeGrant),
      moduleKeys: activeGrant?.module_keys ?? [],
      ownerName: activeGrant?.owner_name ?? "",
      exitRemoteSession: requestRemoteSessionClose,
    }),
    [activeGrant],
  );

  if (frameGrantId) {
    if (session.isPending) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
          Opening workspace…
        </div>
      );
    }
    if (!activeGrant) {
      return (
        <RemoteSessionNotice
          title="Remote access has ended"
          description="This access was revoked or has expired. Ask the workspace owner for a new invitation."
        />
      );
    }
  }

  return (
    <WorkspaceDelegationContext.Provider value={value}>
      {children}
    </WorkspaceDelegationContext.Provider>
  );
}

export function useWorkspaceDelegation() {
  const ctx = useContext(WorkspaceDelegationContext);
  if (!ctx) {
    throw new Error("useWorkspaceDelegation must be used within WorkspaceDelegationProvider");
  }
  return ctx;
}

export function useWorkspaceDelegationOptional() {
  return useContext(WorkspaceDelegationContext);
}
