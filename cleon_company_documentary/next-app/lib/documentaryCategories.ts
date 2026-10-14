export const DOCUMENTARY_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "onboarding", label: "Onboarding" },
  { value: "training", label: "Training" },
  { value: "marketing", label: "Marketing" },
  { value: "hr_updates", label: "HR Updates" },
  { value: "company_events", label: "Company Events" },
  { value: "product_launches", label: "Product Launches" },
] as const;

export type DocumentaryCategory = (typeof DOCUMENTARY_CATEGORIES)[number]["value"];

export const DOCUMENTARY_STATUSES = [
  "processing",
  "processing_failed",
  "draft",
  "pending_review",
  "returned",
  "approved",
  "published",
  "archived",
  "deleted",
] as const;

export type DocumentaryStatus = (typeof DOCUMENTARY_STATUSES)[number];
