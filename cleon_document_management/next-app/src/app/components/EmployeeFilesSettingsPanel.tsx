"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  useEmployeeFilesConfig,
  useSaveEmployeeFilesConfig,
  useSaveEmployeeFilesHeaderFields,
} from "../../../hooks/useEmployeeFiles";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";
import UiSwitch from "./UiSwitch";
import { useToast } from "../../../hooks/useToast";
import type { EmployeeFilesConfig } from "../../../lib/types";
import EmployeeFilesCustomGroupsSettings from "./EmployeeFilesCustomGroupsSettings";
import EmployeeFilesExclusionsSettings from "./EmployeeFilesExclusionsSettings";
import EmployeeFilesOrganizingDimensionsSettings, {
  SettingsFieldHelp,
} from "./EmployeeFilesOrganizingDimensionsSettings";
import EmployeeFilesHeaderFieldsSettings from "./EmployeeFilesHeaderFieldsSettings";
import { normalizeHeaderFieldKeys } from "../../../lib/employeeFileHeaderFields";
import {
  ALLOWED_FILE_TYPE_CATALOG,
  parseAllowedFileTypes,
  serializeAllowedFileTypes,
} from "../../../lib/employeeFileDimensions";

type SettingsTab =
  | "general"
  | "employee_information"
  | "custom_groups"
  | "excluded_employees";

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-1 text-base font-semibold tracking-tight text-[var(--ink)]">
      {title}
    </h2>
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

type EmployeeFilesSettingsPanelProps = {
  /** When true, upload rules are edited under Settings → Files & Uploads only. */
  hideGlobalUploadRules?: boolean;
};

