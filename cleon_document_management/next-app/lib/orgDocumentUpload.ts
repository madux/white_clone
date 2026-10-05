export type OrgUploadApiResult = {
  success: boolean;
  pending_approval?: boolean;
  approval_request_id?: number;
  message?: string;
};

export class OrgUploadPendingApprovalError extends Error {
  approvalRequestId?: number;

  constructor(message: string, approvalRequestId?: number) {
    super(message);
    this.name = "OrgUploadPendingApprovalError";
    this.approvalRequestId = approvalRequestId;
  }
}

export function assertOrgUploadSucceeded(result: OrgUploadApiResult): void {
  if (!result.success) {
    throw new Error(result.message || "Upload failed.");
  }
  if (result.pending_approval) {
    throw new OrgUploadPendingApprovalError(
      result.message ||
        "Approval required. This will take effect after an approver signs off.",
      result.approval_request_id,
    );
  }
}

export function isOrgUploadPendingApprovalError(
  error: unknown,
): error is OrgUploadPendingApprovalError {
  return error instanceof OrgUploadPendingApprovalError;
}
