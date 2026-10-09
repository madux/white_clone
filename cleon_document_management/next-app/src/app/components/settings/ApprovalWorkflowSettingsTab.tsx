"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import { useSaveSettings, useSettings } from "../../../../hooks/useDocuments";
import { useToast } from "../../../../hooks/useToast";
import ThemedSelect from "../ThemedSelect";

export default function ApprovalWorkflowSettingsTab() {
  const settings = useSettings();
  const save = useSaveSettings();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [flow, setFlow] = useState("any");
  const [approverIds, setApproverIds] = useState<number[]>([]);

  useEffect(() => {
    dmsContractsApi.settingsRead().then((result) => {
      if (!result.success) return;
      const wf = result.data.approval_workflow as Record<string, unknown>;
      setEnabled(Boolean(wf.enabled));
      setRequireApproval(Boolean(wf.default_require_upload_approval));
      setFlow(String(wf.default_approval_flow || "any"));
      setApproverIds((wf.default_approver_ids as number[]) || []);
    });
  }, []);

  const values = settings.data?.settings;
  const approvers = settings.data?.approvers ?? [];

  const persist = async () => {
    if (enabled && requireApproval && approverIds.length === 0) {
      showToast("Select at least one approver when upload approval is required.", "error");
      return;
    }
    await dmsContractsApi.approvalWorkflowSave(enabled);
    const result = await save.mutateAsync({
      ...(values || {}),
      default_require_upload_approval: requireApproval,
      default_approval_flow: flow,
      default_approver_ids: approverIds,
    });
    if (result.success) showToast("Approval workflow saved.");
    else showToast(result.message || "Save failed.", "error");
  };

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-slate-600">
        Off by default. When enabled, every upload that requires approval uses
        the approvers and flow below. Per-type approver lists are no longer used.
        Documents already approved stay approved; only new uploads and pending
        reviews follow these settings.
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable approval workflow
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={requireApproval}
          onChange={(e) => setRequireApproval(e.target.checked)}
        />
        Require upload approval by default
      </label>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Approver flow
        </p>
        <ThemedSelect
          value={flow}
          onChange={setFlow}
          options={[
            { value: "any", label: "Single approver" },
            { value: "sequential", label: "Sequential" },
            { value: "random", label: "All approvers" },
          ]}
        />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
          Approvers
        </p>
        <div className="flex flex-wrap gap-2">
          {approvers.map((user: { id: number; name: string }) => {
            const selected = approverIds.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() =>
                  setApproverIds(
                    selected
                      ? approverIds.filter((id) => id !== user.id)
                      : [...approverIds, user.id],
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  selected
                    ? "border-brand-pink bg-pink-50 text-brand-pink"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {user.name}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={persist}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white"
      >
        <Save className="h-4 w-4" /> Save workflow
      </button>
    </div>
  );
}
