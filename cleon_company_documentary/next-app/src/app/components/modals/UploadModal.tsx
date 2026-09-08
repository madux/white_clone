"use client";

import {
  Check,
  LoaderCircle,
  MessageCircle,
  Search,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DocumentaryFolder, Tag } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { AudiencePicker, type AudienceScope } from "./AudiencePicker";
import { ModalShell } from "./ModalShell";

export function UploadModal({
  folders,
  selectedFolder,
  onClose,
  onSuccess,
  onError,
}: {
  folders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const [folderId, setFolderId] = useState(
    String(selectedFolder?.id || folders[0]?.id || ""),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("inherited");
  const [accessScope, setAccessScope] = useState<AudienceScope>("company");
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [gradeIds, setGradeIds] = useState<number[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [mandatory, setMandatory] = useState(false);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [allowDownload, setAllowDownload] = useState(true);
  const [threshold, setThreshold] = useState("85");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [subtitleLanguage, setSubtitleLanguage] = useState("en");
  const [tagSearch, setTagSearch] = useState("");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState<number | null>(null);
  const cancelRequested = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .tags(tagSearch)
      .then(setAvailableTags)
      .catch(() => undefined);
  }, [tagSearch]);

  async function autoThumbnail(file: File): Promise<Blob | null> {
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
        canvas
          .getContext("2d")
          ?.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    if (!response.ok)
      throw new Error(`The ${assetType} could not be uploaded.`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!files.length || !folderId) return;
    setUploading(true);
    cancelRequested.current = false;
    try {
      let completedFiles = 0;
      for (const file of files) {
        const init = await api.initiateUpload({
          folder_id: Number(folderId),
          filename: file.name,
          mime_type: file.type,
          file_size: file.size,
          title: title.trim() || file.name.replace(/\.[^/.]+$/, ""),
          description: description.trim(),
          mandatory,
          completion_threshold: Number(threshold) || 85,
          comments_enabled: commentsEnabled,
          scope_mode: scope === "inherited" ? "inherited" : "override",
          access_scope: scope === "inherited" ? "company" : accessScope,
          department_ids: scope === "inherited" ? [] : departmentIds,
          grade_ids: scope === "inherited" ? [] : gradeIds,
          employee_ids: scope === "inherited" ? [] : employeeIds,
          tag_ids: tagIds,
          download_policy: allowDownload ? "allow" : "deny",
        });
        setCurrentUploadId(init.upload_id);
        const parts: Array<{ PartNumber: number; ETag: string }> = [];
        for (
          let partNumber = 1;
          partNumber <= init.total_parts;
          partNumber += 1
        ) {
          if (cancelRequested.current) throw new Error("Upload cancelled.");
          const start = (partNumber - 1) * init.part_size;
          const chunk = file.slice(
            start,
            Math.min(start + init.part_size, file.size),
          );
          const signed = await api.partUrl(init.upload_id, partNumber);
          const response = await fetch(signed.url, {
            method: "PUT",
            body: chunk,
            headers: { "Content-Type": file.type },
          });
          if (!response.ok)
            throw new Error(
              `Part ${partNumber} of ${file.name} could not be uploaded.`,
            );
          const etag = response.headers.get("ETag")?.replaceAll('"', "");
          if (!etag)
            throw new Error(
              "Cloudflare did not expose the upload ETag. Add ETag to the bucket CORS expose headers.",
            );
          const part = { PartNumber: partNumber, ETag: etag };
          parts.push(part);
          await api.recordUploadPart(init.upload_id, part);
          setProgress(
            Math.round(
              ((completedFiles + partNumber / init.total_parts) /
                files.length) *
                100,
            ),
          );
        }
        const completed = await api.completeUpload(init.upload_id, parts);
        const generated = await autoThumbnail(file);
        if (generated)
          await uploadAsset(
            completed.id,
            generated,
            thumbnailFile?.name || "thumbnail.jpg",
            "image/jpeg",
            "thumbnail",
          );
        if (subtitleFile)
          await uploadAsset(
            completed.id,
            subtitleFile,
            subtitleFile.name,
            subtitleFile.type || "text/vtt",
            "subtitle",
          );
        setCurrentUploadId(null);
        completedFiles += 1;
      }
      onSuccess();
    } catch (error) {
      if (cancelRequested.current) {
        setUploading(false);
        setCurrentUploadId(null);
        return;
      }
      onError(
        error instanceof Error ? error.message : "The video upload failed.",
      );
      setUploading(false);
    }
  }

  async function cancelUpload() {
    cancelRequested.current = true;
    if (currentUploadId)
      await api.abortUpload(currentUploadId).catch(() => undefined);
    setCurrentUploadId(null);
    setUploading(false);
  }

  const chooseVideos = (items: File[]) => {
    const chosen = items.filter((item) => item.type.startsWith("video/"));
    if (chosen.length) setFiles(chosen);
  };

  return (
    <ModalShell
      eyebrow="Add to the library"
      title="Upload a company video"
      onClose={uploading ? cancelUpload : onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Destination folder
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            required
          >
            <option value="">Choose a folder</option>
            {folders
              .filter((folder) => folder.can_edit)
              .map((folder) => (
                <option value={folder.id} key={folder.id}>
                  {folder.name}
                </option>
              ))}
          </select>
        </label>
        <div
          className="file-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseVideos(Array.from(event.dataTransfer.files));
          }}
        >
          {files.length ? (
            <>
              <div className="file-drop-icon selected">
                <Check size={21} />
              </div>
              <strong>
                {files.length} video{files.length === 1 ? "" : "s"} selected
              </strong>
              <span>
                {files
                  .slice(0, 2)
                  .map((file) => file.name)
                  .join(", ")}
                {files.length > 2 ? " …" : ""}
              </span>
            </>
          ) : (
            <>
              <div className="file-drop-icon">
                <UploadCloud size={21} />
              </div>
              <strong>Drop a video here or browse</strong>
              <span>MP4, WebM, or MOV up to 10 GB</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(event) =>
              chooseVideos(Array.from(event.target.files || []))
            }
          />
        </div>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give this video a clear title"
            required
          />
        </label>
        <div className="upload-options-grid">
          <label>
            <span>Access</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="inherited">Use folder access</option>
              <option value="override">Override for this video</option>
            </select>
          </label>
          <label>
            <span>Completion threshold</span>
            <input
              type="number"
              min="1"
              max="100"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </label>
        </div>
        {scope === "override" && (
          <AudiencePicker
            scope={accessScope}
            setScope={setAccessScope}
            departmentIds={departmentIds}
            setDepartmentIds={setDepartmentIds}
            gradeIds={gradeIds}
            setGradeIds={setGradeIds}
            employeeIds={employeeIds}
            setEmployeeIds={setEmployeeIds}
          />
        )}
        <div className="tag-picker">
          <label>
            Tags <span className="optional">Optional</span>
            <div className="search-field compact-search">
              <Search size={14} />
              <input
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder="Search library tags"
              />
            </div>
          </label>
          <div className="tag-options">
            {availableTags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={
                  tagIds.includes(tag.id) ? "tag-option selected" : "tag-option"
                }
                onClick={() =>
                  setTagIds(
                    tagIds.includes(tag.id)
                      ? tagIds.filter((id) => id !== tag.id)
                      : [...tagIds, tag.id],
                  )
                }
              >
                {tagIds.includes(tag.id) && <Check size={12} />}
                {tag.name}
              </button>
            ))}
            {!availableTags.length && (
              <span className="form-hint">
                No tags yet. Managers can add tags from the admin interface.
              </span>
            )}
          </div>
        </div>
        <div className="switch-list">
          <label className="switch-row">
            <span>
              <strong>Mandatory training</strong>
              <small>Track completion for every viewer.</small>
            </span>
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(event) => setMandatory(event.target.checked)}
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Allow comments</strong>
              <small>Let viewers discuss this video.</small>
            </span>
            <input
              type="checkbox"
              checked={commentsEnabled}
              onChange={(event) => setCommentsEnabled(event.target.checked)}
            />
          </label>
          <label className="switch-row">
            <span>
              <strong>Allow downloads</strong>
              <small>Viewers may save a copy.</small>
            </span>
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(event) => setAllowDownload(event.target.checked)}
            />
          </label>
        </div>
        <div className="asset-pickers">
          <button
            type="button"
            className="asset-picker"
            onClick={() => thumbnailInputRef.current?.click()}
          >
            <UploadCloud size={15} />
            <span>
              <strong>
                {thumbnailFile ? thumbnailFile.name : "Custom thumbnail"}
              </strong>
              <small>
                {thumbnailFile
                  ? "Selected"
                  : "Otherwise generated from the 5-second mark"}
              </small>
            </span>
          </button>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) =>
              setThumbnailFile(event.target.files?.[0] || null)
            }
          />
          <button
            type="button"
            className="asset-picker"
            onClick={() => subtitleInputRef.current?.click()}
          >
            <MessageCircle size={15} />
            <span>
              <strong>
                {subtitleFile ? subtitleFile.name : "Add subtitles"}
              </strong>
              <small>{subtitleFile ? "Selected" : "VTT or SRT captions"}</small>
            </span>
          </button>
          <input
            ref={subtitleInputRef}
            type="file"
            accept=".vtt,.srt,text/vtt,application/x-subrip"
            hidden
            onChange={(event) =>
              setSubtitleFile(event.target.files?.[0] || null)
            }
          />
          {subtitleFile && (
            <label className="subtitle-language">
              Language
              <select
                value={subtitleLanguage}
                onChange={(event) => setSubtitleLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="yo">Yoruba</option>
                <option value="ig">Igbo</option>
              </select>
            </label>
          )}
        </div>
        <label>
          Description <span className="optional">Optional</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context for your viewers"
            rows={3}
          />
        </label>
        {uploading && (
          <div className="upload-progress">
            <div className="progress-label">
              <span>Uploading securely…</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={uploading ? cancelUpload : onClose}
          >
            {" "}
            {uploading ? "Cancel upload" : "Cancel"}
          </button>
          <button
            className="primary-button"
            disabled={uploading || !files.length || !folderId}
          >
            {uploading && <LoaderCircle className="spin" size={16} />} Upload{" "}
            {files.length || ""} video{files.length === 1 ? "" : "s"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
