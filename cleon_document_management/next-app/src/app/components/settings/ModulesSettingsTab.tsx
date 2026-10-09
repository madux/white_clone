"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import EmployeeFilesSettingsPanel from "../EmployeeFilesSettingsPanel";
import OrganizationalFilesModuleSettings from "./OrganizationalFilesModuleSettings";
import { useToast } from "../../../../hooks/useToast";

export default function ModulesSettingsTab() {
  const { showToast } = useToast();
  const [index, setIndex] = useState<Record<string, number> | null>(null);

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
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Search index (Document Registry)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Global search and registry metadata across modules.
            </p>
          </div>
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

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Employee Files</h3>
          <p className="mt-1 text-xs text-slate-500">
            Folders, dimensions, exclusions, and module-specific options.
          </p>
        </div>
        <EmployeeFilesSettingsPanel hideGlobalUploadRules />
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-8">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Organisational Files</h3>
          <p className="mt-1 text-xs text-slate-500">
            Library defaults, company-owned access, and approval SLAs.
          </p>
        </div>
        <OrganizationalFilesModuleSettings />
      </section>
    </div>
  );
}
