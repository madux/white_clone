"use client";

import { CheckCircle2, Lock, X } from "lucide-react";
import { useEffectivePermissions } from "../../../../hooks/useEmployeeFilesRoles";
import EmptyState from "../EmptyState";

export default function EffectivePermissionsDrawer({
  userId,
  userName,
  onClose,
}: {
  userId: number;
  userName: string;
  onClose: () => void;
}) {
  const query = useEffectivePermissions(userId);
  const data = query.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close effective permissions"
        onClick={onClose}
      />
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="effective-permissions-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-pink">
              Effective permissions
            </p>
            <h2 id="effective-permissions-title" className="text-lg font-bold text-slate-900">
              {userName}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Combined result of all assigned roles. Read-only — edit roles to change access.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {query.isLoading ? (
            <EmptyState title="Loading permissions…" loading />
          ) : !data ? (
            <EmptyState title="Could not load permissions" />
          ) : (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Granted
                </h3>
                <ul className="mt-3 space-y-3">
                  {data.grants.length ? (
                    data.grants.map((grant, index) => (
                      <li
                        key={`${grant.role_id}-${index}`}
                        className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden
                        />
                        <div>
                          <p className="font-medium text-slate-900">{grant.module}</p>
                          <p className="text-slate-600">{grant.summary}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Scope: {grant.scope.replace("_", " ")} — from{" "}
                            <strong>{grant.role_name}</strong>
                          </p>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-500">No module permissions granted.</li>
                  )}
                </ul>
              </section>

              {data.unreachable.length ? (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Not reachable
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {data.unreachable.map((item) => (
                      <li
                        key={item.label}
                        className="flex gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm"
                      >
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                        <div>
                          <p className="font-medium text-slate-900">{item.label}</p>
                          <p className="text-slate-600">{item.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
