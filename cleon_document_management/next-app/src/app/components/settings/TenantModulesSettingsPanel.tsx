"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyTenantModuleToggle,
  disableBlockedReason,
  TENANT_MODULE_DEFINITIONS,
  type TenantModuleDefinition,
  type TenantModuleKey,
} from "../../../../lib/tenantModuleCatalog";
import { useSaveTenantModules, useTenantModules } from "../../../../hooks/useTenantModules";
import { useToast } from "../../../../hooks/useToast";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { PinkSwitch } from "../PinkSwitch";
import { Button } from "@/components/ui/button";

const ENABLED_MODULES_HELP =
  "Decide what appears in the menu. Home and My Workspace are always there. Switching a module off hides it and stops new activity — your data stays put. Turning one on may enable another module it depends on.";

function moduleHelpText(def: TenantModuleDefinition): string {
  const prereq =
    def.requires?.length || def.requiresAny?.length
      ? [
          ...(def.requires ?? []).map(
            (k) => TENANT_MODULE_DEFINITIONS.find((d) => d.key === k)?.label ?? k,
          ),
          ...(def.requiresAny?.length
            ? [
                `Requires one of: ${def.requiresAny
                  .map((k) => TENANT_MODULE_DEFINITIONS.find((d) => d.key === k)?.label ?? k)
                  .join(", ")}`,
              ]
            : []),
        ].join(". ")
      : "";
  return prereq ? `${def.description} ${prereq}` : def.description;
}

export default function TenantModulesSettingsPanel() {
  const { modules: loaded, isLoading } = useTenantModules();
  const saveModules = useSaveTenantModules();
  const { showToast } = useToast();
  const [draft, setDraft] = useState(loaded);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(loaded);
  }, [loaded]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded);

  const toggle = (key: TenantModuleKey, enabled: boolean) => {
    if (!enabled) {
      const block = disableBlockedReason(draft, key);
      if (block) {
        showToast(block, "error");
        return;
      }
    }
    const { modules, notes } = applyTenantModuleToggle(draft, key, enabled);
    setDraft(modules);
    for (const note of notes) {
      showToast(note);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveModules(draft);
      for (const note of result.notes) {
        showToast(note);
      }
      showToast("Module settings saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save modules.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <SettingsFieldHelp label="Enabled modules" text={ENABLED_MODULES_HELP} />
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving || isLoading}
          onClick={() => void save()}
        >
          {saving ? (
            <LoaderCircle data-icon="inline-start" className="h-4 w-4 animate-spin" />
          ) : null}
          Save modules
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Loading module settings…</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {TENANT_MODULE_DEFINITIONS.map((def) => {
            const enabled = draft[def.key];
            return (
              <li
                key={def.key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-900">{def.label}</p>
                  <SettingsFieldHelp label={def.label} text={moduleHelpText(def)} />
                </div>
                <PinkSwitch
                  checked={enabled}
                  label={`${enabled ? "Disable" : "Enable"} ${def.label}`}
                  onCheckedChange={(checked) => toggle(def.key, checked)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
