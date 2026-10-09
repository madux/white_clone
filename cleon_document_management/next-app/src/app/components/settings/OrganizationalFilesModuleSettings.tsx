"use client";

import { useEffect, useState } from "react";
import { useSaveSettings, useSettings } from "../../../../hooks/useDocuments";
import { useToast } from "../../../../hooks/useToast";
import OrganizationalFilesSettingsPanel from "../OrganizationalFilesSettingsPanel";

export default function OrganizationalFilesModuleSettings() {
  const query = useSettings();
  const save = useSaveSettings();
  const { showToast } = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (query.data?.settings) {
      setValues(query.data.settings as Record<string, unknown>);
    }
  }, [query.data?.settings]);

  const onSave = async () => {
    try {
      const result = await save.mutateAsync(values);
      if (result.success) {
        setValues((result.data ?? values) as Record<string, unknown>);
        showToast("Organisational Files settings saved.");
      } else {
        showToast(result.message || "Save failed.", "error");
      }
    } catch {
      showToast("Unable to save settings.", "error");
    }
  };

  if (query.isLoading) {
    return (
      <p className="text-sm text-slate-500">Loading Organisational Files settings…</p>
    );
  }

  return (
    <OrganizationalFilesSettingsPanel
      values={values}
      onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      onSave={() => void onSave()}
      saving={save.isPending}
    />
  );
}
