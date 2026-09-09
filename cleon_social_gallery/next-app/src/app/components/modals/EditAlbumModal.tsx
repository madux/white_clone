"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";
import { useGalleryMutations } from "@/hooks/useSocialGallery";
import { ModalShell } from "../shared/ModalShell";

export default function EditAlbumModal({
  album,
  onClose,
  onSaved,
  isManager,
}: {
  album: GalleryAlbum;
  onClose: () => void;
  onSaved: () => void;
  isManager: boolean;
}) {
  const { updateAlbum, albumAction, pinAlbum } = useGalleryMutations();
  const [name, setName] = useState(album.name);
  const [description, setDescription] = useState(album.description);
  const [visibility, setVisibility] = useState(album.visibility);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await updateAlbum.mutateAsync({
        id: album.id,
        name: name.trim(),
        description,
        visibility,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save album");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: string) => {
    setError("");
    setSaving(true);
    try {
      await albumAction.mutateAsync({ id: album.id, action });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async () => {
    setError("");
    try {
      await pinAlbum.mutateAsync({ id: album.id, pinned: !album.is_pinned });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pin");
    }
  };

  return (
    <ModalShell title="Edit Album" eyebrow="Gallery" onClose={onClose}>
      <div className="modal-form">
        {error && <div className="alert-banner">{error}</div>}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!album.can_edit} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!album.can_edit} />
        </label>
        <label>
          Visibility
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")} disabled={!album.can_edit}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>
        {album.status !== "approved" && isManager && (
          <div className="primary-actions">
            <button type="button" className="secondary-button small" onClick={() => runAction("approve")}>Approve Album</button>
            <button type="button" className="danger-button small" onClick={() => runAction("reject")}>Reject Album</button>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={togglePin}>
          {album.is_pinned ? "Unpin" : "Pin"} Album
        </button>
        {album.can_edit && (
          <>
            <button type="button" className="text-button danger" onClick={() => runAction("archive")}>Archive</button>
            <button type="button" className="text-button danger" onClick={() => runAction("delete")}>Delete</button>
          </>
        )}
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        {album.can_edit && (
          <button type="button" className="primary-button" disabled={saving || !name.trim()} onClick={save}>
            {saving ? <LoaderCircle size={16} className="spin" /> : null}
            Save
          </button>
        )}
      </div>
    </ModalShell>
  );
}