export default function EmployeeFilesSettingsPanel({
  hideGlobalUploadRules = false,
}: EmployeeFilesSettingsPanelProps) {
  const config = useEmployeeFilesConfig();
  const save = useSaveEmployeeFilesConfig();
  const saveHeaderFields = useSaveEmployeeFilesHeaderFields();
  const { showToast } = useToast();
  const [values, setValues] = useState<Partial<EmployeeFilesConfig>>({});
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    if (!config.data) return;
    setValues({
      ...config.data,
      header_field_keys: normalizeHeaderFieldKeys(config.data.header_field_keys),
    });
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

  const onSaveHeaderFields = async () => {
    const keys = normalizeHeaderFieldKeys(values.header_field_keys);
    try {
      const data = await saveHeaderFields.mutateAsync(keys);
      setValues((current) => ({
        ...current,
        ...data,
        header_field_keys: normalizeHeaderFieldKeys(data.header_field_keys),
      }));
      showToast("Employee file header fields saved.");
    } catch (error: any) {
      showToast(
        error?.message || "Unable to save header fields. Document manager access is required.",
        "error",
      );
    }
  };

  const allowedTypes = parseAllowedFileTypes(String(values.allowed_file_types || ""));

  if (config.isLoading) {
    return <p className="text-sm text-slate-500">Loading Employee Files settings…</p>;
  }

  return (
    <div className="space-y-6">
      <SectionTabs
        level="nested"
        ariaLabel="Employee Files settings"
        value={tab}
        onChange={setTab}
        items={[
          { id: "general", label: "General" },
          { id: "employee_information", label: "Employee information" },
          { id: "excluded_employees", label: "Excluded employees" },
          { id: "custom_groups", label: "Custom groups" },
        ]}
      />

      {tab === "employee_information" ? (
        <div className="space-y-4">
          <EmployeeFilesHeaderFieldsSettings
            available={
              values.available_header_fields ??
              config.data?.available_header_fields ??
              []
            }
            selectedKeys={normalizeHeaderFieldKeys(
              values.header_field_keys ?? config.data?.header_field_keys,
            )}
            onChange={(keys) => update("header_field_keys", keys)}
          />
          <button
            type="button"
            onClick={() => void onSaveHeaderFields()}
            disabled={saveHeaderFields.isPending}
            className="rounded-xl bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            {saveHeaderFields.isPending ? "Saving…" : "Save header fields"}
          </button>
        </div>
      ) : null}

      {tab === "excluded_employees" ? <EmployeeFilesExclusionsSettings /> : null}

      {tab === "custom_groups" ? (
        <EmployeeFilesCustomGroupsSettings
          enabled={Boolean(values.enable_custom_groups ?? config.data?.enable_custom_groups)}
        />
      ) : null}

      {tab === "general" ? (
        <form
          className="w-full rounded-xl border border-[var(--rule)] bg-white"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          {config.data?.setup_complete ? (
            <section className="px-6 pt-5 pb-2">
              <SectionHeading title="Organizing dimensions" />
              <EmployeeFilesOrganizingDimensionsSettings
                organizingDimensions={values.organizing_dimensions ?? []}
                subOrganizingDimension={values.sub_organizing_dimension ?? "none"}
                onOrganizingDimensionsChange={(dimensions) =>
                  update("organizing_dimensions", dimensions)
                }
                onSubOrganizingDimensionChange={(value) =>
                  update("sub_organizing_dimension", value)
                }
              />
            </section>
          ) : null}

          <section className="px-6 pt-5 pb-2">
            <SectionHeading title="People" />
            <SettingRow
              label="Inactive employees"
              help="Keep folders for people who have left."
            >
              <div className="flex justify-end">
                <UiSwitch
                  checked={Boolean(values.include_inactive)}
                  label="Inactive employees"
                  onChange={() => update("include_inactive", !values.include_inactive)}
                />
              </div>
            </SettingRow>
            <SettingRow
              label="Custom groups"
              help="Folders you create that are not from EMS."
            >
              <div className="flex justify-end">
                <UiSwitch
                  checked={Boolean(values.enable_custom_groups)}
                  label="Custom groups"
                  onChange={() =>
                    update("enable_custom_groups", !values.enable_custom_groups)
                  }
                />
              </div>
            </SettingRow>
            <SettingRow
              label="E-signature"
              help="Let people sign documents in Employee Files."
            >
              <div className="flex justify-end">
                <UiSwitch
                  checked={Boolean(values.enable_esign)}
                  label="E-signature"
                  onChange={() => update("enable_esign", !values.enable_esign)}
                />
              </div>
            </SettingRow>
          </section>

          {!hideGlobalUploadRules ? (
            <section className="px-6 pt-5 pb-2">
              <SectionHeading title="Uploads" />
              <SettingRow
                label="Duplicates"
                help="What happens if a similar file already exists."
              >
                <ThemedSelect
                  value={String(values.duplicate_detection_mode || "warn")}
                  onChange={(value) => update("duplicate_detection_mode", value)}
                  ariaLabel="Duplicates"
                  className="field"
                  options={[
                    { value: "warn", label: "Warn" },
                    { value: "prevent", label: "Block" },
                    { value: "allow_confirm", label: "Ask first" },
                  ]}
                />
              </SettingRow>
              <SettingRow
                label="Max size"
                help="Largest file that can be uploaded."
              >
                <div className="flex max-w-[160px] overflow-hidden rounded-lg border border-[var(--rule)] bg-white">
                  <input
                    type="number"
                    min={1}
                    className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
                    value={Number(values.max_file_size_mb || 25)}
                    onChange={(event) =>
                      update("max_file_size_mb", Number(event.target.value))
                    }
                  />
                  <span className="bg-[#f4f2f6] px-3 py-2 text-xs font-semibold text-slate-600">
                    MB
                  </span>
                </div>
              </SettingRow>
              <SettingRow
                label="Folder names"
                help="Show the full name or the code."
              >
                <ThemedSelect
                  value={String(values.group_name_display || "name")}
                  onChange={(value) => update("group_name_display", value)}
                  ariaLabel="Folder names"
                  className="field"
                  options={[
                    { value: "name", label: "Full name" },
                    { value: "code", label: "Code" },
                  ]}
                />
              </SettingRow>
              <SettingRow
                label="File types"
                help="Formats that can be uploaded."
                top
              >
                <div className="flex flex-wrap gap-2">
                  {ALLOWED_FILE_TYPE_CATALOG.map((type) => {
                    const on = allowedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? allowedTypes.filter((item) => item !== type)
                            : [...allowedTypes, type];
                          update(
                            "allowed_file_types",
                            serializeAllowedFileTypes(next),
                          );
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
                          on
                            ? "border-brand-pink bg-pink-50 text-brand-text"
                            : "border-[var(--rule)] bg-white text-slate-600"
                        }`}
                      >
                        {type.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </SettingRow>
            </section>
          ) : (
            <section className="px-6 pt-5 pb-2">
              <SectionHeading title="Display" />
              <SettingRow
                label="Folder names"
                help="Show the full name or the code."
              >
                <ThemedSelect
                  value={String(values.group_name_display || "name")}
                  onChange={(value) => update("group_name_display", value)}
                  ariaLabel="Folder names"
                  className="field"
                  options={[
                    { value: "name", label: "Full name" },
                    { value: "code", label: "Code" },
                  ]}
                />
              </SettingRow>
              <p className="mt-2 text-xs text-slate-500">
                Global upload size, file types, and duplicate handling are under{" "}
                <span className="font-semibold">Files &amp; Uploads</span>.
              </p>
            </section>
          )}

          <details className="mx-6 mb-4 border-t border-[var(--rule)] pt-3.5">
            <summary className="cursor-pointer text-[13px] font-semibold text-slate-500">
              Advanced
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">
                  Max issue retries
                </p>
                <input
                  type="number"
                  className="field w-full"
                  value={Number(values.max_issue_retry_attempts || 3)}
                  onChange={(event) =>
                    update("max_issue_retry_attempts", Number(event.target.value))
                  }
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">
                  Category action matrix
                </p>
                <textarea
                  className="field min-h-[90px] w-full font-mono text-xs"
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
                <p className="mb-1.5 text-xs font-semibold text-slate-500">
                  Integration mapping
                </p>
                <textarea
                  className="field min-h-[90px] w-full font-mono text-xs"
                  value={String(values.integration_mapping_json || "{}")}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      integration_mapping_json: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </details>

          <div className="flex items-center border-t border-[var(--rule)] px-6 py-4">
            <button
              type="submit"
              disabled={save.isPending}
              className="app-btn app-btn-primary"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
