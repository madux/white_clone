"use client";

import { useEffect, useRef } from "react";
import { useOnboarding, useUpdateOnboarding } from "../../../hooks/useDocuments";
import { useEmployeeFilesConfig } from "../../../hooks/useEmployeeFiles";
import type { OnboardingModuleId } from "../../../lib/onboardingModules";

/** Arms a module guide once when the user enters that area (if not already completed/dismissed). */
export default function OnboardingModuleArmer({ module }: { module: OnboardingModuleId }) {
  const onboarding = useOnboarding();
  const employeeConfig = useEmployeeFilesConfig();
  const update = useUpdateOnboarding();
  const armed = useRef(false);

  useEffect(() => {
    if (armed.current || !onboarding.data) return;
    if (
      module === "employee_files" &&
      (employeeConfig.isLoading || !employeeConfig.data?.setup_complete)
    ) {
      return;
    }
    const mod = onboarding.data.modules?.[module];
    if (!mod || mod.completed || mod.dismissed || mod.pending_show || mod.show) return;
    armed.current = true;
    update.mutate({ action: "arm", module });
  }, [module, onboarding.data, employeeConfig.data?.setup_complete, employeeConfig.isLoading, update]);

  return null;
}
