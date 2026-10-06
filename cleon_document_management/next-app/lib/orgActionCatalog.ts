/** Organisational Files V2 — categorised action menus (F31 / QA-OF-05 / QA-OF-07). */
export const ORG_ACTION_MENU_CATEGORIES = {
  information: "Information",
  organise: "Organise",
  access: "Access",
  lifecycle: "Lifecycle",
} as const;

export type OrgActionMenuCategoryKey = keyof typeof ORG_ACTION_MENU_CATEGORIES;
