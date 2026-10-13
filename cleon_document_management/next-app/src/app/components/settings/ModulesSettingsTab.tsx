"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import EmployeeFilesSettingsPanel from "../EmployeeFilesSettingsPanel";
import OrganizationalFilesModuleSettings from "./OrganizationalFilesModuleSettings";
import TenantModulesSettingsPanel from "./TenantModulesSettingsPanel";
import SectionTabs from "../SectionTabs";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { useToast } from "../../../../hooks/useToast";
import { useTenantModules } from "../../../../hooks/useTenantModules";
import { isTenantModuleEnabled } from "../../../../lib/tenantModuleCatalog";

type ModulesSettingsSection = "modules" | "employee_files" | "organizational_files";

export default function ModulesSettingsTab() {
  const { showToast } = useToast();
  const { modules: tenantModules } = useTenantModules();
  const [index, setIndex] = useState<Record<string, number> | null>(null);
  const [section, setSection] = useState<ModulesSettingsSection>("modules");

  const showEmployee = isTenantModuleEnabled(tenantModules, "employee_files");
  const showOrg = isTenantModuleEnabled(tenantModules, "organizational_files");

  const sectionTabs = useMemo(() => {
    const items: { id: ModulesSettingsSection; label: string }[] = [
      { id: "modules", label: "Enabled modules" },
    ];
    if (showEmployee) {
      items.push({ id: "employee_files", label: "Employee Files" });
    }
    if (showOrg) {
      items.push({ id: "organizational_files", label: "Organisational Files" });
    }
    return items;
  }, [showEmployee, showOrg]);

  useEffect(() => {
    if (sectionTabs.some((tab) => tab.id === section)) return;
    setSection("modules");
  }, [section, sectionTabs]);

  const load = () => {
    dmsContractsApi.registryIndexStatus().then((result) => {
      if (result.success) setIndex(result.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const reindex = async (module?: string) => {
    const result = await dmsContractsApi.registryReindex(module);
    if (result.success) {
      showToast(`Reindexed ${result.data.synced} documents.`);
      load();
    } else {
      showToast("Reindex failed.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <SectionTabs
        items={sectionTabs}
        value={section}
        onChange={setSection}
        ariaLabel="Module settings"
      />

      {section === "modules" ? (
        <div className="space-y-6">
          <TenantModulesSettingsPanel />

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-end gap-3">
              <SettingsFieldHelp
                label="Search index"
                text="Global search and registry metadata across modules."
              />
              <button
                type="button"
                onClick={() => reindex()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reindex all
              </button>
            </div>
            {index ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-bold">{index.total_documents}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Indexed</dt>
                  <dd className="font-bold">{index.indexed}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Waiting</dt>
                  <dd className="font-bold">{index.waiting}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Indexing</dt>
                  <dd className="font-bold">{index.indexing}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Failed OCR</dt>
                  <dd className="font-bold">{index.failed}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registry synced</dt>
                  <dd className="font-bold">{index.registry_synced}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Loading index status…</p>
            )}
          </section>
        </div>
      ) : null}

      {section === "employee_files" && showEmployee ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <EmployeeFilesSettingsPanel hideGlobalUploadRules />
        </section>
      ) : null}

      {section === "organizational_files" && showOrg ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <OrganizationalFilesModuleSettings />
        </section>
      ) : null}
    </div>
  );
}
