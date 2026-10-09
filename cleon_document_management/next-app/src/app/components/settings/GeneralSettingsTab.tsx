"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import { useToast } from "../../../../hooks/useToast";

export default function GeneralSettingsTab() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [platformName, setPlatformName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [recycleDays, setRecycleDays] = useState(30);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [mailFrom, setMailFrom] = useState("");
  const [mailFromName, setMailFromName] = useState("");
  const [testingMail, setTestingMail] = useState(false);

  useEffect(() => {
    let active = true;
    dmsContractsApi.settingsRead().then((result) => {
      if (!active || !result.success) return;
      const data = result.data;
      const general = data.general || {};
      setPlatformName(String(general.platform_name || ""));
      setTimezone(String(general.timezone || "UTC"));
      setRecycleDays(Number(general.recycle_bin_retention_days || 30));
      setSmtpHost(String(general.mail_smtp_host || ""));
      setSmtpPort(String(general.mail_smtp_port || "587"));
      setMailFrom(String(general.mail_from_address || ""));
      setMailFromName(String(general.mail_from_name || ""));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    const result = await dmsContractsApi.generalSave({
      mail_smtp_host: smtpHost,
      mail_smtp_port: smtpPort,
      mail_from_address: mailFrom,
      mail_from_name: mailFromName,
      org_timezone: timezone,
    });
    if (result.success) showToast("General settings saved.");
    else showToast("Could not save general settings.", "error");
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading general settings…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Organisation</h2>
        <p className="text-xs text-slate-500">
          Platform name is read-only (from company record).
        </p>
        <label className="block text-xs font-semibold text-slate-600">
          Platform name
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            value={platformName}
            readOnly
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Time zone
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Recycle bin retention (days)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={recycleDays}
            readOnly
          />
        </label>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Mail server (Super Admin)</h2>
        <p className="text-xs text-slate-500">
          Notification reminders and digests are sent at 09:00 in the organisation time
          zone above.
        </p>
        <label className="block text-xs font-semibold text-slate-600">
          SMTP host
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          SMTP port
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={smtpPort}
            onChange={(e) => setSmtpPort(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Sender name
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={mailFromName}
            onChange={(e) => setMailFromName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Sender address
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={mailFrom}
            onChange={(e) => setMailFrom(e.target.value)}
          />
        </label>
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
      </section>
      <button
        type="button"
        onClick={save}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white"
      >
        <Save className="h-4 w-4" /> Save general
      </button>
    </div>
  );
}
