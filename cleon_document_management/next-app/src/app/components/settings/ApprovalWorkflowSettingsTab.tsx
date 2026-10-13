"use client";

import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dmsContractsApi,
  type ApprovalWorkflowExceptionRow,
  type ApprovalWorkflowSettings,
} from "../../../../lib/dmsContractsApi";
import { useToast } from "../../../../hooks/useToast";
import AppSelect from "../AppSelect";
import CheckboxDropdown from "../CheckboxDropdown";
import { PinkSwitchRow } from "../PinkSwitch";
import { Button } from "@/components/ui/button";

const APPROVER_MODE_OPTIONS = [
  { value: "line_manager", label: "The person's line manager" },
  { value: "folder_owner", label: "Folder owner" },
  { value: "role", label: "A specific role" },
  { value: "specific_users", label: "Specific people" },
];

const FALLBACK_MODE_OPTIONS = [
  { value: "default_hr_admin", label: "HR Admin (default)" },
  { value: "role", label: "A specific role" },
  { value: "specific_users", label: "Specific people" },
];

const WORKING_DAY_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const value = String(index + 1);
  const label =
    value === "2" ? "2 working days (default)" : `${value} working day${index ? "s" : ""}`;
  return { value, label };
});

type ExceptionDraft = ApprovalWorkflowExceptionRow & { clientKey: string };

