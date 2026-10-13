"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkspaceGrant, WorkspaceModule } from "../../../lib/types";
import {
  SHARE_PRESETS,
  type ScopeTreeNode,
  type ShareScopeMode,
  buildScopeNote,
  collectDescendantIds,
  formatUntil,
  moduleKeysFromSelection,
  moduleLabel,
  selectionSummaryLines,
  toLocalInputValue,
} from "../../../lib/workspaceSharingUtils";
import ModalDialog from "./ModalDialog";
import StatusPill from "./StatusPill";

function grantStateTone(state: string): "ok" | "pending" | "danger" | "neutral" {
  if (state === "active") return "ok";
  if (state === "pending") return "pending";
  if (["cancelled", "revoked", "expired", "declined"].includes(state)) return "danger";
  return "neutral";
}

function grantStatusLabel(state: string) {
  if (state === "active") return "Active";
  if (state === "pending") return "Pending";
  if (state === "expired") return "Expired";
  return state.replace(/_/g, " ");
}

export type WorkspaceShareModalSubmit = {
  delegate_id?: number;
  valid_until: string;
  module_keys: string[];
  generate_code: boolean;
  note?: string;
};

type Props = {
  open: boolean;
  editingGrant: WorkspaceGrant | null;
  eligibleModules: WorkspaceModule[];
  scopeTree: ScopeTreeNode[];
  foldersLoading: boolean;
  onClose: () => void;
  onSearchUsers: (query: string) => Promise<{ id: number; name: string; email: string }[]>;
  onSubmitCreate: (payload: WorkspaceShareModalSubmit) => void;
  onSubmitUpdate: (grantId: number, payload: WorkspaceShareModalSubmit) => void;
  createPending: boolean;
  updatePending: boolean;
};

