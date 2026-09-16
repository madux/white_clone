"use client";

import { useEffect, useState } from "react";
import {
  useEmployeeFilesConfig,
  useSaveEmployeeFilesConfig,
} from "../../../hooks/useEmployeeFiles";
import ThemedSelect from "./ThemedSelect";
import { useToast } from "../../../hooks/useToast";
import type { EmployeeFilesConfig } from "../../../lib/types";
import SectionTabs from "./SectionTabs";
import EmployeeFilesCustomGroupsSettings from "./EmployeeFilesCustomGroupsSettings";
import EmployeeFilesExclusionsSettings from "./EmployeeFilesExclusionsSettings";

type SettingsTab = "general" | "custom_groups" | "excluded_employees";

export default function EmployeeFilesSettingsPanel() {
  const config = useEmployeeFilesConfig();
  const save = useSaveEmployeeFilesConfig();
  const { showToast } = useToast();
  const [values, setValues] = useState<Partial<EmployeeFilesConfig>>({});
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    if (config.data) setValues(config.data);
  }, [config.data]);

  const update = (key: keyof EmployeeFilesConfig, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const onSave = async () => {
    try {
      await save.mutateAsync(values);
      showToast("Employee Files settings saved.");
    } catch (error: any) {
      showToast(error?.message || "Unable to save Employee Files settings.", "error");
    }
  };

  if (config.isLoading) {
    return <p className="text-sm text-slate-500">Loading Employee Files settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Employee Files (v3)</h3>
        <p className="text-sm text-slate-500">
          Grouping, upload rules, notifications, and error handling for the EMS-driven Employee Files module.
        </p>
      </div>

      <SectionTabs
        ariaLabel="Employee Files settings"
        value={tab}
        onChange={(value) => setTab(value as SettingsTab)}
        items={[
          { id: "general", label: "General" },
          { id: "excluded_employees", label: "Excluded employees" },
          { id: "custom_groups", label: "Custom groups" },
        ]}
      />

      {tab === "excluded_employees" ? <EmployeeFilesExclusionsSettings /> : null}

      {tab === "custom_groups" ? (
        <EmployeeFilesCustomGroupsSettings
          enabled={Boolean(values.enable_custom_groups ?? config.data?.enable_custom_groups)}
        />
      ) : null}

      {tab === "general" ? (
      <>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values.include_inactive)}
            onChange={(event) => update("include_inactive", event.target.checked)}
          />
          Include inactive employees in sync
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values.exclude_test_employees)}
            onChange={(event) => update("exclude_test_employees", event.target.checked)}
          />
          Exclude test employees
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values.enable_custom_groups)}
            onChange={(event) => update("enable_custom_groups", event.target.checked)}
          />
          Enable custom groups
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(values.enable_esign)}
            onChange={(event) => update("enable_esign", event.target.checked)}
          />
          Enable e-signature entry (EF-F8)
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-400">Duplicate detection</p>
          <ThemedSelect
            value={String(values.duplicate_detection_mode || "warn")}
            onChange={(value) => update("duplicate_detection_mode", value)}
            options={[
              { value: "warn", label: "Warn user" },
              { value: "prevent", label: "Prevent duplicate" },
              { value: "allow_confirm", label: "Allow with confirmation" },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-400">Group name display</p>
          <ThemedSelect
            value={String(values.group_name_display || "name")}
            onChange={(value) => update("group_name_display", value)}
            options={[
              { value: "name", label: "Full name" },
              { value: "code", label: "Code" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-400">Max file size (MB)</p>
          <input
            type="number"
            className="field w-full"
            value={Number(values.max_file_size_mb || 25)}
            onChange={(event) => update("max_file_size_mb", Number(event.target.value))}
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-slate-400">Max issue retries</p>
          <input
            type="number"
            className="field w-full"
            value={Number(values.max_issue_retry_attempts || 3)}
            onChange={(event) =>
              update("max_issue_retry_attempts", Number(event.target.value))
            }
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Allowed file types</p>
        <input
          className="field w-full"
          value={String(values.allowed_file_types || "")}
          onChange={(event) => update("allowed_file_types", event.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">
          Category action matrix (JSON, EF-F5)
        </p>
        <textarea
          className="field min-h-[120px] w-full font-mono text-xs"
          value={String(values.category_action_matrix_json || "{}")}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              category_action_matrix_json: event.target.value,
            }))
          }
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">
          Integration mapping (JSON, EF-F7)
        </p>
        <textarea
          className="field min-h-[120px] w-full font-mono text-xs"
          value={String(values.integration_mapping_json || "{}")}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              integration_mapping_json: event.target.value,
            }))
          }
        />
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={save.isPending}
        className="rounded-xl bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
      >
        {save.isPending ? "Saving…" : "Save Employee Files settings"}
      </button>
      </>
      ) : null}
    </div>
  );
}
