"use client";

import type { DocumentType } from "../../../../lib/types";

type Props = {
  documentTypes: DocumentType[];
  requiredTypeIds: number[];
  verificationTypeIds: number[];
  onChange: (verificationTypeIds: number[]) => void;
};

export function PolicyVerificationDocumentTypePicker({
  documentTypes,
  requiredTypeIds,
  verificationTypeIds,
  onChange,
}: Props) {
  const required = new Set(requiredTypeIds);
  const options = documentTypes.filter((type) => required.has(type.id));

  if (!options.length) {
    return (
      <p className="text-sm text-slate-500">
        Add required document types in the previous step to choose which need
        manual verification.
      </p>
    );
  }

  const verified = new Set(verificationTypeIds);

  return (
    <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      {options.map((type) => {
        const checked = verified.has(type.id);
        return (
          <li key={type.id}>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-pink-600"
                checked={checked}
                onChange={(e) => {
                  const next = new Set(verificationTypeIds);
                  if (e.target.checked) {
                    next.add(type.id);
                  } else {
                    next.delete(type.id);
                  }
                  onChange(Array.from(next));
                }}
              />
              <span className="font-medium">{type.name}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
