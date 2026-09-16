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
    subtitle: "Types, approvals, and access defaults",
  },
};

const workspaceSteps: GuideStep[] = [
  {
    id: "workspace",
    title: "Explore your workspace",
    description:
      "See where personal files, shared documents, archives, and the recycle bin live.",
    href: "/pages/my-documents?guide=workspace",
    action: "Open My Documents",
  },
  {
    id: "upload",
    title: "Upload your first document",
    description: "Add a file, choose its document type, and keep your personal records organized.",
    href: "/pages/my-documents?guide=upload",
    action: "View My Documents",
  },
  {
    id: "approval",
    title: "Understand approvals",
    description: "Learn how a document moves from draft to review and approval when required.",
    href: "/pages/my-documents?guide=approval",
    action: "View approval status",
  },
  {
    id: "shared",
    title: "Open a shared document",
    description: "Review shared files, see who shared them, and acknowledge documents when needed.",
    href: "/pages/my-documents?guide=shared",
    action: "View shared documents",
  },
  {
    id: "search",
    title: "Use workspace search",
    description: "Find your documents from the search field on the My Documents page.",
    href: "/pages/my-documents?guide=search&tab=files",
    action: "Highlight search",
  },
];

const employeeFilesSteps: GuideStep[] = [
  {
    id: "ef-home",
    title: "Employee Files home",
    description:
      "Switch between groups, employees, and documents. Use dimension tabs to browse system-managed groups.",
    href: "/pages/employee",
    action: "Open home",
  },
  {
    id: "ef-issues",
    title: "Issues & reconciliation",
    description: "Review employees or documents that need attention after setup or EMS changes.",
    href: "/pages/employee/issues",
    action: "View issues",
  },
  {
    id: "ef-groups",
    title: "Open a group",
    description: "System-managed groups reflect EMS dimensions; custom groups are managed in Settings.",
    href: "/pages/employee",
    action: "Browse groups",
  },
  {
    id: "ef-exclusions",
    title: "Manage exclusions",
    description: "Add or remove manually excluded employees without re-running setup.",
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
    description: "Set up organizational folders for the records your team manages.",
    href: "/pages/organization?guide=folders",
    action: "Open organizational files",
  },
  {
    id: "organizational-upload",
    title: "Upload an organizational document",
    description:
      "Add a company document and confirm that the intended audience can see it in Shared Documents.",
    href: "/pages/organization?guide=organizational-upload",
    action: "Upload a document",
  },
  {
    id: "org-sharing",
    title: "Folder access",
    description: "Control who can view each folder—all staff, departments, grades, or individuals.",
    href: "/pages/settings?guide=sharing",
    action: "Review access",
  },
];

const administrationSteps: GuideStep[] = [
  {
    id: "document-types",
    title: "Create document types",
    description: "Set up the categories your organization will use when files are uploaded.",
    href: "/pages/settings?guide=document-types",
    action: "Open Settings",
  },
  {
    id: "approval-workflow",
    title: "Configure approval workflow",
    description:
      "Choose the review mode and assign approvers for employee folders. Sequential workflows follow the order you set.",
    href: "/pages/settings?guide=approval-workflow",
    action: "Configure approvals",
  },
  {
    id: "sharing",
    title: "Define sharing access",
    description:
      "Choose default access for new folders—shared with all staff, departments, grades, or specific employees.",
    href: "/pages/settings?guide=sharing",
    action: "Review access defaults",
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
