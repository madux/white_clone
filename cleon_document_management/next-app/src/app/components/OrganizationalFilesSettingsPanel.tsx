"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useComplianceTargets, useSettings } from "../../../hooks/useDocuments";
import { useToast } from "../../../hooks/useToast";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";
import OrganizationalVisibilityFields, {
  visibilityFromOrganizationalDefaults,
  visibilityToAccessScope,
  type OrgVisibilityMode,
} from "./OrganizationalVisibilityFields";
import { SettingsFieldHelp } from "./EmployeeFilesOrganizingDimensionsSettings";

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

type OrgSettingsTab = "general" | "company_owned" | "approvals";

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}

function SettingRow({
  label,
  help,
  children,
  top,
}: {
  label: string;
  help: string;
  children: ReactNode;
  top?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 border-t border-[var(--rule)] py-3 first:border-t-0 first:pt-3 ${
        top ? "items-start" : "items-center"
      }`}
    >
      <span
        className={`flex w-44 shrink-0 items-center gap-1.5 text-sm font-medium text-[var(--ink)] ${
          top ? "pt-1.5" : ""
        }`}
      >
        {label}
        <SettingsFieldHelp label={label} text={help} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function HoursInput({
  value,
  onChange,
  min = 0,
  suffix = "hrs",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="flex max-w-[160px] overflow-hidden rounded-lg border border-[var(--rule)] bg-white">
      <input
        type="number"
        min={min}
        className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="bg-[#f4f2f6] px-3 py-2 text-xs font-semibold text-slate-600">
        {suffix}
      </span>
    </div>
  );
}

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
  const [tab, setTab] = useState<OrgSettingsTab>("general");
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

  const approverSelectOptions = useMemo(
    () =>
      delegateOptions.map((person) => ({
        value: String(person.id),
        label: person.name,
      })),
    [delegateOptions],
  );

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!delegateIds.length) {
      showToast("Select at least one user for company-owned access.", "error");
      return;
    }
    onSave();
  };

  return (
    <div className="space-y-6">
      <SectionTabs
        level="nested"
        ariaLabel="Organisational Files settings"
        value={tab}
        onChange={setTab}
        items={[
          { id: "general", label: "General" },
          { id: "company_owned", label: "Company-owned" },
          { id: "approvals", label: "Approvals" },
        ]}
      />

      <form
        className="w-full rounded-xl border border-[var(--rule)] bg-white"
        onSubmit={handleSubmit}
      >
        {tab === "general" ? (
          <section className="px-6 pt-5 pb-2">
            <SectionHeading
              title="Default visibility"
              description="Pre-selects visibility when someone creates a new organisational folder. Creators can still change it before saving unless a parent folder restricts options."
            />
            <SettingRow
              label="New folders"
              help="Default audience for folders created in the organisational library."
              top
            >
              <div className="space-y-2">
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
                {visibilityMode === "restricted" ? (
                  <p className="text-xs text-amber-700">
                    Restricted defaults that need departments, grades, or employees still require a
                    selection when the folder is created.
                  </p>
                ) : null}
              </div>
            </SettingRow>
          </section>
        ) : null}

        {tab === "company_owned" ? (
          <section className="px-6 pt-5 pb-2">
            <SectionHeading
              title="Company-owned access"
              description="Users who can see folders and files marked company owned, in addition to the uploader and administrators. Document and platform administrators always retain access."
            />
            <SettingRow label="Search users" help="Filter the list of eligible approvers and admins.">
              <input
                value={delegateSearch}
                onChange={(event) => setDelegateSearch(event.target.value)}
                placeholder="Search by name or email…"
                className="field max-w-md"
              />
            </SettingRow>
            <SettingRow
              label="Delegates"
              help="Selected users can access company-owned organisational content."
              top
            >
              <div className="space-y-3">
                <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                  {filteredDelegates.map((person) => (
                    <label
                      key={person.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--rule)] bg-white px-3 py-2 text-sm hover:bg-pink-50/50"
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
                        <span className="block truncate font-medium text-slate-800">
                          {person.name}
                        </span>
                        {person.email ? (
                          <span className="block truncate text-xs text-slate-400">
                            {person.email}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500">{delegateIds.length} user(s) selected.</p>
              </div>
            </SettingRow>
          </section>
        ) : null}

        {tab === "approvals" ? (
          <section className="px-6 pt-5 pb-2">
            <SectionHeading
              title="Approval workflow"
              description="SLA, reminders, escalation, and temporary delegation for gated folder and document actions."
            />
            <SettingRow
              label="SLA"
              help="Hours before a pending organisational approval is considered overdue."
            >
              <HoursInput
                value={values.org_approval_sla_hours ?? 48}
                min={1}
                onChange={(hours) =>
                  onChange({ org_approval_sla_hours: hours > 0 ? hours : 48 })
                }
              />
            </SettingRow>
            <SettingRow
              label="Reminder"
              help="Send a reminder this many hours before the SLA due time."
            >
              <HoursInput
                value={values.org_approval_reminder_hours_before_sla ?? 6}
                onChange={(hours) =>
                  onChange({
                    org_approval_reminder_hours_before_sla: Math.max(0, hours),
                  })
                }
              />
            </SettingRow>
            <SettingRow
              label="Escalation"
              help="User notified when SLA is breached. Leave default to use the platform error escalation contact."
            >
              <ThemedSelect
                className="field max-w-md"
                ariaLabel="Escalation approver"
                value={
                  values.org_approval_escalation_user_id
                    ? String(values.org_approval_escalation_user_id)
                    : "__unset__"
                }
                onChange={(next) =>
                  onChange({
                    org_approval_escalation_user_id:
                      next && next !== "__unset__" ? Number(next) : false,
                  })
                }
                options={[
                  { value: "__unset__", label: "Default (error escalation user)" },
                  ...approverSelectOptions,
                ]}
              />
            </SettingRow>
            <SettingRow
              label="Delegate"
              help="Temporarily route approvals to another user (optional)."
            >
              <ThemedSelect
                className="field max-w-md"
                ariaLabel="Delegate approver"
                value={
                  values.org_approval_delegate_user_id
                    ? String(values.org_approval_delegate_user_id)
                    : "__unset__"
                }
                onChange={(next) =>
                  onChange({
                    org_approval_delegate_user_id:
                      next && next !== "__unset__" ? Number(next) : false,
                  })
                }
                options={[{ value: "__unset__", label: "None" }, ...approverSelectOptions]}
              />
            </SettingRow>
            <SettingRow
              label="Delegate until"
              help="Delegation ends automatically after this date and time."
            >
              <input
                type="datetime-local"
                className="field max-w-md"
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
            </SettingRow>
          </section>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-[var(--rule)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Applies to this company only.</p>
          <button type="submit" disabled={saving} className="app-btn app-btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
