import { rpc } from "./api";

export type AutomationLibrary = "organizational" | "employee";

export function documentAutomations(
  library: AutomationLibrary,
  payload: Record<string, unknown>,
) {
  const path =
    library === "employee"
      ? "/api/employee-files/automations"
      : "/api/organizational/automations";
  return rpc<{ success: boolean; message?: string; data?: Record<string, unknown> }>(
    path,
    payload,
  );
}
