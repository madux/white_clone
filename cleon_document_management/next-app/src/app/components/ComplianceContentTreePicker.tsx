"use client";

import { ChevronRight, Folder, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../lib/api";
import {
  MAX_LINKED_CONTENT_SELECTION,
  selectionFromTreeDocument,
  type ComplianceContentSelection,
  type ComplianceLinkableTreeDocument,
  type ComplianceLinkableTreeFolder,
  type ComplianceLinkableTreeLevel,
} from "../../../lib/complianceRequestTasks";
import { FileTypeIcon } from "./FileTypeIcon";

type ScopePayload = {
  applies_to: string;
  department_ids: number[];
  grade_ids: number[];
  work_location_ids: number[];
  employment_type_ids: number[];
  branch_ids: number[];
  employee_ids: number[];
};

const ROOT = "root";
const VISIBLE_CHIPS = 6;

function docKeys(document: ComplianceLinkableTreeDocument): string[] {
  const keys = [`doc:${document.id}`];
  if (document.org_policy_id) keys.push(`policy:${document.org_policy_id}`);
  return keys;
}

export default function ComplianceContentTreePicker({
  scopePayload,
  policyId,
  multiple,
  selected,
  onChange,
}: {
  scopePayload: ScopePayload;
  policyId?: number;
  multiple: boolean;
  selected: ComplianceContentSelection[];
  onChange: (next: ComplianceContentSelection[]) => void;
}) {
  const [levels, setLevels] = useState<Record<string, ComplianceLinkableTreeLevel>>({});
  const levelsRef = useRef<Record<string, ComplianceLinkableTreeLevel>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [searchState, setSearchState] = useState<{
    query: string;
    level: ComplianceLinkableTreeLevel;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const requestBase = useMemo(
    () => ({ ...scopePayload, policy_id: policyId }),
    [scopePayload, policyId],
  );

  const fetchLevel = useCallback(
    async (key: string): Promise<ComplianceLinkableTreeLevel> => {
      const cached = levelsRef.current[key];
      if (cached) return cached;
      const result = await api.listComplianceRequestLinkableTree({
        ...requestBase,
        parent_folder_id: key === ROOT ? undefined : Number(key),
      });
      const level: ComplianceLinkableTreeLevel =
        result.success && result.data ? result.data : { folders: [], documents: [] };
      if (!result.success) setLoadError(result.message || "Unable to load content.");
      levelsRef.current = { ...levelsRef.current, [key]: level };
      setLevels(levelsRef.current);
      return level;
    },
    [requestBase],
  );

  useEffect(() => {
    void api.listComplianceRequestLinkableTree(requestBase).then((result) => {
      const level: ComplianceLinkableTreeLevel =
        result.success && result.data ? result.data : { folders: [], documents: [] };
      if (!result.success) setLoadError(result.message || "Unable to load content.");
      levelsRef.current = { ...levelsRef.current, [ROOT]: level };
      setLevels(levelsRef.current);
    });
  }, [requestBase]);

  const query = search.trim();
  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => {
      void api
        .listComplianceRequestLinkableTree({ ...requestBase, search: query })
        .then((result) => {
          setSearchState({
            query,
            level:
              result.success && result.data
                ? result.data
                : { folders: [], documents: [] },
          });
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, requestBase]);

  const searchResult = searchState?.query === query ? searchState.level : null;
  const searchLoading = Boolean(query) && !searchResult;

  const selectedKeys = useMemo(
    () => new Set(selected.map((item) => item.key)),
    [selected],
  );

  const isDocSelected = (document: ComplianceLinkableTreeDocument) =>
    docKeys(document).some((key) => selectedKeys.has(key));

  const withoutDocs = (documents: ComplianceLinkableTreeDocument[]) => {
    const remove = new Set(documents.flatMap(docKeys));
    return selected.filter((item) => !remove.has(item.key));
  };

  const toggleDoc = (document: ComplianceLinkableTreeDocument) => {
    if (!document.eligible) return;
    setNotice("");
    if (!multiple) {
      onChange([selectionFromTreeDocument(document)]);
      return;
    }
    if (isDocSelected(document)) {
      onChange(withoutDocs([document]));
      return;
    }
    if (selected.length >= MAX_LINKED_CONTENT_SELECTION) {
      setNotice(`You can select up to ${MAX_LINKED_CONTENT_SELECTION} files at once.`);
      return;
    }
    onChange([...selected, selectionFromTreeDocument(document)]);
  };

  const toggleExpanded = (folder: ComplianceLinkableTreeFolder) => {
    const isOpen = expanded.has(folder.id);
    setExpanded((current) => {
      const next = new Set(current);
      if (isOpen) next.delete(folder.id);
      else next.add(folder.id);
      return next;
    });
    if (!isOpen) void fetchLevel(String(folder.id));
  };

  const toggleFolder = async (folder: ComplianceLinkableTreeFolder) => {
    setNotice("");
    const level = await fetchLevel(String(folder.id));
    setExpanded((current) => new Set(current).add(folder.id));
    const eligible = level.documents.filter((document) => document.eligible);
    if (!eligible.length) {
      setNotice(`No files directly in “${folder.name}” can be linked for this audience.`);
      return;
    }
    const allSelected = eligible.every(isDocSelected);
    if (allSelected) {
      onChange(withoutDocs(eligible));
      return;
    }
    const missing = eligible.filter((document) => !isDocSelected(document));
    const room = MAX_LINKED_CONTENT_SELECTION - selected.length;
    if (room <= 0) {
      setNotice(`You can select up to ${MAX_LINKED_CONTENT_SELECTION} files at once.`);
      return;
    }
    const toAdd = missing.slice(0, room);
    if (toAdd.length < missing.length) {
      setNotice(
        `Only ${toAdd.length} of ${missing.length} files were added — the limit is ${MAX_LINKED_CONTENT_SELECTION}.`,
      );
    }
    onChange([...selected, ...toAdd.map(selectionFromTreeDocument)]);
  };

  const folderCheckState = (folder: ComplianceLinkableTreeFolder) => {
    const level = levels[String(folder.id)];
    if (!level) {
      const some = selected.some((item) => item.folder_id === folder.id);
      return { all: false, some };
    }
    const eligible = level.documents.filter((document) => document.eligible);
    const count = eligible.filter(isDocSelected).length;
    return {
      all: eligible.length > 0 && count === eligible.length,
      some: count > 0,
    };
  };

  const indent = (depth: number) => ({ paddingLeft: `${depth * 18 + 8}px` });

  const renderFolder = (folder: ComplianceLinkableTreeFolder, depth: number) => {
    const key = String(folder.id);
    const isOpen = expanded.has(folder.id);
    const level = levels[key];
    const { all, some } = folderCheckState(folder);
    return (
      <div key={`f-${folder.id}`}>
        <div
          className="flex items-center gap-2 py-1.5 pr-2 hover:bg-slate-50"
          style={indent(depth)}
        >
          <button
            type="button"
            onClick={() => toggleExpanded(folder)}
            className={`rounded p-0.5 text-slate-400 hover:bg-slate-100 ${
              folder.has_children ? "" : "invisible"
            }`}
            aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </button>
          {multiple ? (
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-pink-600"
              checked={all}
              ref={(element) => {
                if (element) element.indeterminate = some && !all;
              }}
              disabled={Boolean(folder.disabled_reason) || !folder.has_children}
              onChange={() => void toggleFolder(folder)}
              aria-label={`Select all files in ${folder.name}`}
            />
          ) : null}
          <button
            type="button"
            onClick={() => toggleExpanded(folder)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Folder className="h-4 w-4 shrink-0 text-brand-pink" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">
                {folder.name}
                {folder.folder_kind === "policy" ? (
                  <span className="ml-2 rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
                    Policy
                  </span>
                ) : null}
              </span>
              {folder.path ? (
                <span className="block truncate text-xs text-slate-400">{folder.path}</span>
              ) : null}
            </span>
          </button>
          {folder.disabled_reason ? (
            <span className="shrink-0 text-xs text-slate-400">{folder.disabled_reason}</span>
          ) : null}
        </div>
        {isOpen ? (
          !level ? (
            <p className="py-1.5 text-xs text-slate-400" style={indent(depth + 1)}>
              Loading…
            </p>
          ) : !level.folders.length && !level.documents.length ? (
            <p className="py-1.5 text-xs text-slate-400" style={indent(depth + 1)}>
              This folder is empty
            </p>
          ) : (
            renderLevel(level, depth + 1)
          )
        ) : null}
      </div>
    );
  };

  const renderDocument = (document: ComplianceLinkableTreeDocument, depth: number) => {
    const checked = isDocSelected(document);
    return (
      <label
        key={`d-${document.id}`}
        className={`flex items-center gap-2 py-1.5 pr-2 ${
          document.eligible ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed opacity-60"
        }`}
        style={indent(depth)}
        title={document.reason || undefined}
      >
        <span className="w-5 shrink-0" aria-hidden />
        <input
          type={multiple ? "checkbox" : "radio"}
          name="compliance-content-pick"
          className="h-4 w-4 shrink-0 accent-pink-600"
          checked={checked}
          disabled={!document.eligible}
          onChange={() => toggleDoc(document)}
        />
        <FileTypeIcon
          name={document.name}
          mime_type={document.mime_type}
          className="h-5 w-4 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-700">
            {document.name}
            {document.org_policy_id ? (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                Primary
              </span>
            ) : null}
          </span>
          {document.path ? (
            <span className="block truncate text-xs text-slate-400">{document.path}</span>
          ) : null}
        </span>
        {document.reason ? (
          <span className="shrink-0 text-xs text-slate-400">{document.reason}</span>
        ) : null}
      </label>
    );
  };

  function renderLevel(level: ComplianceLinkableTreeLevel, depth: number) {
    return (
      <>
        {level.folders.map((folder) => renderFolder(folder, depth))}
        {level.documents.map((document) => renderDocument(document, depth))}
      </>
    );
  }

  const root = levels[ROOT];
  const searching = Boolean(query);
  const hiddenChips = Math.max(0, selected.length - VISIBLE_CHIPS);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="field pl-10"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search folders and files…"
        />
      </div>

      {multiple && selected.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600">
            {selected.length} selected
          </span>
          {selected.slice(0, VISIBLE_CHIPS).map((item) => (
            <span
              key={item.key}
              className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-800"
            >
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((row) => row.key !== item.key))}
                aria-label={`Remove ${item.name}`}
                className="rounded-full hover:bg-pink-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {hiddenChips ? (
            <span className="text-xs text-slate-500">+{hiddenChips} more</span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1">
        {searching ? (
          searchLoading ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          ) : searchResult &&
            (searchResult.folders.length || searchResult.documents.length) ? (
            renderLevel(searchResult, 0)
          ) : (
            <p className="px-3 py-4 text-sm text-slate-500">
              No folders or files match your search
            </p>
          )
        ) : !root ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading folders…
          </p>
        ) : root.folders.length || root.documents.length ? (
          renderLevel(root, 0)
        ) : (
          <p className="px-3 py-4 text-sm text-slate-500">
            {loadError || "No organizational folders available"}
          </p>
        )}
      </div>

      {notice ? <p className="text-xs text-amber-700">{notice}</p> : null}
    </div>
  );
}
