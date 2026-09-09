"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect } from "react";
import type { UploadJob } from "../../../../hooks/useUploadManager";

function statusLabel(job: UploadJob) {
  switch (job.status) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "finalizing":
      return "Finalizing";
    case "completed":
      return "Complete";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

function UploadToast({
  job,
  onDismiss,
}: {
  job: UploadJob;
  onDismiss: (clientId: string) => void;
}) {
  useEffect(() => {
    if (job.status !== "completed") return undefined;
    const timer = window.setTimeout(() => onDismiss(job.clientId), 5000);
    return () => window.clearTimeout(timer);
  }, [job.clientId, job.status, onDismiss]);

  const isError = job.status === "error";
  const isComplete = job.status === "completed";
  const showProgress = ["queued", "uploading", "finalizing"].includes(job.status);
  const progressValue = isComplete ? 100 : job.progress;

  return (
    <div
      className={`upload-toast${isError ? " is-error" : ""}${isComplete ? " is-complete" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="upload-toast-header">
        <div className="upload-toast-icon">
          {isComplete ? (
            <Check size={14} />
          ) : isError ? (
            <X size={14} />
          ) : (
            <LoaderCircle size={14} className="spin" />
          )}
        </div>
        <div className="upload-toast-copy">
          <strong>{job.title}</strong>
          <span>{isError && job.error ? job.error : statusLabel(job)}</span>
        </div>
        <button
          type="button"
          className="upload-toast-close"
          aria-label={`Dismiss ${job.title} upload notification`}
          onClick={() => onDismiss(job.clientId)}
        >
          <X size={14} />
        </button>
      </div>
      {(showProgress || isComplete) && (
        <div className="upload-toast-progress">
          <div className="progress-label">
            <span>{job.fileName}</span>
            <strong>{progressValue}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progressValue}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function UploadToastStack({
  jobs,
  onDismiss,
}: {
  jobs: UploadJob[];
  onDismiss: (clientId: string) => void;
}) {
  const visibleJobs = jobs.filter((job) => !job.dismissed);
  if (!visibleJobs.length) return null;

  return (
    <div className="upload-toast-stack" aria-label="Upload progress">
      {visibleJobs.map((job) => (
        <UploadToast key={job.clientId} job={job} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
