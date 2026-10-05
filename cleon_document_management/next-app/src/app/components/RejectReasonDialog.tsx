"use client";

import { useState } from "react";
import ModalDialog from "./ModalDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RejectReasonDialog({
  title = "Reject request",
  description = "A reason is required so the requester knows what to change.",
  confirmLabel = "Reject",
  onClose,
  onConfirm,
}: {
  title?: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <ModalDialog
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={pending}
      size="md"
      zIndex={100}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || !reason.trim()}
            onClick={() => {
              setPending(true);
              void Promise.resolve(onConfirm(reason.trim())).finally(() =>
                setPending(false),
              );
            }}
          >
            {pending ? "Rejecting…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <label className="block text-sm">
        <span className="font-semibold">Reason</span>
        <Input
          className="mt-1"
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this request is rejected"
        />
      </label>
    </ModalDialog>
  );
}
