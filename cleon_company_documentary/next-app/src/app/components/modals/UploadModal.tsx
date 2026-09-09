"use client";

import {
  Check,
  MessageCircle,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { UploadBatchMetadata, UploadQueueItem } from "../../../../hooks/useUploadManager";
import type { DocumentaryFolder, Tag } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { AudiencePicker, type AudienceScope } from "./AudiencePicker";
import { ModalShell } from "./ModalShell";

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function stripExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export function UploadModal({
  folders,
  selectedFolder,
  onClose,
  onStartBatch,
}: {
  folders: DocumentaryFolder[];
  selectedFolder: DocumentaryFolder | null;
  onClose: () => void;
  onStartBatch: (queue: UploadQueueItem[], metadata: UploadBatchMetadata) => void;
}) {
  const editableFolders = folders.filter((folder) => folder.can_edit);
  const initialFolderId = String(selectedFolder?.id || editableFolders[0]?.id || "");
  const [defaultFolderId, setDefaultFolderId] = useState(initialFolderId);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
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
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .tags(tagSearch)
      .then(setAvailableTags)
      .catch(() => undefined);
  }, [tagSearch]);

  const addFiles = (items: File[]) => {
    const chosen = items.filter((item) => item.type.startsWith("video/"));
    if (!chosen.length) return;
    setQueue((prev) => {
      const existing = new Set(prev.map((item) => fileKey(item.file)));
      const next = chosen
        .filter((file) => !existing.has(fileKey(file)))
        .map((file) => ({
          id: `${fileKey(file)}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          folderId: defaultFolderId,
          title: stripExtension(file.name),
        }));
      return [...prev, ...next];
    });
  };

  const updateItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const applyDefaultFolderToAll = () => {
    setQueue((prev) => prev.map((item) => ({ ...item, folderId: defaultFolderId })));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!queue.length) return;
    if (queue.some((item) => !item.folderId)) return;

    onStartBatch(queue, {
      description,
      mandatory,
      completionThreshold: Number(threshold) || 85,
      commentsEnabled,
      scope: scope === "inherited" ? "inherited" : "override",
      accessScope,
      departmentIds,
      gradeIds,
      employeeIds,
      tagIds,
      allowDownload,
      thumbnailFile,
      subtitleFile,
      subtitleLanguage,
    });
    onClose();
  }

  return (
    <ModalShell
      eyebrow="Add to the library"
      title="Upload company videos"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div
          className="file-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          {queue.length ? (
            <>
              <div className="file-drop-icon selected">
                <Check size={21} />
              </div>
              <strong>
                {queue.length} video{queue.length === 1 ? "" : "s"} selected
              </strong>
              <span>Drop more videos or click to add another batch</span>
            </>
          ) : (
            <>
              <div className="file-drop-icon">
                <UploadCloud size={21} />
              </div>
              <strong>Drop videos here or browse</strong>
              <span>MP4, WebM, or MOV · select multiple</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
        </div>

        <div className="upload-defaults">
          <label>
            Default folder for new files
            <select
              value={defaultFolderId}
              onChange={(event) => setDefaultFolderId(event.target.value)}
            >
              <option value="">Choose a folder</option>
              {editableFolders.map((folder) => (
                <option value={folder.id} key={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          {queue.length > 1 && (
            <button type="button" className="text-button" onClick={applyDefaultFolderToAll}>
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
                  <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <label>
                  Title
                  <input
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    placeholder="Video title"
                    required
                  />
                </label>
                <label>
                  Folder
                  <select
                    value={item.folderId}
                    onChange={(event) => updateItem(item.id, { folderId: event.target.value })}
                    required
                  >
                    <option value="">Choose a folder</option>
                    {editableFolders.map((folder) => (
                      <option value={folder.id} key={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

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
          Description <span className="optional">Optional · applies to all</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context for your viewers"
            rows={3}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!queue.length || queue.some((item) => !item.folderId)}
          >
            Upload {queue.length || ""} video{queue.length === 1 ? "" : "s"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
