"use client";

import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useComplianceTargets, useSettings } from "../../../hooks/useDocuments";
import { useToast } from "../../../hooks/useToast";
import OrganizationalVisibilityFields, {
  visibilityFromOrganizationalDefaults,
  visibilityToAccessScope,
  type OrgVisibilityMode,
} from "./OrganizationalVisibilityFields";

type SettingsShape = {
  default_org_access_scope?: string;
  default_org_restricted_scope?: string;
  org_company_owned_user_ids?: number[];
  org_company_owned_user_ids_saved?: boolean;
  default_company_owned_admin_user_ids?: number[];
  org_approval_sla_hours?: number;
  org_approval_reminder_hours_before_sla?: number;
  org_approval_escalation_user_id?: number | false;
  org_approval_delegate_user_id?: number | false;
  org_approval_delegate_until?: string | false;
};

export default function OrganizationalFilesSettingsPanel({
  values,
  onChange,
  onSave,
  saving,
}: {
  values: SettingsShape;
  onChange: (patch: Partial<SettingsShape>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const settingsQuery = useSettings();
  const targets = useComplianceTargets();
  const { showToast } = useToast();
  const [delegateSearch, setDelegateSearch] = useState("");

  const defaults = visibilityFromOrganizationalDefaults(values);
  const [visibilityMode, setVisibilityMode] = useState<OrgVisibilityMode>(defaults.mode);
  const [restrictedScope, setRestrictedScope] = useState(defaults.restrictedScope);
  const [delegateIds, setDelegateIds] = useState<number[]>([]);

  const delegateOptions = useMemo(
    () =>
      (settingsQuery.data?.approvers || []).map(
        (item: { id: number; name: string; email?: string }) => ({
          id: item.id,
          name: item.name,
          email: item.email,
        }),
      ),
    [settingsQuery.data?.approvers],
  );

  const filteredDelegates = useMemo(() => {
    const term = delegateSearch.trim().toLowerCase();
    if (!term) return delegateOptions;
    return delegateOptions.filter((item) =>
      `${item.name} ${item.email ?? ""}`.toLowerCase().includes(term),
    );
  }, [delegateOptions, delegateSearch]);

  useEffect(() => {
    const next = visibilityFromOrganizationalDefaults(values);
    setVisibilityMode(next.mode);
    setRestrictedScope(next.restrictedScope);
  }, [values.default_org_access_scope, values.default_org_restricted_scope]);

  useEffect(() => {
    const saved = values.org_company_owned_user_ids;
    const fallback = values.default_company_owned_admin_user_ids || [];
    if (Array.isArray(saved) && saved.length) {
      setDelegateIds(saved.map(Number));
      return;
    }
    if (fallback.length) {
      setDelegateIds(fallback.map(Number));
    }
  }, [
    values.org_company_owned_user_ids,
    values.default_company_owned_admin_user_ids,
    values.org_company_owned_user_ids_saved,
  ]);

  const syncVisibilityToSettings = (mode: OrgVisibilityMode, restricted: string) => {
    const accessScope = visibilityToAccessScope(mode, restricted);
    onChange({
      default_org_access_scope: accessScope,
      default_org_restricted_scope: restricted,
    });
  };

  const departments = targets.data?.departments ?? [];
  const grades = targets.data?.grades ?? [];
  const employees = targets.data?.employees ?? [];

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Default visibility</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pre-selects visibility when someone creates a new organizational folder. They can still
          change it before saving unless the folder parent restricts options.
        </p>
        <div className="mt-4">
          <OrganizationalVisibilityFields
            visibilityMode={visibilityMode}
            onVisibilityModeChange={(mode) => {
              setVisibilityMode(mode);
              syncVisibilityToSettings(mode, restrictedScope);
            }}
            restrictedScope={restrictedScope}
            onRestrictedScopeChange={(scope) => {
              setRestrictedScope(scope);
              syncVisibilityToSettings(visibilityMode, scope);
            }}
            scopeIds={[]}
            onScopeIdsChange={() => undefined}
            scopeSearch=""
            onScopeSearchChange={() => undefined}
            departments={departments}
            grades={grades}
            employees={employees}
          />
          {visibilityMode === "restricted" && (
            <p className="mt-2 text-xs text-amber-700">
              Restricted defaults that need departments, grades, or employees still require a
              selection when the folder is created.
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">Company-owned access</h2>
        <p className="mt-1 text-sm text-slate-600">
          Users who can see folders and files marked <strong>Company owned</strong>, in addition to
          the uploader and platform or document administrators. Super admins and document admins are
          included by default until you save a custom list.
        </p>
        <div className="mt-4">
          <input
            value={delegateSearch}
            onChange={(event) => setDelegateSearch(event.target.value)}
            placeholder="Search users…"
            className="field"
          />
          <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
            {filteredDelegates.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-pink-50"
              >
                <input
                  type="checkbox"
                  checked={delegateIds.includes(person.id)}
                  onChange={() => {
                    const next = delegateIds.includes(person.id)
                      ? delegateIds.filter((id) => id !== person.id)
                      : [...delegateIds, person.id];
                    setDelegateIds(next);
                    onChange({ org_company_owned_user_ids: next });
                  }}
                  className="h-4 w-4 accent-pink-600"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-700">
                    {person.name}
                  </span>
                  {person.email && (
                    <span className="block truncate text-xs text-slate-400">
                      {person.email}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {delegateIds.length} user(s) selected. Document and platform administrators always keep
            access even if unchecked here.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">Organisational approval workflow</h2>
        <p className="mt-1 text-sm text-slate-600">
          SLA, reminders, escalation, and temporary delegation for gated folder and document
          actions (F43).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">SLA (hours)</span>
            <input
              type="number"
              min={1}
              className="field mt-1"
              value={values.org_approval_sla_hours ?? 48}
              onChange={(event) =>
                onChange({ org_approval_sla_hours: Number(event.target.value) || 48 })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Reminder before due (hours)</span>
            <input
              type="number"
              min={0}
              className="field mt-1"
              value={values.org_approval_reminder_hours_before_sla ?? 6}
              onChange={(event) =>
                onChange({
                  org_approval_reminder_hours_before_sla: Number(event.target.value) || 0,
                })
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Escalation approver</span>
            <select
              className="field mt-1"
              value={values.org_approval_escalation_user_id || ""}
              onChange={(event) =>
                onChange({
                  org_approval_escalation_user_id: event.target.value
                    ? Number(event.target.value)
                    : false,
                })
              }
            >
              <option value="">Default (error escalation user)</option>
              {delegateOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Delegate approver</span>
            <select
              className="field mt-1"
              value={values.org_approval_delegate_user_id || ""}
              onChange={(event) =>
                onChange({
                  org_approval_delegate_user_id: event.target.value
                    ? Number(event.target.value)
                    : false,
                })
              }
            >
              <option value="">None</option>
              {delegateOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-semibold">Delegate until (optional)</span>
            <input
              type="datetime-local"
              className="field mt-1"
              value={
                values.org_approval_delegate_until
                  ? String(values.org_approval_delegate_until).slice(0, 16)
                  : ""
              }
              onChange={(event) =>
                onChange({
                  org_approval_delegate_until: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : false,
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-400">Applies to this company only.</p>
        <button
          type="button"
          onClick={() => {
            if (!delegateIds.length) {
              showToast("Select at least one delegate for company-owned access.", "error");
              return;
            }
            onSave();
          }}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 !rounded-xl bg-gradient-to-r from-brand-text to-brand-pink px-5 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
