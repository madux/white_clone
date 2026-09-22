"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";
import { api } from "@/lib/api";
import { ModalShell } from "../shared/ModalShell";

type QueueItem = {
  id: string;
  file: File;
  displayName: string;
  albumId: number | "";
};

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export default function UploadModal({
  albumId, albums = [], onClose, onComplete,
}: {
  albumId?: number;
  albums?: GalleryAlbum[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [defaultAlbumId, setDefaultAlbumId] = useState<number | "">(albumId || "");
  const [description, setDescription] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateItemId, setDuplicateItemId] = useState<string | null>(null);
  const [resumeIndex, setResumeIndex] = useState(0);

  const addFiles = (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!accepted.length) return;
    setQueue((prev) => {
      const existing = new Set(prev.map((item) => fileKey(item.file)));
      const next = accepted
        .filter((file) => !existing.has(fileKey(file)))
        .map((file) => ({
          id: `${fileKey(file)}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          displayName: stripExtension(file.name),
          albumId: defaultAlbumId,
        }));
      return [...prev, ...next];
    });
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const applyDefaultAlbumToAll = () => {
    setQueue((prev) => prev.map((item) => ({ ...item, albumId: defaultAlbumId })));
  };

  const handleClose = async () => {
    cancelRef.current = true;
    if (uploading && sessionRef.current) {
      await api.abortUpload(sessionRef.current).catch(() => {});
    }
    onClose();
  };

  const uploadFile = async (item: QueueItem, ackDuplicate = false) => {
    const checksum = await sha256Hex(item.file);
    const init = await api.initiateUpload({
      file_name: item.file.name,
      mime_type: item.file.type,
      file_size: item.file.size,
      album_id: item.albumId || undefined,
    });
    sessionRef.current = init.session_id;

    for (let partNumber = 1; partNumber <= init.part_count; partNumber += 1) {
      if (cancelRef.current) throw new Error("Upload cancelled.");
      const { url } = await api.uploadPartUrl({ session_id: init.session_id, part_number: partNumber });
      const start = (partNumber - 1) * init.part_size;
      const end = Math.min(start + init.part_size, item.file.size);
      const chunk = item.file.slice(start, end);
      const response = await fetch(url, { method: "PUT", body: chunk });
      if (!response.ok) throw new Error(`Upload failed on part ${partNumber}`);
      const etag = response.headers.get("ETag")?.replaceAll('"', "");
      if (!etag) {
        throw new Error(
          "Cloudflare did not expose the upload ETag. The bucket CORS policy may be missing ExposeHeaders: ETag.",
        );
      }
      await api.recordUploadPart({ session_id: init.session_id, part_number: partNumber, etag });
    }

    const result = await api.completeUpload({
      session_id: init.session_id,
      display_name: item.displayName || item.file.name,
      description,
      checksum,
      duplicate_acknowledged: ackDuplicate,
    });

    if (result.duplicate_warning) {
      setDuplicateItemId(item.id);
      setUploading(false);
      return "duplicate";
    }

    sessionRef.current = null;
    return "done";
  };

  const processQueue = async (startIndex = 0, ackDuplicateId?: string, items = queue) => {
    if (!items.length) return;
    setError("");
    setUploading(true);
    cancelRef.current = false;

    try {
      for (let index = startIndex; index < items.length; index += 1) {
        if (cancelRef.current) break;
        const item = items[index];
        setResumeIndex(index);
        setProgressLabel(`Uploading ${index + 1} of ${items.length}: ${item.file.name}`);
        setProgressPct(Math.round((index / items.length) * 100));

        const outcome = await uploadFile(item, ackDuplicateId === item.id);
        if (outcome === "duplicate") {
          setDuplicateItemId(item.id);
          setProgressLabel(`Duplicate detected: ${item.file.name}`);
          setUploading(false);
          return;
        }
      }

      if (!cancelRef.current) {
        setProgressPct(100);
        setProgressLabel("All uploads complete");
        setDuplicateItemId(null);
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const duplicateItem = queue.find((item) => item.id === duplicateItemId);

  return (
    <ModalShell title="Upload Media" eyebrow="Gallery" onClose={handleClose}>
      <div className="modal-form">
        {error && <div className="alert-banner">{error}</div>}
        {duplicateItem && (
          <div className="alert-banner alert-banner-stacked">
            <div className="alert-banner-copy">
              <strong>Duplicate detected</strong>
              <p>{duplicateItem.file.name} already exists in the gallery.</p>
            </div>
            <div className="primary-actions alert-banner-actions">
              <button
                type="button"
                className="secondary-button small"
                onClick={() => {
                  const nextQueue = queue.filter((item) => item.id !== duplicateItem.id);
                  setQueue(nextQueue);
                  setDuplicateItemId(null);
                  void processQueue(resumeIndex, undefined, nextQueue);
                }}
              >
                Skip
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setDuplicateItemId(null);
                  void processQueue(resumeIndex, duplicateItem.id);
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="file-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(Array.from(event.dataTransfer.files));
          }}
          disabled={uploading}
        >
          <div className="file-drop-icon">
            {queue.length ? <Check size={22} /> : <UploadCloud size={22} />}
          </div>
          <strong>
            {queue.length
              ? `${queue.length} file${queue.length === 1 ? "" : "s"} selected`
              : "Drop files or click to browse"}
          </strong>
          <span>Photos and videos supported · select multiple</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </button>

        <div className="upload-defaults">
          <label>
            Default album for new files
            <select
              value={defaultAlbumId}
              onChange={(e) => setDefaultAlbumId(e.target.value ? Number(e.target.value) : "")}
              disabled={uploading}
            >
              <option value="">Auto — monthly album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>{album.name}</option>
              ))}
            </select>
          </label>
          {queue.length > 1 && (
            <button type="button" className="text-button" disabled={uploading} onClick={applyDefaultAlbumToAll}>
              Apply default to all
            </button>
          )}
        </div>

        {queue.length > 0 && (
          <div className="upload-queue">
            {queue.map((item) => (
              <div key={item.id} className="upload-queue-row">
                <div className="upload-queue-main">
                  <strong>{item.file.name}</strong>
                  <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.file.type.startsWith("video/") ? "Video" : "Photo"}</span>
                </div>
                <label>
                  Display name
                  <input
                    value={item.displayName}
                    onChange={(e) => updateItem(item.id, { displayName: e.target.value })}
                    disabled={uploading}
                  />
                </label>
                <label>
                  Album
                  <select
                    value={item.albumId}
                    onChange={(e) => updateItem(item.id, { albumId: e.target.value ? Number(e.target.value) : "" })}
                    disabled={uploading}
                  >
                    <option value="">Auto — monthly album</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>{album.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remove ${item.file.name}`}
                  disabled={uploading}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label>
          Description <span className="optional">Optional · applies to all</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} rows={2} />
        </label>

        {(uploading || progressPct > 0) && (
          <div>
            <p className="meta-muted">{progressLabel}</p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={handleClose} disabled={uploading}>Cancel</button>
        <button type="button" className="primary-button" disabled={!queue.length || uploading} onClick={() => void processQueue(0)}>
          {uploading ? <LoaderCircle size={16} className="spin" /> : null}
          Upload {queue.length || ""} file{queue.length === 1 ? "" : "s"}
        </button>
      </div>
    </ModalShell>
  );
}
