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
};

export type AudienceEmployeeHit = {
  id: number;
  name: string;
  subtitle: string;
};

export type PolicyAudienceSearchResult = {
  dimensions: AudienceDimensionHit[];
  people: AudienceEmployeeHit[];
};

const DIMENSION_META: {
  key: keyof PolicyScopeState;
  label: string;
  items: (targets?: PolicyScopeTargets) => { id: number; name: string }[];
}[] = [
  {
    key: "department_ids",
    label: "Department",
    items: (t) => t?.departments ?? [],
  },
  {
    key: "grade_ids",
    label: "Grade",
    items: (t) => t?.grades ?? [],
  },
  {
    key: "work_location_ids",
    label: "Location",
    items: (t) => t?.locations ?? [],
  },
  {
    key: "employment_type_ids",
    label: "Employment type",
    items: (t) => t?.employment_types ?? [],
  },
  {
    key: "branch_ids",
    label: "Business unit",
    items: (t) => t?.branches ?? [],
  },
];

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function personalFieldsMatch(
  employee: NonNullable<PolicyScopeTargets["employees"]>[number],
  q: string,
) {
  const hay = [employee.name, employee.job_title, employee.work_email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function dimensionResultId(key: keyof PolicyScopeState, id: number) {
  return `${key}:${id}`;
}

export function searchPolicyAudience(
  query: string,
  targets?: PolicyScopeTargets,
  limit = {
    dimensions: 8,
    people: 12,
    membersPreview: 80,
  },
): PolicyAudienceSearchResult {
  const q = normalizeQuery(query);
  if (!q) {
    return { dimensions: [], people: [] };
  }

  const dimensions: AudienceDimensionHit[] = [];
  for (const meta of DIMENSION_META) {
    for (const item of meta.items(targets)) {
      if (!item.name.toLowerCase().includes(q)) continue;
      const members = listEmployeesInScopeDimension(meta.key, item.id, targets);
      dimensions.push({
        key: meta.key,
        id: item.id,
        label: item.name,
        dimensionLabel: meta.label,
        memberCount: members.length,
      });
      if (dimensions.length >= limit.dimensions) break;
    }
    if (dimensions.length >= limit.dimensions) break;
  }

  const memberIdsUnderDimensionHits = new Set<number>();
  for (const hit of dimensions) {
    for (const employee of listEmployeesInScopeDimension(
      hit.key,
      hit.id,
      targets,
    ).slice(0, limit.membersPreview)) {
      memberIdsUnderDimensionHits.add(employee.id);
    }
  }

  const people: AudienceEmployeeHit[] = [];
  for (const employee of targets?.employees ?? []) {
    if (!personalFieldsMatch(employee, q)) {
      continue;
    }
    if (
      memberIdsUnderDimensionHits.has(employee.id) &&
      !employee.name.toLowerCase().includes(q)
    ) {
      continue;
    }
    people.push({
      id: employee.id,
      name: employee.name,
      subtitle: [employee.department, employee.job_title]
        .filter(Boolean)
        .join(" · "),
    });
    if (people.length >= limit.people) break;
  }

  return { dimensions, people };
}

export function isDimensionSelected(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
) {
  return scope[key].includes(id);
}
