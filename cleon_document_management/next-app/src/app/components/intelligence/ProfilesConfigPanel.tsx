"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  useArchiveIntelligenceProfile,
  useCreateIntelligenceProfile,
  useIntelligenceProfiles,
  useIntelligenceTypes,
  useNewIntelligenceProfileVersion,
  useUpdateIntelligenceProfile,
} from "../../../../hooks/useIntelligence";
import type { IntelligenceField, IntelligenceProfile } from "../../../../lib/intelligence-api";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";
import ModalDialog from "../ModalDialog";

const EMPTY_FIELD: IntelligenceField = {
  name: "",
  key: "",
  field_type: "text",
  required: false,
  description: "",
  example: "",
};

export default function ProfilesConfigPanel() {
  const profiles = useIntelligenceProfiles();
  const types = useIntelligenceTypes();
  const createProfile = useCreateIntelligenceProfile();
  const updateProfile = useUpdateIntelligenceProfile();
  const archiveProfile = useArchiveIntelligenceProfile();
  const newVersion = useNewIntelligenceProfileVersion();
  const [editing, setEditing] = useState<Partial<IntelligenceProfile> | null>(
    null,
  );
  const [error, setError] = useState("");

  const fieldRows = useMemo(
    () => editing?.fields ?? [{ ...EMPTY_FIELD }],
    [editing],
  );

  const openCreate = () => {
    setEditing({
      name: "",
      document_type_id: types.data?.[0]?.id,
      extraction_instructions: "",
      examples: "",
      fields: [{ ...EMPTY_FIELD, name: "Employee name", key: "employee_name" }],
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setError("");
    const payload = {
      id: editing.id,
      name: editing.name,
      document_type_id: editing.document_type_id,
      extraction_instructions: editing.extraction_instructions,
      examples: editing.examples,
      fields: (editing.fields || []).filter((field) => field.name && field.key),
    };
    if (!payload.name || !payload.document_type_id) {
      setError("Name and document type are required.");
      return;
    }
    if (!payload.fields.length) {
      setError("Add at least one field.");
      return;
    }
    try {
      if (editing.id) {
        await updateProfile.mutateAsync(payload);
      } else {
        await createProfile.mutateAsync(payload);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
          onClick={openCreate}
        >
          Add profile
        </button>
      </div>
      {error ? <IntelligenceError message={error} /> : null}
      {profiles.isError ? (
        <IntelligenceError message="Profiles could not be loaded. Confirm Odoo is running and you are signed in." />
      ) : null}
      {profiles.isLoading ? (
        <IntelligenceLoading />
      ) : profiles.data?.length ? (
        <div className="space-y-3">
          {profiles.data.map((profile) => (
            <div
              key={profile.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{profile.name}</h3>
                  <p className="text-sm text-slate-500">
                    {profile.document_type} · version {profile.version} ·{" "}
                    {profile.fields.length} fields
                    {profile.is_system ? " · system" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand-pink"
                    onClick={() => setEditing(profile)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-500"
                    onClick={() => newVersion.mutate(profile.id)}
                  >
                    New version
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-500"
                    onClick={() =>
                      archiveProfile.mutate({
                        id: profile.id,
                        active: !profile.active,
                      })
                    }
                  >
                    {profile.active ? "Archive" : "Restore"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <IntelligenceEmpty
          title="No extraction profiles"
          description="A profile defines fields, instructions, and the version a dataset will keep."
        />
      )}

      {editing ? (
        <ModalDialog
          title={editing.id ? "Edit profile" : "New profile"}
          onClose={() => setEditing(null)}
          size="2xl"
          titleClassName="text-xl"
          backdropClassName="bg-slate-900/40"
        >
          <form onSubmit={save}>
            <label className="mt-4 block">
              <span className="label">Name</span>
              <input
                className="field"
                value={editing.name || ""}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Document type</span>
              <select
                className="field"
                value={editing.document_type_id || ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    document_type_id: Number(event.target.value),
                  })
                }
              >
                {(types.data || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">Extraction instructions</span>
              <textarea
                className="field min-h-20"
                value={editing.extraction_instructions || ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    extraction_instructions: event.target.value,
                  })
                }
              />
            </label>
            <div className="mt-4 space-y-3">
              <p className="label">Fields</p>
              {fieldRows.map((field, index) => (
                <div
                  key={`${field.key}-${index}`}
                  className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2"
                >
                  <input
                    className="field"
                    placeholder="Label"
                    value={field.name}
                    onChange={(event) => {
                      const fields = [...fieldRows];
                      fields[index] = { ...field, name: event.target.value };
                      setEditing({ ...editing, fields });
                    }}
                  />
                  <input
                    className="field"
                    placeholder="key"
                    value={field.key}
                    onChange={(event) => {
                      const fields = [...fieldRows];
                      fields[index] = { ...field, key: event.target.value };
                      setEditing({ ...editing, fields });
                    }}
                  />
                  <select
                    className="field"
                    value={field.field_type}
                    onChange={(event) => {
                      const fields = [...fieldRows];
                      fields[index] = {
                        ...field,
                        field_type: event.target.value,
                      };
                      setEditing({ ...editing, fields });
                    }}
                  >
                    {[
                      "text",
                      "date",
                      "email",
                      "phone",
                      "integer",
                      "decimal",
                      "currency",
                      "boolean",
                      "employee_reference",
                    ].map((typeName) => (
                      <option key={typeName} value={typeName}>
                        {typeName}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => {
                        const fields = [...fieldRows];
                        fields[index] = {
                          ...field,
                          required: event.target.checked,
                        };
                        setEditing({ ...editing, fields });
                      }}
                    />
                    Required
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-brand-pink"
                onClick={() =>
                  setEditing({
                    ...editing,
                    fields: [...fieldRows, { ...EMPTY_FIELD }],
                  })
                }
              >
                Add field
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
