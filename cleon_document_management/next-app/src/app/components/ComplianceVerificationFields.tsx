"use client";

import type { PolicyCreateFormState } from "../../../lib/policyCreateForm";
import type { DocumentType } from "../../../lib/types";
import { VERIFIED_BY_OPTIONS, approverHandoffTypes } from "../../../lib/verificationPolicy";
import ApproverHandoffNotice from "./ApproverHandoffNotice";
import ThemedSelect from "./ThemedSelect";

export default function ComplianceVerificationFields({
  form,
  setForm,
  typeCode = "",
  documentTypes,
  entityName = "rule",
}: {
  form: PolicyCreateFormState;
  setForm: (next: PolicyCreateFormState) => void;
  typeCode?: string;
  documentTypes?: DocumentType[];
  entityName?: "rule" | "policy";
}) {
  const handoffTypes = approverHandoffTypes(form, typeCode, documentTypes);
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
      <ApproverHandoffNotice
        types={handoffTypes}
        verifiedBy={form.verified_by}
        entityName={entityName}
        className="sm:col-span-2"
      />
    </div>
  );
}
