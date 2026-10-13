"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import { useToast } from "../../../../hooks/useToast";
import { useInvalidateDmsLocale } from "../../../../hooks/useDmsLocale";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";

export default function GeneralEmailDeliveryPanel() {
  const { showToast } = useToast();
  const invalidateLocale = useInvalidateDmsLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingMail, setTestingMail] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [mailFrom, setMailFrom] = useState("");
  const [mailFromName, setMailFromName] = useState("");

  useEffect(() => {
    dmsContractsApi.settingsRead().then((result) => {
      if (!result.success) return;
      const general = result.data?.general || {};
      setSmtpHost(String(general.mail_smtp_host || ""));
      setSmtpPort(String(general.mail_smtp_port || "587"));
      setMailFrom(String(general.mail_from_address || ""));
      setMailFromName(String(general.mail_from_name || ""));
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const result = await dmsContractsApi.generalSave({
      mail_smtp_host: smtpHost,
      mail_smtp_port: smtpPort,
      mail_from_address: mailFrom,
      mail_from_name: mailFromName,
    });
    setSaving(false);
    if (result.success) {
      showToast("Email delivery settings saved.");
      invalidateLocale();
    } else {
      showToast(result.message || "Could not save email settings.", "error");
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading email delivery…</p>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
      <div className="flex justify-end">
        <SettingsFieldHelp
          label="Email delivery"
          text="SMTP used for notification emails. Reminder and digest times are set on the General tab."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold text-slate-600">SMTP host</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={smtpHost}
            onChange={(event) => setSmtpHost(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">SMTP port</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={smtpPort}
            onChange={(event) => setSmtpPort(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-600">Sender name</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={mailFromName}
            onChange={(event) => setMailFromName(event.target.value)}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-semibold text-slate-600">Sender address</span>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={mailFrom}
            onChange={(event) => setMailFrom(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={testingMail}
          onClick={async () => {
            setTestingMail(true);
            const result = await dmsContractsApi.generalTestEmail();
            setTestingMail(false);
            if (result.success) showToast("Test email sent.");
            else showToast(result.message || "Test email failed.", "error");
          }}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {testingMail ? "Sending…" : "Send test email"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save email settings"}
        </button>
      </div>
    </section>
  );
}
