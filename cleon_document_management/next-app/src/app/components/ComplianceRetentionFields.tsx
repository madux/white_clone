"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import { buildScopePayload } from "../../../lib/policyScope";
import { api } from "../../../lib/api";
import {
  RetentionActionModeFields,
  RetentionSettingsRulesTable,
  useRetentionSettingRules,
} from "./compliance/retentionPolicyFields";

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

export default function ComplianceRetentionFields({
  form,
  setForm,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
}) {
  const { rules, loading, missingTypeIds } = useRetentionSettingRules(
    form.document_type_ids,
  );

  return (
    <>
      <Field label="Retention rules (from Settings)" full>
        <RetentionSettingsRulesTable
          documentTypeIds={form.document_type_ids}
          rules={rules}
          loading={loading}
          missingTypeIds={missingTypeIds}
        />
      </Field>
      <RetentionActionModeFields
        form={form}
        setForm={setForm}
        layout="grid"
      />
    </>
  );
}

export function useRetentionPreview(
  form: PolicyCreateFormState,
  enabled: boolean,
) {
  const [preview, setPreview] = useState<{
    archive_within_90_days: number;
    delete_within_90_days: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !form.document_type_ids.length) {
      setPreview(null);
      return;
    }
    const scope = buildScopePayload(form.scope);
    void api
      .retentionPreview({
        document_type_ids: form.document_type_ids,
        applies_to: scope.applies_to,
        department_ids: scope.department_ids,
        grade_ids: scope.grade_ids,
        employee_ids: scope.employee_ids,
        work_location_ids: scope.work_location_ids,
        employment_type_ids: scope.employment_type_ids,
        branch_ids: scope.branch_ids,
      })
      .then((result) => {
        if (result.success && result.data) {
          setPreview(result.data);
        }
      });
  }, [
    enabled,
    form.document_type_ids.join(","),
    form.applies_to,
    form.scope,
  ]);

  return preview;
}
