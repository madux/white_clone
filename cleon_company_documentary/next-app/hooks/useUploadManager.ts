"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "../lib/api";
import type { AudienceScope } from "../src/app/components/modals/AudiencePicker";

export type UploadJobStatus =
  | "queued"
  | "uploading"
  | "finalizing"
  | "completed"
  | "error"
  | "cancelled";

export type UploadJob = {
  clientId: string;
  title: string;
  fileName: string;
  folderId: number;
  mediaId?: number;
  uploadId?: number;
  progress: number;
  status: UploadJobStatus;
  error?: string;
  dismissed: boolean;
};

export type UploadQueueItem = {
  id: string;
  file: File;
  folderId: string;
  title: string;
};

export type UploadBatchMetadata = {
  description: string;
  mandatory: boolean;
  completionThreshold: number;
  commentsEnabled: boolean;
  scope: "inherited" | "override";
  accessScope: AudienceScope;
  departmentIds: number[];
  gradeIds: number[];
  employeeIds: number[];
  tagIds: number[];
  allowDownload: boolean;
  thumbnailFile: File | null;
  subtitleFile: File | null;
  subtitleLanguage: string;
};

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

async function autoThumbnail(
  file: File,
  thumbnailFile: File | null,
): Promise<Blob | null> {
  if (thumbnailFile) return thumbnailFile;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const source = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.src = source;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(5, video.duration || 5);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(source);
          resolve(blob);
        },
        "image/jpeg",
        0.82,
      );
    };
    video.onerror = () => {
      URL.revokeObjectURL(source);
      resolve(null);
    };
  });
}

async function uploadAsset(
  mediaId: number,
  blob: Blob,
  filename: string,
  mimeType: string,
  assetType: "thumbnail" | "subtitle",
  subtitleLanguage: string,
) {
  const signed =
    assetType === "thumbnail"
      ? await api.assetUrl(mediaId, "thumbnail", filename, mimeType)
      : await api.subtitle(mediaId, {
          name: filename,
          language: subtitleLanguage,
          format: filename.toLowerCase().endsWith(".srt") ? "srt" : "vtt",
          filename,
          mime_type: mimeType,
        });
  const response = await fetch(signed.url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType },
  });
  if (!response.ok) throw new Error(`The ${assetType} could not be uploaded.`);
}

type UseUploadManagerOptions = {
  onMediaCreated?: () => void;
  onJobComplete?: () => void;
  onJobError?: (message: string) => void;
  onBatchComplete?: (count: number) => void;
};

