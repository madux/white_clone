"use client";

import { FolderOpen, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { DocumentaryFolder } from "../../../../lib/types";
import { AudiencePicker, type AudienceScope } from "./AudiencePicker";
import { ModalShell } from "./ModalShell";

export type FolderSaveValues = {
  id?: number;
  name: string;
  description: string;
  parent_id?: number | false;
  access_scope?: string;
  department_ids?: number[];
  grade_ids?: number[];
  employee_ids?: number[];
  editor_ids?: number[];
  allow_download?: boolean;
};

export function CreateFolderModal({
  folders,
  loading,
  parentName,
  defaultParentId,
  initialFolder,
  onClose,
  onSave,
}: {
  folders: DocumentaryFolder[];
  loading: boolean;
  parentName?: string;
  defaultParentId?: number;
  onClose: () => void;
  initialFolder?: DocumentaryFolder;
  onSave: (values: FolderSaveValues) => void;
}) {
  const [name, setName] = useState(initialFolder?.name || "");
  const [description, setDescription] = useState(
    initialFolder?.description || "",
  );
  const [parentId, setParentId] = useState(
    String(initialFolder?.parent_id || defaultParentId || ""),
  );
  const [scope, setScope] = useState<AudienceScope>(
    (initialFolder?.access_scope as AudienceScope) || "company",
  );
  const [departmentIds, setDepartmentIds] = useState(
    initialFolder?.department_ids || [],
  );
  const [gradeIds, setGradeIds] = useState(initialFolder?.grade_ids || []);
  const [employeeIds, setEmployeeIds] = useState(
    initialFolder?.employee_ids || [],
  );
  const [allowDownload, setAllowDownload] = useState(
    initialFolder?.allow_download || false,
  );
  return (
    <ModalShell
      eyebrow="Organize the library"
      title={initialFolder ? "Edit folder" : "Create a folder"}
      onClose={onClose}
    >
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim())
            onSave({
              id: initialFolder?.id,
              name: name.trim(),
              description: description.trim(),
              parent_id: parentId ? Number(parentId) : false,
              access_scope: scope,
              department_ids: departmentIds,
              grade_ids: gradeIds,
              employee_ids: employeeIds,
              allow_download: allowDownload,
            });
        }}
      >
        <label>
          Folder name
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. New starter stories"
            required
          />
        </label>
        <label>
          Description <span className="optional">Optional</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs in this space?"
            rows={3}
          />
        </label>
        {parentName && (
          <p className="form-hint">
            <FolderOpen size={14} /> This folder will be nested inside{" "}
            <strong>{parentName}</strong>.
          </p>
        )}
        <label>
          Parent folder <span className="optional">Optional</span>
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Root of company library</option>
            {folders
              .filter((folder) => folder.id !== initialFolder?.id)
              .map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
          </select>
        </label>
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
        <label className="switch-row">
          <span>
            <strong>Allow downloads</strong>
            <small>
              Viewers can save an offline copy of videos in this folder.
            </small>
          </span>
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(event) => setAllowDownload(event.target.checked)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={loading || !name.trim()}>
            {loading && <LoaderCircle className="spin" size={16} />}{" "}
            {initialFolder ? "Save changes" : "Create folder"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function BatchShareModal({
  count,
  onClose,
  onSave,
}: {
  count: number;
  onClose: () => void;
  onSave: (
    scope: string,
    departmentIds: number[],
    gradeIds: number[],
    employeeIds: number[],
  ) => void;
}) {
  const [scope, setScope] = useState<AudienceScope>("department");
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [gradeIds, setGradeIds] = useState<number[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  return (
    <ModalShell
      eyebrow="Bulk access"
      title={`Share ${count} video${count === 1 ? "" : "s"}`}
      onClose={onClose}
    >
      <div className="modal-form">
        <p className="form-hint">
          Sharing can only make access stricter than the parent folder.
          Company-wide items inherit their folder audience.
        </p>
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
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={() => onSave(scope, departmentIds, gradeIds, employeeIds)}
          >
            Apply access
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
