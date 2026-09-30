"use client";

import { useEmployeeFilesConfig } from "../../../hooks/useEmployeeFiles";
import EmployeeFilesHome from "./EmployeeFilesHome";
import EmployeeFilesSetupWizard from "./EmployeeFilesSetupWizard";
export default function EmployeeFilesWorkspace() {
  const config = useEmployeeFilesConfig();

  if (config.isLoading) {
    return (
      <div className="app-page">
        <p className="text-sm text-slate-500">Loading Employee Files configuration…</p>
      </div>
    );
  }

  if (!config.data?.setup_complete) {
    return <EmployeeFilesSetupWizard />;
  }

  return <EmployeeFilesHome />;
}
