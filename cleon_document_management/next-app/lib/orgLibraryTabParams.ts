import type { OrgLibraryKindFilter } from "./orgLibraryStats";

const TAB_TO_KIND: Record<string, OrgLibraryKindFilter> = {
  policies: "policy",
  documents: "documents",
  projects: "project",
  vendors: "vendor",
};

const KIND_TO_TAB: Partial<Record<OrgLibraryKindFilter, string>> = {
  policy: "policies",
  documents: "documents",
  project: "projects",
  vendor: "vendors",
};

export function orgLibraryKindFromSearchParams(
  params: Pick<URLSearchParams, "get">,
): OrgLibraryKindFilter {
  const tab = params.get("tab");
  if (tab && TAB_TO_KIND[tab]) return TAB_TO_KIND[tab];
  return "all";
}

export function applyOrgLibraryKindToSearchParams(
  params: URLSearchParams,
  kind: OrgLibraryKindFilter,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const tabParam = KIND_TO_TAB[kind];
  if (tabParam) next.set("tab", tabParam);
  else next.delete("tab");
  return next;
}