export default function WorkspaceShareModal({
  open,
  editingGrant,
  eligibleModules,
  scopeTree,
  foldersLoading,
  onClose,
  onSearchUsers,
  onSubmitCreate,
  onSubmitUpdate,
  createPending,
  updatePending,
}: Props) {
  const eligibleKeySet = useMemo(
    () => new Set(eligibleModules.map((m) => m.key)),
    [eligibleModules],
  );

  const [scopeMode, setScopeMode] = useState<ShareScopeMode>("selected");
  const [presetId, setPresetId] = useState(SHARE_PRESETS[1]?.id || "documents");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<
    { id: number; name: string; email: string }[]
  >([]);
  const [delegateId, setDelegateId] = useState<number | null>(null);
  const [delegateLabel, setDelegateLabel] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [generateCode, setGenerateCode] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormError("");
    if (editingGrant) {
      setValidUntil(toLocalInputValue(editingGrant.valid_until));
      setDelegateId(editingGrant.delegate_id || null);
      setDelegateLabel(editingGrant.delegate_name || "");
      setScopeMode("selected");
      const ids = new Set<string>();
      for (const key of editingGrant.module_keys) {
        ids.add(`module-${key}`);
      }
      setSelectedIds(ids);
      setGenerateCode(false);
      return;
    }
    setScopeMode("selected");
    setPresetId(SHARE_PRESETS[1]?.id || "documents");
    setSelectedIds(new Set());
    setUserQuery("");
    setUserResults([]);
    setDelegateId(null);
    setDelegateLabel("");
    setValidUntil("");
    setGenerateCode(false);
  }, [open, editingGrant]);

  const resolvedModuleKeys = useMemo(() => {
    if (scopeMode === "all") {
      return eligibleModules.map((m) => m.key);
    }
    if (scopeMode === "preset") {
      const preset = SHARE_PRESETS.find((p) => p.id === presetId);
      return (preset?.keys || []).filter((k) => eligibleKeySet.has(k));
    }
    return moduleKeysFromSelection(scopeTree, selectedIds, eligibleKeySet);
  }, [
    scopeMode,
    presetId,
    selectedIds,
    scopeTree,
    eligibleModules,
    eligibleKeySet,
  ]);

  const summaryLines = useMemo(() => {
    if (scopeMode === "all") {
      return ["All documents and modules you can access"];
    }
    if (scopeMode === "preset") {
      const preset = SHARE_PRESETS.find((p) => p.id === presetId);
      return [
        `Preset: ${preset?.label || presetId}`,
        ...resolvedModuleKeys.map((k) => moduleLabel(k)),
      ];
    }
    const lines = selectionSummaryLines(scopeTree, selectedIds);
    return lines.length ? lines : resolvedModuleKeys.map((k) => moduleLabel(k));
  }, [scopeMode, presetId, scopeTree, selectedIds, resolvedModuleKeys]);

  const toggleNode = (node: ScopeTreeNode, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of collectDescendantIds(node)) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const validate = () => {
    if (!validUntil.trim()) {
      return "Valid until is required.";
    }
    const end = new Date(validUntil);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
      return "Valid until must be a future date and time.";
    }
    if (!resolvedModuleKeys.length) {
      return "Select at least one module or folder.";
    }
    if (!editingGrant && !delegateId && !generateCode) {
      return "Choose a delegate or enable invite code.";
    }
    return "";
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    const preset = SHARE_PRESETS.find((p) => p.id === presetId);
    const note = buildScopeNote(
      scopeMode,
      scopeMode === "selected" ? selectionSummaryLines(scopeTree, selectedIds) : [],
      scopeMode === "preset" ? preset?.label : undefined,
    );
    const payload: WorkspaceShareModalSubmit = {
      delegate_id: delegateId || undefined,
      valid_until: validUntil,
      module_keys: resolvedModuleKeys,
      generate_code: generateCode,
      note,
    };
    if (editingGrant) {
      onSubmitUpdate(editingGrant.id, payload);
    } else {
      onSubmitCreate(payload);
    }
  };

  const renderTree = (nodes: ScopeTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const checked = selectedIds.has(node.id);
      const disabled = scopeMode !== "selected";
      return (
        <div key={node.id} style={{ marginLeft: depth * 12 }}>
          <label
            className={`flex cursor-pointer items-center gap-2 py-1 text-sm ${
              disabled ? "opacity-50" : "text-slate-800"
            }`}
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={(e) => toggleNode(node, e.target.checked)}
            />
            <span className="font-medium">{node.label}</span>
            {node.documentCount != null && node.documentCount > 0 ? (
              <span className="text-xs text-slate-500">
                ({node.documentCount} docs)
              </span>
            ) : null}
          </label>
          {node.children?.length ? renderTree(node.children, depth + 1) : null}
        </div>
      );
    });

  if (!open && !editingGrant) return null;

  return (
    <ModalDialog
      title={editingGrant ? "Edit access" : "Share workspace"}
      description={
        editingGrant
          ? "Update modules, folders, and expiry for this invitation."
          : "Invite a colleague to work in your workspace for a limited time."
      }
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={createPending || updatePending}
            onClick={handleSubmit}
          >
            {editingGrant ? "Save changes" : "Create invitation"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(220px,280px)]">
        <div className="space-y-5">
          {editingGrant ? (
            <div>
              <p className="text-sm font-medium text-slate-700">Delegate</p>
              <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                <span>{editingGrant.delegate_name || "Anyone with invite code"}</span>
                <StatusPill
                  label={grantStatusLabel(editingGrant.state)}
                  tone={grantStateTone(editingGrant.state)}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-slate-700">Delegate</label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by name or email"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void onSearchUsers(userQuery).then(setUserResults).catch(() => setUserResults([]))
                  }
                >
                  Search
                </Button>
              </div>
              {delegateLabel ? (
                <p className="mt-2 rounded-lg bg-pink-50 px-3 py-2 text-sm font-semibold text-brand-pink">
                  {delegateLabel}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Optional if you only use an invite code.
                </p>
              )}
              {userResults.length > 0 ? (
                <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-slate-200">
                  {userResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-pink-50/40"
                        onClick={() => {
                          setDelegateId(u.id);
                          setDelegateLabel(`${u.name} (${u.email})`);
                          setUserResults([]);
                        }}
                      >
                        {u.name} · {u.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">Valid until</label>
            <Input
              type="datetime-local"
              className="mt-1.5"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Access scope</p>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["all", "All documents I can access"],
                  ["selected", "Selected modules and folders"],
                  ["preset", "Preset"],
                ] as const
              ).map(([mode, label]) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                >
                  <input
                    type="radio"
                    name="share-scope"
                    checked={scopeMode === mode}
                    onChange={() => setScopeMode(mode)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {scopeMode === "preset" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {SHARE_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={presetId === preset.id ? "default" : "outline"}
                    onClick={() => setPresetId(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">
              Select modules / folders
            </p>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {foldersLoading ? (
                <p className="text-sm text-slate-500">Loading folders…</p>
              ) : scopeTree.length ? (
                renderTree(scopeTree)
              ) : (
                <p className="text-sm text-slate-500">No shareable modules found.</p>
              )}
            </div>
          </div>

          {!editingGrant ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={generateCode}
                onChange={(e) => setGenerateCode(e.target.checked)}
              />
              Generate invite code (optional)
            </label>
          ) : null}

          {formError ? (
            <p className="text-sm font-medium text-red-600">{formError}</p>
          ) : null}

          <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
            The delegate will only see documents you are authorised to access. Access
            will expire automatically on the selected date.
          </p>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-bold text-slate-900">Access summary</h3>
          <dl className="mt-3 space-y-2 text-xs text-slate-600">
            <div>
              <dt className="font-semibold text-slate-500">Delegate</dt>
              <dd className="text-slate-800">
                {delegateLabel || editingGrant?.delegate_name || "—"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Valid until</dt>
              <dd className="text-slate-800">
                {validUntil
                  ? formatUntil(
                      new Date(validUntil).toISOString().slice(0, 19).replace("T", " "),
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Scope</dt>
              <dd className="text-slate-800">
                {scopeMode === "all"
                  ? "All accessible"
                  : scopeMode === "preset"
                    ? "Preset"
                    : "Selected"}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {summaryLines.slice(0, 12).map((line) => (
              <li key={line}>{line}</li>
            ))}
            {summaryLines.length > 12 ? (
              <li>+{summaryLines.length - 12} more</li>
            ) : null}
          </ul>
        </aside>
      </div>
    </ModalDialog>
  );
}
