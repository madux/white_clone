"use client";

import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import { VERIFIED_BY_OPTIONS } from "../../../lib/verificationPolicy";
import ThemedSelect from "./ThemedSelect";

export default function ComplianceVerificationFields({
  form,
  setForm,
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
}) {
  return (
    <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
      <label>
        <span className="label">Verified by</span>
        <ThemedSelect
          value={form.verified_by}
          onChange={(value) => setForm({ ...form, verified_by: value })}
          options={VERIFIED_BY_OPTIONS}
        />
      </label>
      <label>
        <span className="label">Verification SLA (days)</span>
        <input
          type="number"
          min={1}
          className="field"
          value={form.verification_sla_days}
          onChange={(e) =>
            setForm({
              ...form,
              verification_sla_days: Math.max(1, Number(e.target.value) || 3),
            })
          }
        />
      </label>
      <p className="sm:col-span-2 text-xs text-slate-500">
        Applies when linked document types require verification. Submitted evidence
        routes to My Workspace → Approvals for the selected verifier.
      </p>
    </div>
  );
}
