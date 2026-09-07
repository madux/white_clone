"use client";

import { Check, LoaderCircle, Settings2, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
  const [loading, setLoading] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
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

export function StorageSettingsModal({
  onClose,
  onError,
  onSuccess,
}: {
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [bucket, setBucket] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    configured?: boolean;
    reachable?: boolean;
  } | null>(null);
  useEffect(() => {
    api
      .storageConfig()
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.storageConfig(
        {
          bucket,
          endpoint_url: endpoint,
          access_key_id: accessKey,
          secret_access_key: secretKey,
        },
        true,
      );
      setStatus(result);
      onSuccess(
        result.reachable
          ? "Storage connected successfully."
          : "Storage settings saved.",
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Storage settings could not be saved.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <ModalShell
      eyebrow="Administrator only"
      title="Storage settings"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={save}>
        <p className="form-hint">
          <ShieldCheck size={14} /> Credentials are saved server-side and never
          exposed to employees.
        </p>
        <label>
          Bucket
          <input
            value={bucket}
            onChange={(event) => setBucket(event.target.value)}
            placeholder="company-documentary"
          />
        </label>
        <label>
          Endpoint URL
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://&lt;account&gt;.r2.cloudflarestorage.com"
          />
        </label>
        <label>
          Access key
          <input
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            placeholder="Paste the R2 access key"
          />
        </label>
        <label>
          Secret key
          <input
            type="password"
            value={secretKey}
            onChange={(event) => setSecretKey(event.target.value)}
            placeholder="Paste the R2 secret key"
          />
        </label>
        {status && (
          <div
            className={
              status.reachable
                ? "connection-status connected"
                : "connection-status"
            }
          >
            {status.reachable ? <Check size={15} /> : <Settings2 size={15} />}{" "}
            {status.reachable
              ? "Cloudflare R2 is reachable."
              : status.configured
                ? "Credentials are saved; run a connection check after confirming the endpoint."
                : "Cloudflare R2 is not configured yet."}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={loading}>
            {loading && <LoaderCircle className="spin" size={15} />} Save and
            check
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
