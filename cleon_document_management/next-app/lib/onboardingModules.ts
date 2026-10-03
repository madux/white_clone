export type OnboardingModuleId =
  | "workspace"
  | "employee_files"
  | "organizational"
  | "administration";

export type GuideStep = {
  id: string;
  title: string;
  description: string;
  href?: string;
  action?: string;
};

export const ONBOARDING_MODULE_ORDER: OnboardingModuleId[] = [
  "workspace",
  "employee_files",
  "organizational",
  "administration",
];

export const ONBOARDING_MODULE_META: Record<
  OnboardingModuleId,
  { label: string; subtitle: string }
> = {
  workspace: {
    label: "My workspace",
    subtitle: "Personal documents, uploads, and search",
  },
  employee_files: {
    label: "Employee Files",
    subtitle: "EMS-driven files, groups, and reconciliation",
  },
  organizational: {
    label: "Organizational Files",
    subtitle: "Company library folders and publishing",
  },
  administration: {
    label: "Administration",
    subtitle: "Document types, retention, and lifecycle",
  },
};

const workspaceSteps: GuideStep[] = [
  {
    id: "workspace",
    title: "Explore your workspace",
    description:
      "See where personal files, shared documents, archives, and the recycle bin live.",
    href: "/pages/my-workspace?guide=workspace",
    action: "Open My Documents",
  },
  {
    id: "upload",
    title: "Upload your first document",
    description: "Add a file, choose its document type, and keep your personal records organized.",
    href: "/pages/my-workspace?guide=upload",
    action: "View My Documents",
  },
  {
    id: "approval",
    title: "Understand approvals",
    description: "Learn how a document moves from draft to review and approval when required.",
    href: "/pages/my-workspace?guide=approval",
    action: "View approval status",
  },
  {
    id: "shared",
    title: "Open a shared document",
    description: "Review shared files, see who shared them, and acknowledge documents when needed.",
    href: "/pages/my-workspace?guide=shared&scope=shared",
    action: "View shared documents",
  },
  {
    id: "search",
    title: "Use workspace search",
    description: "Find your documents from the search field on the My Documents page.",
    href: "/pages/my-workspace?guide=search&scope=files",
    action: "Highlight search",
  },
];

const employeeFilesSteps: GuideStep[] = [
  {
    id: "ef-home",
    title: "Employee Files home",
    description:
      "Use the nested tabs for Employee files (group tree), Employees (flat list), and Documents. Group by dimension on the Employee files tab. Search, Filters, list/card view, and column pickers work on Employees and Documents.",
    href: "/pages/employee",
    action: "Open home",
  },
  {
    id: "ef-browse",
    title: "Sort groups and members",
    description:
      "On Employee files, click column headers to sort top-level groups (name, people, files, status). Expand a leaf group and sort employees the same way as on the Employees tab—order is shared between both views.",
    href: "/pages/employee?view=groups",
    action: "Open group view",
  },
  {
    id: "ef-issues",
    title: "Issues & reconciliation",
    description:
      "Review employees with missing EMS attributes, sync failures, exclusions, and related cases. Search and filter by classification; export a CSV report when needed.",
    href: "/pages/employee?tab=issues",
    action: "View issues",
  },
  {
    id: "ef-pending-approvals",
    title: "Pending approvals",
    description:
      "Employee document uploads and inbox items awaiting approval appear under Pending approvals on the home workspace.",
    href: "/pages/employee?tab=pending-approvals",
    action: "Open queue",
  },
  {
    id: "ef-groups",
    title: "Open a group",
    description:
      "System-managed groups follow your organizing dimensions; expand the tree to see members with pagination and in-group search. Custom groups are managed in Settings.",
    href: "/pages/employee?view=groups",
    action: "Browse groups",
  },
  {
    id: "ef-exclusions",
    title: "Manage exclusions",
    description:
      "During setup you can pick EMS employees to exclude with a searchable dialog; after setup, add or remove exclusions in Settings without re-running the wizard.",
    href: "/pages/settings?section=employee_files",
    action: "Open settings",
  },
  {
    id: "ef-custom-groups",
    title: "Custom groups",
    description: "Create groups in Settings and activate them to show on the Employee Files home.",
    href: "/pages/settings?section=employee_files",
    action: "Custom groups",
  },
];

const organizationalSteps: GuideStep[] = [
  {
    id: "folders",
    title: "Create your folder structure",
    description:
      "Build folders and subfolders with visibility (who can see the folder), optional AI-assisted descriptions, and a details panel from the row menu. Child folders cannot be wider than their parent’s visibility.",
    href: "/pages/organization?guide=folders",
    action: "Open organizational files",
  },
  {
    id: "organizational-upload",
    title: "Upload and import",
    description:
      "Use + New to upload files, scan, or import from connected cloud sources. Open the document viewer for preview, versions, and optional AI summary on organizational files.",
    href: "/pages/organization?guide=organizational-upload",
    action: "Upload a document",
  },
  {
    id: "org-policy-folder",
    title: "Create policies in folders",
    description:
      "From + New in a folder, choose Create policy. Name the policy and select matching library files to move into a dedicated policy folder. Policies appear on the Organizational Files → Policies tab.",
    href: "/pages/organization",
    action: "Open library",
  },
  {
    id: "org-policy-linked",
    title: "Registered policies",
    description:
      "Classified policy documents show on the Policies tab and in their policy folder. Compliance rules for monitoring live under Employee Files → Compliance and are separate from organizational policies.",
    href: "/pages/organization?tab=policies",
    action: "View policies",
  },
  {
    id: "org-sharing",
    title: "Folder and document access",
    description:
      "Manage access from the folder or document menu: adjust visibility scope and grants without exposing raw access-scope codes in the UI.",
    href: "/pages/organization?guide=org-sharing",
    action: "Review folder access",
  },
];

const administrationSteps: GuideStep[] = [
  {
    id: "document-types",
    title: "Create document types",
    description:
      "Set up upload categories and, when needed, require approval with approvers on each type.",
    href: "/pages/settings?guide=document-types",
    action: "Open Settings",
  },
  {
    id: "approval-inbox",
    title: "Review your Approval Inbox",
    description: "Assigned documents ready for your decision appear under the inbox icon in the header.",
    href: "/pages/dashboard?guide=approval-inbox",
    action: "Highlight approval inbox",
  },
];

export const ONBOARDING_STEPS_BY_MODULE: Record<OnboardingModuleId, GuideStep[]> = {
  workspace: workspaceSteps,
  employee_files: employeeFilesSteps,
  organizational: organizationalSteps,
  administration: administrationSteps,
};

export function stepsForModule(
  moduleId: OnboardingModuleId,
  isAdmin: boolean,
): GuideStep[] {
  if (moduleId === "workspace") return workspaceSteps;
  if (moduleId === "employee_files") return employeeFilesSteps;
  if (moduleId === "organizational") return isAdmin ? organizationalSteps : [];
  if (moduleId === "administration") return isAdmin ? administrationSteps : [];
  return [];
}

export function allOnboardingStepIds(): string[] {
  return ONBOARDING_MODULE_ORDER.flatMap((moduleId) =>
    ONBOARDING_STEPS_BY_MODULE[moduleId].map((step) => step.id),
  );
}
