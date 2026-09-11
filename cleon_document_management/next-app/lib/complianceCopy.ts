export const EVENT_TRIGGER_LABELS: Record<string, string> = {
  onboarding: "New starter",
  promotion: "Promotion",
  department_transfer: "Moved department",
  location_change: "Changed work location",
  marital_status_change: "Marital status changed",
};

export function eventTriggerLabel(code: string, fallback = code) {
  return EVENT_TRIGGER_LABELS[code] || fallback;
}

export const AUDIT_FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Every month",
  quarterly: "Every 3 months",
  semi_annually: "Every 6 months",
  annually: "Once a year",
};
