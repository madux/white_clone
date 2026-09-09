"use client";

import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { AudiencePicker, type AudienceScope } from "./AudiencePicker";
import { ModalShell } from "./ModalShell";

export function MediaEditModal({
  media,
  onClose,
  onSaved,
  onError,
}: {
  media: DocumentaryMedia;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(media.title);
  const [description, setDescription] = useState(media.description || "");
  const [scopeMode, setScopeMode] = useState(media.scope_mode);
  const [scope, setScope] = useState<AudienceScope>(
    media.access_scope as AudienceScope,
  );
  const [departmentIds, setDepartmentIds] = useState(
    media.department_ids || [],
  );
  const [gradeIds, setGradeIds] = useState(media.grade_ids || []);
  const [employeeIds, setEmployeeIds] = useState(media.employee_ids || []);
  const [mandatory, setMandatory] = useState(media.mandatory);
  const [commentsEnabled, setCommentsEnabled] = useState(
    media.comments_enabled,
  );
  const [downloadPolicy, setDownloadPolicy] = useState(
    media.download_allowed ? "allow" : "deny",
  );
  const [transcript, setTranscript] = useState(media.transcript || "");
  const [publishAt, setPublishAt] = useState(
    media.publish_at ? String(media.publish_at).slice(0, 16) : "",
  );
  const [chaptersText, setChaptersText] = useState(
    (media.chapters || [])
      .map((chapter) => `${chapter.start_seconds}|${chapter.title}`)
      .join("\n"),
  );
  const [loading, setLoading] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const chapters = chaptersText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [start, ...rest] = line.split("|");
          return { start_seconds: Number(start), title: rest.join("|").trim() || "Chapter" };
        })
        .filter((chapter) => !Number.isNaN(chapter.start_seconds));
      await api.updateMedia({
        id: media.id,
        name,
        description,
        mandatory,
        comments_enabled: commentsEnabled,
        download_policy: downloadPolicy as "allow" | "deny",
        scope_mode: scopeMode,
        access_scope: scope,
        department_ids: scopeMode === "override" ? departmentIds : [],
        grade_ids: scopeMode === "override" ? gradeIds : [],
        employee_ids: scopeMode === "override" ? employeeIds : [],
        transcript,
        chapters,
        publish_at: publishAt || false,
      });
      onSaved();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Video settings could not be updated.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <ModalShell eyebrow="Manager controls" title="Edit video" onClose={onClose}>
      <form className="modal-form" onSubmit={save}>
        <label>
          Title
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
        <div className="upload-options-grid">
          <label>
            Visibility
            <select
              value={scopeMode}
              onChange={(event) =>
                setScopeMode(event.target.value as "inherited" | "override")
              }
            >
              <option value="inherited">Inherit folder access</option>
              <option value="override">Stricter video access</option>
            </select>
          </label>
          <label>
            Downloads
            <select
              value={downloadPolicy}
              onChange={(event) => setDownloadPolicy(event.target.value)}
            >
              <option value="allow">Allowed</option>
              <option value="deny">Blocked</option>
            </select>
          </label>
        </div>
        {scopeMode === "override" && (
          <AudiencePicker
            scope={scope}
            setScope={setScope}
            departmentIds={departmentIds}
            setDepartmentIds={setDepartmentIds}
            gradeIds={gradeIds}
            setGradeIds={setGradeIds}
            employeeIds={employeeIds}
            setEmployeeIds={setEmployeeIds}
          />
        )}
        <div className="switch-list">
          <label className="switch-row">
            <span>
              <strong>Mandatory training</strong>
              <small>Include this video in completion reporting.</small>
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
              <small>Let viewers leave context below the player.</small>
            </span>
            <input
              type="checkbox"
              checked={commentsEnabled}
              onChange={(event) => setCommentsEnabled(event.target.checked)}
            />
          </label>
        </div>
        <label>
          Publishing schedule
          <input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
        </label>
        <label>
          Transcript
          <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} placeholder="Paste or edit the video transcript" />
        </label>
        <label>
          Chapters
          <textarea value={chaptersText} onChange={(event) => setChaptersText(event.target.value)} rows={4} placeholder="seconds|Chapter title (one per line)" />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={loading || !name.trim()}>
            {loading && <LoaderCircle className="spin" size={15} />} Save
            changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
