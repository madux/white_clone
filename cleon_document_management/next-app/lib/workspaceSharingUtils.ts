import type { DocFolder } from "./types";
import type { WorkspaceModule } from "./types";

export type ShareScopeMode = "all" | "selected" | "preset";

export const SHARE_PRESETS: { id: string; label: string; keys: string[] }[] = [
  {
    id: "personal",
    label: "Personal / self-service",
    keys: [
      "my_workspace",
      "self_service_compliance",
      "self_service_approvals",
      "self_service_reviews",
      "self_service_team",
    ],
  },
  {
    id: "documents",
    label: "Document management",
    keys: ["employee_files", "organizational_files", "templates_forms"],
  },
  {
    id: "intelligence",
    label: "Intelligence & compliance admin",
    keys: ["document_intelligence", "compliance_admin"],
  },
  {
    id: "admin",
    label: "Administration",
    keys: ["settings", "roles", "super_admin"],
  },
];

export type ScopeTreeNode = {
  id: string;
  label: string;
  moduleKey?: string;
  folderId?: number;
  documentCount?: number;
  children?: ScopeTreeNode[];
};

const MODULE_LABELS: Record<string, string> = {
  employee_files: "Employee Files",
  organizational_files: "Organisational Files",
  templates_forms: "Templates & Forms",
  my_workspace: "My Workspace",
  self_service_compliance: "My Compliance",
  self_service_approvals: "Approvals",
  self_service_reviews: "Scheduled reviews",
  self_service_team: "My Team",
  document_intelligence: "Document Intelligence",
  compliance_admin: "Compliance admin",
  settings: "Settings",
  roles: "Roles",
  super_admin: "Super Admin",
};

export function moduleLabel(key: string) {
  return MODULE_LABELS[key] || key.replace(/_/g, " ");
}

function folderNodes(
  folders: DocFolder[],
  folderType: "employee" | "organizational",
  moduleKey: string,
): ScopeTreeNode[] {
  const ofType = folders.filter((f) => f.folder_type === folderType);
  const byParent = new Map<number | "root", DocFolder[]>();
  for (const folder of ofType) {
    const parent = folder.parent_id ? Number(folder.parent_id) : "root";
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(folder);
  }
  const build = (parent: number | "root"): ScopeTreeNode[] => {
    const rows = byParent.get(parent) || [];
    return rows
      .sort((a, b) => a.folder_name.localeCompare(b.folder_name))
      .map((folder) => ({
        id: `folder-${folder.id}`,
        label: folder.folder_name,
        moduleKey,
        folderId: folder.id,
        documentCount: folder.document_count,
        children: build(folder.id),
      }));
  };
  return build("root");
}

export function buildScopeTree(
  folders: DocFolder[],
  eligibleModules: WorkspaceModule[],
): ScopeTreeNode[] {
  const eligibleKeys = new Set(eligibleModules.map((m) => m.key));
  const nodes: ScopeTreeNode[] = [];

  if (eligibleKeys.has("employee_files")) {
    const children = folderNodes(folders, "employee", "employee_files");
    nodes.push({
      id: "module-employee_files",
      label: "Employee Files",
      moduleKey: "employee_files",
      children: children.length ? children : undefined,
    });
  }
  if (eligibleKeys.has("organizational_files")) {
    const children = folderNodes(folders, "organizational", "organizational_files");
    nodes.push({
      id: "module-organizational_files",
      label: "Organisational Files",
      moduleKey: "organizational_files",
      children: children.length ? children : undefined,
    });
  }

  for (const mod of eligibleModules) {
    if (mod.key === "employee_files" || mod.key === "organizational_files") {
      continue;
    }
    nodes.push({
      id: `module-${mod.key}`,
      label: mod.name || moduleLabel(mod.key),
      moduleKey: mod.key,
    });
  }

  return nodes;
}

export function collectDescendantIds(node: ScopeTreeNode): string[] {
  const ids = [node.id];
  for (const child of node.children || []) {
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

export function findNodeById(
  nodes: ScopeTreeNode[],
  id: string,
): ScopeTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNodeById(node.children || [], id);
    if (nested) return nested;
  }
  return undefined;
}

export function moduleKeysFromSelection(
  tree: ScopeTreeNode[],
  selectedIds: Set<string>,
  eligibleKeys: Set<string>,
): string[] {
  const keys = new Set<string>();
  const visit = (node: ScopeTreeNode) => {
    if (selectedIds.has(node.id) && node.moduleKey) {
      keys.add(node.moduleKey);
    }
    for (const child of node.children || []) visit(child);
  };
  for (const node of tree) visit(node);
  return Array.from(keys).filter((k) => eligibleKeys.has(k));
}

export function selectionSummaryLines(
  tree: ScopeTreeNode[],
  selectedIds: Set<string>,
): string[] {
  const lines: string[] = [];
  const walk = (node: ScopeTreeNode, prefix: string) => {
    const path = prefix ? `${prefix} › ${node.label}` : node.label;
    if (selectedIds.has(node.id)) {
      lines.push(path);
    }
    for (const child of node.children || []) {
      walk(child, path);
    }
  };
  for (const node of tree) walk(node, "");
  return lines;
}

export function accessScopeLabel(moduleKeys: string[]) {
  if (!moduleKeys.length) return "—";
  const labels = moduleKeys.map((k) => moduleLabel(k));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function documentsFoldersSummary(
  moduleKeys: string[],
  note?: string,
) {
  const fromNote = parseScopeNote(note);
  if (fromNote?.folder_labels?.length) {
    const n = fromNote.folder_labels.length;
    return n === 1 ? fromNote.folder_labels[0] : `${n} folders`;
  }
  if (!moduleKeys.length) return "—";
  return `${moduleKeys.length} module${moduleKeys.length === 1 ? "" : "s"}`;
}

export function buildScopeNote(
  mode: ShareScopeMode,
  folderLabels: string[],
  presetLabel?: string,
) {
  const payload = {
    scope_mode: mode,
    folder_labels: folderLabels,
    preset_label: presetLabel || "",
  };
  return `scope:${JSON.stringify(payload)}`;
}

export function parseScopeNote(note?: string) {
  if (!note || !note.startsWith("scope:")) return null;
  try {
    return JSON.parse(note.slice("scope:".length)) as {
      scope_mode?: ShareScopeMode;
      folder_labels?: string[];
      preset_label?: string;
    };
  } catch {
    return null;
  }
}

/** Odoo sends naive UTC datetimes ("YYYY-MM-DD HH:MM:SS"). */
export function parseServerDatetime(value: string) {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

export function toServerDatetime(localInput: string) {
  const date = new Date(localInput);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid end date and time.");
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function toLocalInputValue(value: string) {
  if (!value) return "";
  const date = parseServerDatetime(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatUntil(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseServerDatetime(value));
}