export function useUploadManager(options: UseUploadManagerOptions = {}) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const cancelRequested = useRef<Record<string, boolean>>({});
  const activeUploadId = useRef<number | null>(null);

  const updateJob = useCallback((clientId: string, patch: Partial<UploadJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.clientId === clientId ? { ...job, ...patch } : job)),
    );
  }, []);

  const dismissJob = useCallback((clientId: string) => {
    setJobs((prev) =>
      prev.map((job) => (job.clientId === clientId ? { ...job, dismissed: true } : job)),
    );
  }, []);

  const cancelJob = useCallback(async (clientId: string) => {
    cancelRequested.current[clientId] = true;
    if (activeUploadId.current) {
      await api.abortUpload(activeUploadId.current).catch(() => undefined);
      activeUploadId.current = null;
    }
    updateJob(clientId, { status: "cancelled", error: "Upload cancelled." });
  }, [updateJob]);

  const startBatch = useCallback(
    (queue: UploadQueueItem[], metadata: UploadBatchMetadata) => {
      const newJobs: UploadJob[] = queue.map((item) => ({
        clientId: item.id,
        title: item.title.trim() || stripExtension(item.file.name),
        fileName: item.file.name,
        folderId: Number(item.folderId),
        progress: 0,
        status: "queued" as UploadJobStatus,
        dismissed: false,
      }));

      setJobs((prev) => [...prev, ...newJobs]);

      void (async () => {
        let completedCount = 0;
        let batchFailed = false;

        for (const item of queue) {
          if (batchFailed) {
            updateJob(item.id, { status: "cancelled", error: "Batch stopped after a failure." });
            continue;
          }

          if (!item.folderId) {
            const message = `Choose a folder for ${item.file.name}.`;
            updateJob(item.id, { status: "error", error: message });
            options.onJobError?.(message);
            batchFailed = true;
            continue;
          }

          cancelRequested.current[item.id] = false;

          try {
            updateJob(item.id, { status: "uploading", progress: 0 });

            const init = await api.initiateUpload({
              folder_id: Number(item.folderId),
              filename: item.file.name,
              mime_type: item.file.type,
              file_size: item.file.size,
              title: item.title.trim() || stripExtension(item.file.name),
              description: metadata.description.trim(),
              mandatory: metadata.mandatory,
              completion_threshold: metadata.completionThreshold,
              comments_enabled: metadata.commentsEnabled,
              scope_mode: metadata.scope === "inherited" ? "inherited" : "override",
              access_scope: metadata.scope === "inherited" ? "company" : metadata.accessScope,
              department_ids: metadata.scope === "inherited" ? [] : metadata.departmentIds,
              grade_ids: metadata.scope === "inherited" ? [] : metadata.gradeIds,
              employee_ids: metadata.scope === "inherited" ? [] : metadata.employeeIds,
              tag_ids: metadata.tagIds,
              download_policy: metadata.allowDownload ? "allow" : "deny",
            });

            updateJob(item.id, {
              mediaId: init.media.id,
              uploadId: init.upload_id,
            });
            activeUploadId.current = init.upload_id;
            options.onMediaCreated?.();

            const parts: Array<{ PartNumber: number; ETag: string }> = [];
            for (let partNumber = 1; partNumber <= init.total_parts; partNumber += 1) {
              if (cancelRequested.current[item.id]) {
                throw new Error("Upload cancelled.");
              }
              const start = (partNumber - 1) * init.part_size;
              const chunk = item.file.slice(
                start,
                Math.min(start + init.part_size, item.file.size),
              );
              const signed = await api.partUrl(init.upload_id, partNumber);
              const response = await fetch(signed.url, {
                method: "PUT",
                body: chunk,
                headers: { "Content-Type": item.file.type },
              });
              if (!response.ok) {
                throw new Error(
                  `Part ${partNumber} of ${item.file.name} could not be uploaded.`,
                );
              }
              const etag = response.headers.get("ETag")?.replaceAll('"', "");
              if (!etag) {
                throw new Error(
                  "Cloudflare did not expose the upload ETag. Add ETag to the bucket CORS expose headers.",
                );
              }
              const part = { PartNumber: partNumber, ETag: etag };
              parts.push(part);
              await api.recordUploadPart(init.upload_id, part);
              updateJob(item.id, {
                progress: Math.round((partNumber / init.total_parts) * 100),
              });
            }

            updateJob(item.id, { status: "finalizing", progress: 100 });
            const completed = await api.completeUpload(init.upload_id, parts);
            activeUploadId.current = null;

            const generated = await autoThumbnail(item.file, metadata.thumbnailFile);
            if (generated) {
              await uploadAsset(
                completed.id,
                generated,
                metadata.thumbnailFile?.name || "thumbnail.jpg",
                "image/jpeg",
                "thumbnail",
                metadata.subtitleLanguage,
              );
            }
            if (metadata.subtitleFile) {
              await uploadAsset(
                completed.id,
                metadata.subtitleFile,
                metadata.subtitleFile.name,
                metadata.subtitleFile.type || "text/vtt",
                "subtitle",
                metadata.subtitleLanguage,
              );
            }

            updateJob(item.id, { status: "completed", progress: 100 });
            completedCount += 1;
            options.onJobComplete?.();
          } catch (error) {
            activeUploadId.current = null;
            if (cancelRequested.current[item.id]) {
              updateJob(item.id, { status: "cancelled", error: "Upload cancelled." });
              continue;
            }
            const message =
              error instanceof Error ? error.message : "The video upload failed.";
            updateJob(item.id, { status: "error", error: message });
            options.onJobError?.(message);
            batchFailed = true;
          }
        }

        if (completedCount > 0 && !batchFailed) {
          options.onBatchComplete?.(completedCount);
        }
      })();
    },
    [options, updateJob],
  );

  return { jobs, startBatch, dismissJob, cancelJob };
}