function newExceptionKey() {
  return `exc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSavePayload(
  settings: ApprovalWorkflowSettings,
  exceptions: ExceptionDraft[],
) {
  return {
    require_approval: settings.require_approval,
    default_approver_mode: settings.default_approver_mode,
    default_role_id: settings.default_role_id || false,
    default_user_ids: settings.default_user_ids || [],
    respond_working_days: settings.respond_working_days,
    fallback_mode: settings.fallback_mode,
    fallback_role_id: settings.fallback_role_id || false,
    fallback_user_ids: settings.fallback_user_ids || [],
    exceptions: exceptions.map((row) => ({
      scope: row.scope,
      folder_id: row.folder_id || false,
      category_id: row.category_id || false,
      approver_mode: row.approver_mode,
      role_id: row.role_id || false,
      user_ids: row.user_ids || [],
    })),
  };
}

export default function ApprovalWorkflowSettingsTab() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ApprovalWorkflowSettings | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    dmsContractsApi.settingsRead().then((result) => {
      if (!result.success) {
        setLoading(false);
        return;
      }
      const wf = result.data.approval_workflow as ApprovalWorkflowSettings;
      setSettings(wf);
      setExceptions(
        (wf.exceptions || []).map((row) => ({
          ...row,
          clientKey: String(row.id || newExceptionKey()),
        })),
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const result = await dmsContractsApi.approvalWorkflowSave(
      buildSavePayload(settings, exceptions),
    );
    setSaving(false);
    if (result.success) {
      showToast("Approval workflow saved.");
      if (result.data) {
        setSettings(result.data);
        setExceptions(
          (result.data.exceptions || []).map((row) => ({
            ...row,
            clientKey: String(row.id || newExceptionKey()),
          })),
        );
      }
    } else {
      showToast(result.message || "Could not save changes.", "error");
    }
  };

  const updateSettings = (patch: Partial<ApprovalWorkflowSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const updateExceptions = (
    updater: (current: ExceptionDraft[]) => ExceptionDraft[],
  ) => {
    setExceptions(updater);
  };

  const roleOptions = useMemo(() => {
    const seen = new Set<number>();
    const options: { value: string; label: string }[] = [];
    for (const role of settings?.options?.roles || []) {
      if (seen.has(role.id)) continue;
      seen.add(role.id);
      options.push({ value: String(role.id), label: role.name });
    }
    return options;
  }, [settings]);

  const userOptions = useMemo(
    () =>
      (settings?.options?.users || []).map((user) => ({
        value: String(user.id),
        label: user.name,
        description: user.email,
      })),
    [settings],
  );

  const folderOptions = useMemo(
    () =>
      (settings?.options?.folders || []).map((folder) => ({
        value: String(folder.id),
        label: folder.name,
      })),
    [settings],
  );

  const categoryOptions = useMemo(
    () =>
      (settings?.options?.categories || []).map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [settings],
  );

  const addException = () => {
    updateExceptions((current) => [
      ...current,
      {
        clientKey: newExceptionKey(),
        id: 0,
        scope: "folder",
        folder_id: folderOptions[0] ? Number(folderOptions[0].value) : false,
        category_id: false,
        approver_mode: "folder_owner",
        role_id: false,
        user_ids: [],
        applies_to_label: "",
        who_approves_label: "",
      },
    ]);
  };

  if (loading || !settings) {
    return <p className="text-sm text-slate-500">Loading approval workflow…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <PinkSwitchRow
            label="Require approval"
            description="Uploads, edits, version replacements, moves, deletes, and new folders by people who do not have permission to act without approval wait for an approver."
            checked={settings.require_approval}
            disabled={saving}
            onCheckedChange={(checked) => updateSettings({ require_approval: checked })}
          />

          {!settings.require_approval ? (
            <div className="mt-10 flex flex-col items-center px-4 pb-6 text-center">
              <span
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </span>
              <p className="text-base font-semibold text-slate-900">Approval is off</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Everyone with permission to do something can do it straight away. Turn
                approval on if some people&apos;s changes should be checked first.
              </p>
              <Link
                href="/pages/settings?section=onboarding&guide=approval-workflow"
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Learn how it works
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-5 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                Who may act without approval is configured in{" "}
                <Link
                  href="/pages/settings?section=users_roles"
                  className="font-semibold text-primary hover:underline"
                >
                  Users &amp; Roles
                </Link>
                .
              </p>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-800">Who approves?</span>
                <AppSelect
                  value={settings.default_approver_mode}
                  onChange={(value) =>
                    updateSettings({ default_approver_mode: value })
                  }
                  options={APPROVER_MODE_OPTIONS}
                  ariaLabel="Who approves"
                />
                <span className="text-xs text-muted-foreground">
                  Line manager, folder owner, role (e.g. HR Manager), or specific people.
                  The requester is skipped if they would be an approver.
                </span>
              </label>

              {settings.default_approver_mode === "role" ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-800">Role</span>
                  <AppSelect
                    value={settings.default_role_id ? String(settings.default_role_id) : ""}
                    onChange={(value) =>
                      updateSettings({ default_role_id: value ? Number(value) : false })
                    }
                    options={roleOptions}
                    ariaLabel="Approver role"
                  />
                </label>
              ) : null}

              {settings.default_approver_mode === "specific_users" ? (
                <CheckboxDropdown
                  label="Specific people"
                  placeholder="Select approvers"
                  options={userOptions}
                  values={(settings.default_user_ids || []).map(String)}
                  onChange={(values) =>
                    updateSettings({
                      default_user_ids: values.map((value) => Number(value)),
                    })
                  }
                  emptyLabel="No users available"
                />
              ) : null}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-800">How long do they have?</span>
                <AppSelect
                  value={String(settings.respond_working_days || 2)}
                  onChange={(value) =>
                    updateSettings({ respond_working_days: Number(value) })
                  }
                  options={WORKING_DAY_OPTIONS}
                  ariaLabel="Working days to respond"
                />
                <span className="text-xs text-muted-foreground">
                  Working days (Mon–Fri). A reminder is sent automatically halfway through.
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-800">
                  If they do not respond, send to (optional)
                </span>
                <AppSelect
                  value={settings.fallback_mode}
                  onChange={(value) => updateSettings({ fallback_mode: value })}
                  options={FALLBACK_MODE_OPTIONS}
                  ariaLabel="Fallback approver"
                />
                <span className="text-xs text-muted-foreground">
                  Receives overdue requests or when no primary approver is found. Defaults
                  to HR Admin when left empty.
                </span>
              </label>

              {settings.fallback_mode === "role" ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-800">Fallback role</span>
                  <AppSelect
                    value={
                      settings.fallback_role_id ? String(settings.fallback_role_id) : ""
                    }
                    onChange={(value) =>
                      updateSettings({
                        fallback_role_id: value ? Number(value) : false,
                      })
                    }
                    options={roleOptions}
                    ariaLabel="Fallback role"
                  />
                </label>
              ) : null}

              {settings.fallback_mode === "specific_users" ? (
                <CheckboxDropdown
                  label="Fallback people"
                  placeholder="Select fallback approvers"
                  options={userOptions}
                  values={(settings.fallback_user_ids || []).map(String)}
                  onChange={(values) =>
                    updateSettings({
                      fallback_user_ids: values.map((value) => Number(value)),
                    })
                  }
                  emptyLabel="No users available"
                />
              ) : null}
            </div>
          )}
        </section>

        {settings.require_approval ? (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Exceptions</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Override the default rule for a folder (including subfolders) or document
              category. Most specific match wins: folder, then category, then default.
            </p>

            {exceptions.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">Applies to</th>
                      <th className="p-2 font-medium">Who approves</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.map((row) => (
                      <tr key={row.clientKey} className="border-t border-border align-top">
                        <td className="p-2 space-y-2">
                          <AppSelect
                            value={row.scope}
                            onChange={(value) =>
                              updateExceptions((current) =>
                                current.map((item) =>
                                  item.clientKey === row.clientKey
                                    ? {
                                        ...item,
                                        scope: value as "folder" | "category",
                                        folder_id:
                                          value === "folder" ? item.folder_id : false,
                                        category_id:
                                          value === "category" ? item.category_id : false,
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={[
                              { value: "folder", label: "Folder" },
                              { value: "category", label: "Category" },
                            ]}
                            ariaLabel="Exception scope"
                          />
                          {row.scope === "folder" ? (
                            <AppSelect
                              value={row.folder_id ? String(row.folder_id) : ""}
                              onChange={(value) =>
                                updateExceptions((current) =>
                                  current.map((item) =>
                                    item.clientKey === row.clientKey
                                      ? {
                                          ...item,
                                          folder_id: value ? Number(value) : false,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={folderOptions}
                              ariaLabel="Folder"
                            />
                          ) : (
                            <AppSelect
                              value={row.category_id ? String(row.category_id) : ""}
                              onChange={(value) =>
                                updateExceptions((current) =>
                                  current.map((item) =>
                                    item.clientKey === row.clientKey
                                      ? {
                                          ...item,
                                          category_id: value ? Number(value) : false,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={categoryOptions}
                              ariaLabel="Category"
                            />
                          )}
                        </td>
                        <td className="p-2 space-y-2">
                          <AppSelect
                            value={row.approver_mode}
                            onChange={(value) =>
                              updateExceptions((current) =>
                                current.map((item) =>
                                  item.clientKey === row.clientKey
                                    ? { ...item, approver_mode: value }
                                    : item,
                                ),
                              )
                            }
                            options={APPROVER_MODE_OPTIONS}
                            ariaLabel="Exception approver"
                          />
                          {row.approver_mode === "role" ? (
                            <AppSelect
                              value={row.role_id ? String(row.role_id) : ""}
                              onChange={(value) =>
                                updateExceptions((current) =>
                                  current.map((item) =>
                                    item.clientKey === row.clientKey
                                      ? {
                                          ...item,
                                          role_id: value ? Number(value) : false,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={roleOptions}
                              ariaLabel="Exception role"
                            />
                          ) : null}
                          {row.approver_mode === "specific_users" ? (
                            <CheckboxDropdown
                              label=""
                              placeholder="People"
                              options={userOptions}
                              values={(row.user_ids || []).map(String)}
                              onChange={(values) =>
                                updateExceptions((current) =>
                                  current.map((item) =>
                                    item.clientKey === row.clientKey
                                      ? {
                                          ...item,
                                          user_ids: values.map((value) => Number(value)),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              emptyLabel="No users"
                            />
                          ) : null}
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() =>
                              updateExceptions((current) =>
                                current.filter((item) => item.clientKey !== row.clientKey),
                              )
                            }
                            aria-label="Remove exception"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No exceptions yet.</p>
            )}

            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={addException}
              disabled={saving || (!folderOptions.length && !categoryOptions.length)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add exception
            </Button>
          </section>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-border pt-6">
        <Button type="button" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
