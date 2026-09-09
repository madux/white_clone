"use client";

import { useRef, useState } from "react";
import { LoaderCircle, UploadCloud } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";
import { api } from "@/lib/api";
import { ModalShell } from "../shared/ModalShell";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAlbumId, setTargetAlbumId] = useState<number | "">(albumId || "");
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [cropAspect, setCropAspect] = useState("1:1");
  const [videoMeta, setVideoMeta] = useState({ trimStart: 0, trimEnd: 0, aspect: "16:9" });

  const handleClose = async () => {
    if (uploading && sessionRef.current) {
      await api.abortUpload(sessionRef.current).catch(() => {});
    }
    onClose();
  };

  const upload = async (ackDuplicate = false) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgressLabel("Preparing upload…");
    setProgressPct(5);
    try {
      const checksum = await sha256Hex(file);
      const init = await api.initiateUpload({
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        album_id: targetAlbumId || undefined,
      });
      sessionRef.current = init.session_id;

      const partCount = init.part_count;
      const parts: Array<{ PartNumber: number; ETag: string }> = [];

      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        setProgressLabel(`Uploading part ${partNumber} of ${partCount}…`);
        setProgressPct(Math.round((partNumber / partCount) * 85));
        const { url } = await api.uploadPartUrl({ session_id: init.session_id, part_number: partNumber });
        const start = (partNumber - 1) * init.part_size;
        const end = Math.min(start + init.part_size, file.size);
        const chunk = file.slice(start, end);
        const response = await fetch(url, { method: "PUT", body: chunk });
        if (!response.ok) throw new Error(`Upload failed on part ${partNumber}`);
        const etag = response.headers.get("ETag")?.replaceAll('"', "") || "";
        await api.recordUploadPart({ session_id: init.session_id, part_number: partNumber, etag });
        parts.push({ PartNumber: partNumber, ETag: etag });
      }

      setProgressLabel("Finalizing…");
      setProgressPct(95);
      const result = await api.completeUpload({
        session_id: init.session_id,
        display_name: displayName || file.name,
        description,
        checksum,
        duplicate_acknowledged: ackDuplicate,
        edit_metadata: file.type.startsWith("video/") ? videoMeta : { cropAspect },
      });

      if (result.duplicate_warning) {
        setDuplicateWarning(true);
        setUploading(false);
        setProgressPct(0);
        setProgressLabel("");
        return;
      }

      setProgressPct(100);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      setProgressPct(0);
      setProgressLabel("");
    }
  };

  return (
    <ModalShell title="Upload Media" eyebrow="Gallery" onClose={handleClose}>
      <div className="modal-form">
        {error && <div className="alert-banner">{error}</div>}
        {duplicateWarning && (
          <div className="alert-banner">
            <div>
              <strong>Duplicate detected</strong>
              <p>A file with the same checksum already exists in the gallery.</p>
            </div>
            <div className="primary-actions">
              <button type="button" className="secondary-button small" onClick={handleClose}>Cancel</button>
              <button type="button" className="primary-button" onClick={() => upload(true)}>Continue Anyway</button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="file-dropzone"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <div className="file-drop-icon"><UploadCloud size={22} /></div>
          <strong>{file ? file.name : "Drop a file or click to browse"}</strong>
          <span>Photos and videos supported</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              const next = e.target.files?.[0] || null;
              setFile(next);
              if (next) setDisplayName(next.name);
            }}
          />
        </button>

        <label>
          Display Name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={uploading} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} rows={2} />
        </label>
        {!albumId && (
          <label>
            Destination Album
            <select value={targetAlbumId} onChange={(e) => setTargetAlbumId(e.target.value ? Number(e.target.value) : "")} disabled={uploading}>
              <option value="">Auto — Gallery (monthly album)</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {file?.type.startsWith("image/") && (
          <label>
            Crop preset
            <select value={cropAspect} onChange={(e) => setCropAspect(e.target.value)} disabled={uploading}>
              {["1:1", "4:3", "16:9", "3:4"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        {file?.type.startsWith("video/") && (
          <>
            <label>
              Trim start (sec)
              <input type="number" min={0} value={videoMeta.trimStart} onChange={(e) => setVideoMeta((p) => ({ ...p, trimStart: Number(e.target.value) }))} disabled={uploading} />
            </label>
            <label>
              Trim end (sec)
              <input type="number" min={0} value={videoMeta.trimEnd} onChange={(e) => setVideoMeta((p) => ({ ...p, trimEnd: Number(e.target.value) }))} disabled={uploading} />
            </label>
            <label>
              Display aspect ratio
              <select value={videoMeta.aspect} onChange={(e) => setVideoMeta((p) => ({ ...p, aspect: e.target.value }))} disabled={uploading}>
                {["16:9", "4:3", "1:1"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </>
        )}
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
        <button type="button" className="primary-button" disabled={!file || uploading} onClick={() => upload(false)}>
          {uploading ? <LoaderCircle size={16} className="spin" /> : null}
          Upload
        </button>
      </div>
    </ModalShell>
  );
}
