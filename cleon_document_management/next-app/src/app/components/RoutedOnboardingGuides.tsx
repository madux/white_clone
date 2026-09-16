"use client";

import { usePathname } from "next/navigation";
import { useEmployeeFilesConfig } from "../../../hooks/useEmployeeFiles";
import ModuleOnboardingGuide from "./ModuleOnboardingGuide";
import OnboardingModuleArmer from "./OnboardingModuleArmer";

/** Workspace / personal document areas — not Employee Files, org library, or settings. */
const WORKSPACE_PATH_PREFIXES = [
  "/pages/my-documents",
  "/pages/quick-access",
  "/pages/archived",
  "/pages/recycle-bin",
  "/pages/pending-uploads",
  "/pages/activity",
  "/pages/my-compliance",
];

function isWorkspaceRoute(pathname: string): boolean {
  return WORKSPACE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isEmployeeRoute(pathname: string): boolean {
  return pathname === "/pages/employee" || pathname.startsWith("/pages/employee/");
}

function isOrganizationalRoute(pathname: string): boolean {
  return (
    pathname === "/pages/organization" || pathname.startsWith("/pages/organization/")
  );
}

function isSettingsRoute(pathname: string): boolean {
  return pathname === "/pages/settings" || pathname.startsWith("/pages/settings/");
}

/**
 * Mount module guides only on their routes. Workspace guide is not global so it
 * does not appear during Employee Files setup or other modules.
 */
export default function RoutedOnboardingGuides() {
  const pathname = usePathname() || "";
  const employeeConfig = useEmployeeFilesConfig();

  if (isEmployeeRoute(pathname)) {
    if (employeeConfig.isLoading || !employeeConfig.data?.setup_complete) {
      return null;
    }
    return <ModuleOnboardingGuide module="employee_files" />;
  }

  if (isWorkspaceRoute(pathname)) {
    return (
      <>
        <OnboardingModuleArmer module="workspace" />
        <ModuleOnboardingGuide module="workspace" />
      </>
    );
  }

  if (isOrganizationalRoute(pathname)) {
    return (
      <>
        <OnboardingModuleArmer module="organizational" />
        <ModuleOnboardingGuide module="organizational" />
      </>
    );
  }

  if (isSettingsRoute(pathname)) {
    return (
      <>
        <OnboardingModuleArmer module="administration" />
        <ModuleOnboardingGuide module="administration" />
      </>
    );
  }

  return null;
}
