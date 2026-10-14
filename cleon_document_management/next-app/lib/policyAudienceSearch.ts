import {
  type PolicyScopeState,
  type PolicyScopeTargets,
  listEmployeesInScopeDimension,
} from "./policyScope";

export type AudienceDimensionHit = {
  key: keyof PolicyScopeState;
  id: number;
  label: string;
  dimensionLabel: string;
  memberCount: number;
  abbrev: string;
  description: string;
};

export type AudienceEmployeeHit = {
  id: number;
  name: string;
  subtitle: string;
  job_title?: string;
};

export type AudienceSearchFilterTab = "all" | "departments" | "groups" | "employees";

export type PolicyAudienceSearchResult = {
  departments: AudienceDimensionHit[];
  groups: AudienceDimensionHit[];
  people: AudienceEmployeeHit[];
  counts: {
    all: number;
    departments: number;
    groups: number;
    employees: number;
  };
};

const GROUP_DIMENSION_KEYS: (keyof PolicyScopeState)[] = [
  "grade_ids",
  "work_location_ids",
  "employment_type_ids",
  "branch_ids",
];

const DIMENSION_META: {
  key: keyof PolicyScopeState;
  label: string;
  section: "departments" | "groups";
  items: (targets?: PolicyScopeTargets) => { id: number; name: string }[];
}[] = [
  {
    key: "department_ids",
    label: "Department",
    section: "departments",
    items: (t) => t?.departments ?? [],
  },
  {
    key: "grade_ids",
    label: "Grade",
    section: "groups",
    items: (t) => t?.grades ?? [],
  },
  {
    key: "work_location_ids",
    label: "Location",
    section: "groups",
    items: (t) => t?.locations ?? [],
  },
  {
    key: "employment_type_ids",
    label: "Employment type",
    section: "groups",
    items: (t) => t?.employment_types ?? [],
  },
  {
    key: "branch_ids",
    label: "Business unit",
    section: "groups",
    items: (t) => t?.branches ?? [],
  },
];

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function queryWords(query: string) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter((word) => word.length >= 1);
}

function textMatchesQuery(text: string, query: string) {
  const q = normalizeQuery(query);
  if (!q) return true;
  const hay = text.toLowerCase();
  const words = queryWords(query);
  if (!words.length) return hay.includes(q);
  return words.every((word) => hay.includes(word));
}

function personalFieldsMatch(
  employee: NonNullable<PolicyScopeTargets["employees"]>[number],
  query: string,
) {
  const hay = [
    employee.name,
    employee.job_title,
    employee.work_email,
    employee.department,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return textMatchesQuery(hay, query);
}

export function dimensionAbbrev(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) {
    return parts[0].slice(0, 3).toUpperCase();
  }
  return parts
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dimensionDescription(
  key: keyof PolicyScopeState,
  label: string,
  memberCount: number,
) {
  if (key === "department_ids") {
    return memberCount === 1
      ? `1 employee in ${label}`
      : `${memberCount} employees in ${label}`;
  }
  const kind =
    key === "grade_ids"
      ? "grade"
      : key === "work_location_ids"
        ? "location"
        : key === "employment_type_ids"
          ? "employment type"
          : "business unit";
  return memberCount === 1
    ? `1 employee with this ${kind}`
    : `${memberCount} employees share this ${kind}`;
}

export function dimensionResultId(key: keyof PolicyScopeState, id: number) {
  return `${key}:${id}`;
}

function buildDimensionHit(
  meta: (typeof DIMENSION_META)[number],
  item: { id: number; name: string },
  targets?: PolicyScopeTargets,
): AudienceDimensionHit {
  const members = listEmployeesInScopeDimension(meta.key, item.id, targets);
  return {
    key: meta.key,
    id: item.id,
    label: item.name,
    dimensionLabel: meta.label,
    memberCount: members.length,
    abbrev: dimensionAbbrev(item.name),
    description: dimensionDescription(meta.key, item.name, members.length),
  };
}

export function searchPolicyAudience(
  query: string,
  targets?: PolicyScopeTargets,
  limit = {
    departments: 20,
    groups: 20,
    people: 40,
  },
): PolicyAudienceSearchResult {
  const departments: AudienceDimensionHit[] = [];
  const groups: AudienceDimensionHit[] = [];

  for (const meta of DIMENSION_META) {
    for (const item of meta.items(targets)) {
      if (!textMatchesQuery(item.name, query)) continue;
      const hit = buildDimensionHit(meta, item, targets);
      if (meta.section === "departments") {
        departments.push(hit);
        if (departments.length >= limit.departments) break;
      } else {
        groups.push(hit);
        if (groups.length >= limit.groups) break;
      }
    }
  }

  const peopleUnderDimensionHits = new Set<number>();
  for (const hit of [...departments, ...groups]) {
    for (const employee of listEmployeesInScopeDimension(
      hit.key,
      hit.id,
      targets,
    )) {
      peopleUnderDimensionHits.add(employee.id);
    }
  }

  const people: AudienceEmployeeHit[] = [];
  for (const employee of targets?.employees ?? []) {
    if (!personalFieldsMatch(employee, query)) {
      continue;
    }
    if (
      normalizeQuery(query) &&
      peopleUnderDimensionHits.has(employee.id) &&
      !employee.name.toLowerCase().includes(normalizeQuery(query))
    ) {
      const words = queryWords(query);
      const nameMatches = words.some((word) =>
        employee.name.toLowerCase().includes(word),
      );
      if (!nameMatches) {
        continue;
      }
    }
    people.push({
      id: employee.id,
      name: employee.name,
      subtitle: [employee.department, employee.job_title]
        .filter(Boolean)
        .join(" · "),
      job_title: employee.job_title,
    });
    if (people.length >= limit.people) break;
  }

  const counts = {
    departments: departments.length,
    groups: groups.length,
    employees: people.length,
    all: departments.length + groups.length + people.length,
  };

  return { departments, groups, people, counts };
}

export function isDimensionSelected(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
) {
  return scope[key].includes(id);
}

export { GROUP_DIMENSION_KEYS };
