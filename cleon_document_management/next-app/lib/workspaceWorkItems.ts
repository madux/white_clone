export type WorkspaceWorkItemUrgency = "overdue" | "due_this_week" | "later";

export type WorkspaceWorkItem = {
  id: string;
  kind: string;
  icon: string;
  title: string;
  subtitle: string;
  urgency: WorkspaceWorkItemUrgency;
  due_date?: string;
  status_label?: string;
  status_tone?: "danger" | "warning" | "neutral";
  action_label: string;
  action_variant: "primary" | "outline";
  href: string;
};

export type WorkspaceWorkItemsSummary = {
  todo_count: number;
  todo_overdue_label: string;
  documents_count: number;
  documents_expiring_label: string;
  compliance_status_label: string;
  compliance_status_detail: string;
  signatures_count: number;
  signatures_due_label: string;
};

export type WorkspaceWorkItemsPayload = {
  items: WorkspaceWorkItem[];
  total: number;
  overdue_count: number;
  profile: {
    name: string;
    job_title: string;
    department: string;
  };
  summary: WorkspaceWorkItemsSummary;
  tab_counts: {
    todo: number;
    policies: number;
  };
  source?: string;
};

export const WORK_ITEM_GROUP_LABELS: Record<
  "overdue" | "due_this_week",
  string
> = {
  overdue: "OVERDUE",
  due_this_week: "DUE THIS WEEK",
};
