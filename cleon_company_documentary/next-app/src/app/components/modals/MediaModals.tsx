"use client";

import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { AudiencePicker, type AudienceScope } from "./AudiencePicker";
import { ModalShell } from "./ModalShell";
import { MediaLifecyclePanel } from "../media/MediaLifecyclePanel";

export function MediaEditModal({
  media,
  canSetHero = false,
  isAdministrator = false,
  isSupervisor = false,
  userId,
  onClose,
  onSaved,
  onError,
}: {
  media: DocumentaryMedia;
  canSetHero?: boolean;
  isAdministrator?: boolean;
  isSupervisor?: boolean;
  userId?: number;
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
  const [category, setCategory] = useState(media.category || "general");
  const [keywords, setKeywords] = useState(media.keywords || "");
  const [isInternalOnly, setIsInternalOnly] = useState(media.is_internal_only || false);
  const [isHero, setIsHero] = useState(Boolean(media.is_hero));
  const [downloadPolicy, setDownloadPolicy] = useState(
    media.download_allowed ? "allow" : "deny",
  );
  const [transcript, setTranscript] = useState(media.transcript || "");
  const [chaptersText, setChaptersText] = useState(
    (media.chapters || [])
      .map((chapter) => `${chapter.start_seconds}|${chapter.title}`)
      .join("\n"),
  );
  const [loading, setLoading] = useState(false);
  const [lifecycleMedia, setLifecycleMedia] = useState(media);
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
        download_policy: downloadPolicy as "allow" | "deny",
        scope_mode: scopeMode,
        access_scope: scope,
        department_ids: scopeMode === "override" ? departmentIds : [],
        category,
        keywords,
        is_internal_only: isInternalOnly,
        ...(canSetHero ? { is_hero: isHero } : {}),
        transcript,
        chapters,
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
          />
        )}
        <MediaLifecyclePanel
          media={lifecycleMedia}
          isAdministrator={isAdministrator}
          isSupervisor={isSupervisor}
          userId={userId}
          compact
          onUpdated={(updated) => setLifecycleMedia(updated)}
          onError={onError}
        />
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="general">General</option>
            <option value="onboarding">Onboarding</option>
            <option value="training">Training</option>
            <option value="marketing">Marketing</option>
            <option value="hr_updates">HR Updates</option>
            <option value="company_events">Company Events</option>
            <option value="product_launches">Product Launches</option>
          </select>
        </label>
        <label>
          Keywords
          <input value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </label>
        <label className="switch-row">
          <span>
            <strong>Internal only</strong>
          </span>
          <input
            type="checkbox"
            checked={isInternalOnly}
            onChange={(event) => setIsInternalOnly(event.target.checked)}
          />
        </label>
        {canSetHero ? (
          <label className="switch-row">
            <span>
              <strong>Home hero video</strong>
              <small className="form-hint">Featured on Documentary Home (replaces latest-video default).</small>
            </span>
            <input
              type="checkbox"
              checked={isHero}
              onChange={(event) => setIsHero(event.target.checked)}
            />
          </label>
        ) : null}
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
