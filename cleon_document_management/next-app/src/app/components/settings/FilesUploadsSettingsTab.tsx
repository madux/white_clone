"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useEmployeeFilesConfig,
  useSaveEmployeeFilesConfig,
} from "../../../../hooks/useEmployeeFiles";
import { useToast } from "../../../../hooks/useToast";
import ThemedSelect from "../ThemedSelect";
import {
  ALLOWED_FILE_TYPE_CATALOG,
  parseAllowedFileTypes,
  serializeAllowedFileTypes,
} from "../../../../lib/employeeFileDimensions";
import type { EmployeeFilesConfig } from "../../../../lib/types";

export default function FilesUploadsSettingsTab() {
  const config = useEmployeeFilesConfig();
  const save = useSaveEmployeeFilesConfig();
  const { showToast } = useToast();
  const [values, setValues] = useState<Partial<EmployeeFilesConfig>>({});

  useEffect(() => {
    if (config.data) setValues({ ...config.data });
  }, [config.data]);

  const update = (key: keyof EmployeeFilesConfig, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const allowedTypes = parseAllowedFileTypes(String(values.allowed_file_types || ""));

  const onSave = async () => {
    try {
      await save.mutateAsync(values);
      showToast("Upload rules saved.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to save upload rules.";
      showToast(message, "error");
    }
  };

  if (config.isLoading) {
    return <p className="text-sm text-slate-500">Loading upload rules…</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-slate-600">
        These rules apply on every upload path in Document Management (Employee
        Files, Organisational Files, and shared upload flows).
      </p>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Duplicate handling
            </p>
            <ThemedSelect
              value={String(values.duplicate_detection_mode || "warn")}
              onChange={(value) => update("duplicate_detection_mode", value)}
              ariaLabel="Duplicate handling"
              className="field mt-2"
              options={[
                { value: "warn", label: "Warn" },
                { value: "prevent", label: "Block" },
                { value: "allow_confirm", label: "Ask first" },
              ]}
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Maximum file size
            </p>
            <div className="mt-2 flex max-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <input
                type="number"
                min={1}
                className="min-w-0 flex-1 border-0 px-3 py-2 text-sm outline-none"
                value={Number(values.max_file_size_mb || 25)}
                onChange={(event) =>
                  update("max_file_size_mb", Number(event.target.value))
                }
              />
              <span className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                MB
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Allowed file types
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
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
                      update("allowed_file_types", serializeAllowedFileTypes(next));
                    }}
                    className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-medium ${
                      on
                        ? "border-brand-pink bg-pink-50 text-brand-text"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Virus scan:</span>{" "}
            Required on all uploads (locked on).
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {save.isPending ? "Saving…" : "Save upload rules"}
          </button>
        </div>
      </form>
    </div>
  );
}
