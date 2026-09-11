"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ModalShell } from "../shared/ModalShell";

export default function CreateAlbumModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) { setError("Album name is required."); return; }
    setLoading(true);
    setError("");
    try {
      await api.createAlbum({ name: name.trim(), description, visibility });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create album");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Create New Album" eyebrow="Albums" onClose={onClose}>
      <div className="modal-form">
        {error && <div className="alert-banner">{error}</div>}
        <label>
          Album Name *
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Visibility *
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public — all employees can view</option>
            <option value="private">Private — admin approval required</option>
          </select>
          <span className="form-hint">Private albums require manager approval before media is visible.</span>
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary-button" disabled={loading} onClick={submit}>
          {loading ? "Creating…" : "Create Album"}
        </button>
      </div>
    </ModalShell>
  );
}
