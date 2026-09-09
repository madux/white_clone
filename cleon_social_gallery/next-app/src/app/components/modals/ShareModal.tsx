"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { api } from "@/lib/api";
import { ModalShell } from "../shared/ModalShell";

export default function ShareModal({
  mediaId,
  allowExternalShare = false,
  onClose,
}: {
  mediaId: number;
  allowExternalShare?: boolean;
  onClose: () => void;
}) {
  const [isExternal, setIsExternal] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setError("");
    if (isExternal && !allowExternalShare) {
      setError("External sharing is disabled in gallery settings.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.share({
        action: "create",
        media_id: mediaId,
        is_external: isExternal,
        password: password || undefined,
        expires_at: expiresOn || undefined,
      });
      const absolute = result.url.startsWith("http")
        ? result.url
        : `${window.location.origin}${result.url}`;
      setResultUrl(absolute);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!resultUrl) return;
    await navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalShell title="Share Media" eyebrow="Gallery" onClose={onClose}>
      <div className="modal-form">
        {error && <div className="alert-banner">{error}</div>}
        <div className="segmented-options">
          <button type="button" className={`segmented-option ${!isExternal ? "active" : ""}`} onClick={() => setIsExternal(false)}>
            <strong>Internal Link</strong>
            <span>Visible to signed-in employees</span>
          </button>
          <button
            type="button"
            className={`segmented-option ${isExternal ? "active" : ""}`}
            onClick={() => setIsExternal(true)}
            disabled={!allowExternalShare}
          >
            <strong>External Link</strong>
            <span>{allowExternalShare ? "Share outside your organization" : "Disabled by admin"}</span>
          </button>
        </div>
        <label>
          Password <span className="optional">(optional)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Expires on
          <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>
        {resultUrl ? (
          <label>
            Share link
            <div className="contributor-row">
              <input readOnly value={resultUrl} />
              <button type="button" className="secondary-button small" onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </label>
        ) : null}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        {!resultUrl && (
          <button type="button" className="primary-button" disabled={loading} onClick={create}>
            {loading ? "Creating…" : "Create Link"}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
