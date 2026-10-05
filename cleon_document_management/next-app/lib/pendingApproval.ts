import type { useToast } from "../hooks/useToast";

export type PendingApprovalPayload = {
  success?: boolean;
  pending_approval?: boolean;
  approval_request_id?: number;
  message?: string;
};

export function isPendingApprovalResponse(
  result: PendingApprovalPayload | null | undefined,
): boolean {
  return Boolean(result?.pending_approval);
}

export function notifyPendingApproval(
  result: PendingApprovalPayload,
  showToast: ReturnType<typeof useToast>["showToast"],
): void {
  const message =
    result.message ||
    "Approval required. This will take effect after an approver signs off.";
  showToast(message, "success");
}
