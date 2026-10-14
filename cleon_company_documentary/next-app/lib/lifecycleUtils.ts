import type { DocumentaryMedia, DocumentarySettings } from "./types";
import { formatStatusLabel } from "./statusUtils";

export type LifecycleAction =
  | "submit"
  | "withdraw"
  | "publish"
  | "approve"
  | "approve_publish"
  | "reject";

export type PublishReadiness = {
  ready: boolean;
  items: { key: string; label: string; ok: boolean }[];
};

export function publishReadiness(
  media: DocumentaryMedia,
  settings?: DocumentarySettings | null,
  options?: { isAdministrator?: boolean },
): PublishReadiness {
  const isAdministrator = Boolean(options?.isAdministrator);
  const items = [
    {
      key: "processing",
      label: "Video processing complete",
      ok: media.processing_state === "ready",
    },
    {
      key: "title",
      label: "Title set",
      ok: Boolean(media.title?.trim()),
    },
    {
      key: "category",
      label: "Category selected",
      ok: Boolean(media.category?.trim()),
    },
    {
      key: "thumbnail",
      label: "Thumbnail available",
      ok: Boolean(media.thumbnail_available),
    },
    {
      key: "approval",
      label: settings?.require_upload_approval
        ? isAdministrator
          ? "Administrator can publish when ready"
          : "Approved by an administrator"
        : "Upload approval not required",
      ok: settings?.require_upload_approval
        ? media.status === "approved" ||
          media.status === "published" ||
          isAdministrator
        : true,
    },
  ];
  return {
    ready: items.every((item) => item.ok),
    items,
  };
}

export function lifecycleActionsForMedia(
  media: DocumentaryMedia,
  options: {
    isAdministrator: boolean;
    isSupervisor: boolean;
    canEdit: boolean;
    userId?: number;
    settings?: DocumentarySettings | null;
  },
): LifecycleAction[] {
  const status = media.status || "draft";
  const actions: LifecycleAction[] = [];
  const { isAdministrator, isSupervisor, canEdit, userId, settings } = options;
  const canReview = isAdministrator || isSupervisor;
  const isSubmitter =
    Boolean(userId) &&
    (media.submitted_by_id === userId || media.owner_id === userId);

  // Supervisors submit for administrator review; administrators publish directly.
  if (
    canEdit &&
    !isAdministrator &&
    isSupervisor &&
    (status === "draft" || status === "returned")
  ) {
    actions.push("submit");
  }

  if (
    canEdit &&
    !isAdministrator &&
    status === "pending_review" &&
    isSubmitter
  ) {
    actions.push("withdraw");
  }

  if (canReview && status === "pending_review" && !isSubmitter) {
    actions.push("approve", "reject");
    if (isAdministrator) {
      actions.push("approve_publish");
    }
  }

  if (
    isAdministrator &&
    (status === "draft" || status === "approved") &&
    publishReadiness(media, settings, { isAdministrator: true }).ready
  ) {
    actions.push("publish");
  }

  return actions;
}

export function lifecycleActionLabel(action: LifecycleAction): string {
  const labels: Record<LifecycleAction, string> = {
    submit: "Submit for review",
    withdraw: "Withdraw submission",
    publish: "Publish",
    approve: "Approve",
    approve_publish: "Approve & publish",
    reject: "Return for correction",
  };
  return labels[action];
}

export function statusDisplay(media: DocumentaryMedia): string {
  return formatStatusLabel(media.status || media.approval_status || "draft");
}

export function uploadCompleteHint(
  media: DocumentaryMedia,
  settings?: DocumentarySettings | null,
  options?: { isAdministrator?: boolean; isSupervisor?: boolean },
): string {
  if (media.processing_state === "processing" || media.status === "processing") {
    return "Processing in the background. You will be able to publish or submit when it is ready.";
  }
  if (options?.isAdministrator) {
    return "Saved as draft. Publish when processing and metadata checks pass.";
  }
  if (options?.isSupervisor && settings?.require_upload_approval) {
    return "Saved as draft. Submit for administrator review when metadata is complete.";
  }
  return "Saved as draft. An administrator can publish when ready.";
}
