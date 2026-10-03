"use client";

import { FolderOpen, Power, PowerOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { QUERY_KEYS, useDeleteFolder } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import type { OrganizationalPolicy } from "../../../lib/types";

export default function OrganizationalPolicyActions({
  policy,
  canManage,
  onChanged,
  minimal = false,
}: {
  policy: OrganizationalPolicy;
  canManage: boolean;
  onChanged?: () => void | Promise<void>;
  /** Lifecycle toggle only (e.g. policy folder header). */
  minimal?: boolean;
}) {
  const queryClient = useQueryClient();
  const remove = useDeleteFolder();
  const { showAlert, showConfirm } = useAppDialog();
  const [pending, setPending] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["organizational-policies"] });
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.folders });
    await queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.documents(policy.folder_id),
    });
    await onChanged?.();
  };

  const toggleLifecycle = async () => {
    const isActive = policy.lifecycle_status === "active";
    if (
      isActive &&
      !(await showConfirm(
        `Return "${policy.name}" to draft? It will be hidden from Shared Documents until you activate it again.`,
        { title: "Deactivate policy", confirmLabel: "Return to draft" },
      ))
    ) {
      return;
    }
    setPending(true);
    try {
      const result = await api.updateOrganizationalPolicy({
        policy_id: policy.id,
        lifecycle_status: isActive ? "draft" : "active",
      });
      if (!result.success) {
        await showAlert(result.message || "Unable to update this policy.", {
          title: isActive ? "Deactivate policy" : "Activate policy",
        });
        return;
      }
      await invalidate();
    } finally {
      setPending(false);
    }
  };

  const deletePolicyFolder = async () => {
    if (
      !(await showConfirm(
        `Move policy folder "${policy.name}" to the recycle bin? Documents inside will move with the folder.`,
        { title: "Delete policy folder", confirmLabel: "Delete" },
      ))
    ) {
      return;
    }
    const result = await remove.mutateAsync(policy.folder_id);
    if (result && result.success === false) {
      await showAlert(result.message || "Unable to delete this policy folder.", {
        title: "Delete failed",
      });
      return;
    }
    await invalidate();
  };

  const isActive = policy.lifecycle_status === "active";
  const isArchived = policy.lifecycle_status === "archived";

  const lifecycleButton =
    canManage && !isArchived ? (
      <button
        type="button"
        onClick={() => void toggleLifecycle()}
        disabled={pending}
        className="row-action"
        title={isActive ? "Return policy to draft" : "Activate policy"}
        aria-label={isActive ? "Return policy to draft" : "Activate policy"}
      >
        {isActive ? <PowerOff /> : <Power />}
      </button>
    ) : null;

  if (minimal) {
    return lifecycleButton ? <div className="table-actions-group">{lifecycleButton}</div> : null;
  }

  return (
    <div className="table-actions-group">
      <Link
        href={`/pages/organization/folder?folder=${policy.folder_id}`}
        className="row-action"
        title="Open policy folder"
        aria-label={`Open folder for ${policy.name}`}
      >
        <FolderOpen />
      </Link>
      {lifecycleButton}
      {canManage ? (
        <button
          type="button"
          className="row-action danger"
          title="Delete policy folder"
          aria-label={`Delete folder for ${policy.name}`}
          disabled={remove.isPending || pending}
          onClick={() => void deletePolicyFolder()}
        >
          <Trash2 />
        </button>
      ) : null}
    </div>
  );
}
