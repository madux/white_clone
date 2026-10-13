"use client";

import { cn } from "cn";
import { MoreHorizontal, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { dmsContractsApi } from "../../../../lib/dmsContractsApi";
import { formatDmsDate } from "../../../../lib/dmsLocale";
import { useInvalidateDmsLocale } from "../../../../hooks/useDmsLocale";
import { useAppDialog } from "../../../../hooks/useAppDialog";
import { useToast } from "../../../../hooks/useToast";
import AppSelect from "../AppSelect";
import ThemedSelect from "../ThemedSelect";
import GeneralHolidayDialog, {
  type HolidayFormValues,
} from "./GeneralHolidayDialog";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";

function GeneralCardHeader({
  title,
  help,
  trailing,
}: {
  title: string;
  help: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <SettingsFieldHelp label={title} text={help} />
      </div>
      {trailing}
    </div>
  );
}

type HolidayRow = { id: number; name: string; date: string; year: number };

type StorageBreakdown = {
  key: string;
  label: string;
  bytes: number;
};

type GeneralPayload = {
  organisation_name?: string;
  organisation_name_readonly_hint?: string;
  logo_label?: string;
  timezone?: string;
  timezone_options?: { value: string; label: string }[];
  date_format?: string;
  date_format_options?: { value: string; label: string }[];
  language?: string;
  language_options?: { value: string; label: string }[];
  working_weekdays?: number[];
  reminder_digest_time?: string;
  holidays_year?: number;
  holidays?: HolidayRow[];
  storage?: {
    used_bytes: number;
    quota_bytes: number;
    quota_gb: number;
    used_percent: number;
    breakdown: StorageBreakdown[];
    largest_folders: { id: number; name: string; bytes: number }[];
    alert_thresholds: number[];
  };
};

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 0, label: "Mon" },
  { id: 1, label: "Tue" },
  { id: 2, label: "Wed" },
  { id: 3, label: "Thu" },
  { id: 4, label: "Fri" },
  { id: 5, label: "Sat" },
  { id: 6, label: "Sun" },
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function GeneralSettingsTab() {
  const { showToast } = useToast();
  const { showConfirm } = useAppDialog();
  const invalidateLocale = useInvalidateDmsLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("d_mmm_yyyy");
  const [language, setLanguage] = useState("en_GB");
  const [workingWeekdays, setWorkingWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [digestTime, setDigestTime] = useState("09:00");
  const [orgName, setOrgName] = useState("");
  const [orgHint, setOrgHint] = useState("");
  const [logoLabel, setLogoLabel] = useState("");
  const [timezoneOptions, setTimezoneOptions] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [dateFormatOptions, setDateFormatOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [languageOptions, setLanguageOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [storage, setStorage] = useState<GeneralPayload["storage"]>();
  const [holidayMenuId, setHolidayMenuId] = useState<number | null>(null);
  const [holidayDialog, setHolidayDialog] = useState<HolidayFormValues | null>(null);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => {
      const year = current - 2 + index;
      return { value: String(year), label: String(year) };
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await dmsContractsApi.settingsRead();
    if (!result.success) {
      setLoading(false);
      return;
    }
    const general = (result.data?.general || {}) as GeneralPayload;
    setOrgName(String(general.organisation_name || ""));
    setOrgHint(
      String(
        general.organisation_name_readonly_hint ||
          "Change this in CleonHR platform settings",
      ),
    );
    setLogoLabel(String(general.logo_label || "Logo (from platform)"));
    setTimezone(String(general.timezone || "UTC"));
    setDateFormat(String(general.date_format || "d_mmm_yyyy"));
    setLanguage(String(general.language || "en_GB"));
    setWorkingWeekdays(
      Array.isArray(general.working_weekdays) ? general.working_weekdays : [0, 1, 2, 3, 4],
    );
    setDigestTime(String(general.reminder_digest_time || "09:00"));
    setTimezoneOptions(general.timezone_options || []);
    setDateFormatOptions(general.date_format_options || []);
    setLanguageOptions(general.language_options || []);
    setHolidays(general.holidays || []);
    setHolidayYear(Number(general.holidays_year || new Date().getFullYear()));
    setStorage(general.storage);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHolidaysForYear = useCallback(async (year: number) => {
    setHolidaysLoading(true);
    const result = await dmsContractsApi.generalHolidaysList(year);
    setHolidaysLoading(false);
    if (result.success) {
      setHolidays((result.holidays as HolidayRow[]) || []);
      if (result.year) setHolidayYear(result.year);
    }
  }, []);

  const maxBreakdownBytes = useMemo(() => {
    if (!storage?.breakdown?.length) return 1;
    return Math.max(...storage.breakdown.map((row) => row.bytes), 1);
  }, [storage]);

  const toggleWeekday = (day: number) => {
    setWorkingWeekdays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day);
        return next.length ? next : current;
      }
      return [...current, day].sort((a, b) => a - b);
    });
  };

  const save = async () => {
    setSaving(true);
    const result = await dmsContractsApi.generalSave({
      org_timezone: timezone,
      timezone,
      date_format: dateFormat,
      language,
      working_weekdays: workingWeekdays,
      reminder_digest_time: digestTime,
    });
    setSaving(false);
    if (result.success) {
      showToast("General settings saved.");
      invalidateLocale();
      void load();
    } else {
      showToast(result.message || "Could not save general settings.", "error");
    }
  };

  const saveHoliday = async (values: HolidayFormValues) => {
    setHolidaySaving(true);
    const result = await dmsContractsApi.generalHolidaySave({
      id: values.id,
      name: values.name,
      date: values.date,
      year: holidayYear,
    });
    setHolidaySaving(false);
    if (result.success) {
      setHolidays((result.holidays as HolidayRow[]) || []);
      setHolidayDialog(null);
      showToast(values.id ? "Holiday updated." : "Holiday added.");
    } else {
      showToast(result.message || "Could not save holiday.", "error");
    }
  };

  const deleteHoliday = async (row: HolidayRow) => {
    setHolidayMenuId(null);
    const confirmed = await showConfirm(`Remove ${row.name}?`, {
      title: "Remove holiday",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!confirmed) return;
    const result = await dmsContractsApi.generalHolidayDelete({ id: row.id });
    if (result.success) {
      setHolidays((result.holidays as HolidayRow[]) || []);
      showToast("Holiday removed.");
    } else {
      showToast(result.message || "Could not remove holiday.", "error");
    }
  };

  const copyHolidaysFromLastYear = async () => {
    const result = await dmsContractsApi.generalHolidaysCopyLastYear({
      year: holidayYear,
    });
    if (result.success) {
      setHolidays((result.holidays as HolidayRow[]) || []);
      showToast("Holidays copied from last year.");
    } else {
      showToast(result.message || "Could not copy holidays.", "error");
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading general settings…</p>;
  }

  const usedGb = storage ? storage.used_bytes / (1024 ** 3) : 0;
  const quotaGb = storage?.quota_gb ?? 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <GeneralCardHeader
            title="Organisation"
            help="Name and logo are owned by the CleonHR platform and are read-only here. Time zone, date format and language control how dates appear across Document Management."
          />
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Organisation name</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              value={orgName}
              readOnly
              aria-readonly="true"
            />
            <span className="text-xs text-slate-500">{orgHint}</span>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Logo</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              value={logoLabel}
              readOnly
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Time zone</span>
            <ThemedSelect
              value={timezone}
              onChange={setTimezone}
              ariaLabel="Time zone"
              className="field"
              options={timezoneOptions}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Date format</span>
            <AppSelect
              value={dateFormat}
              onChange={setDateFormat}
              ariaLabel="Date format"
              className="!w-full"
              options={dateFormatOptions}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">Language</span>
            <AppSelect
              value={language}
              onChange={setLanguage}
              ariaLabel="Language"
              className="!w-full"
              options={languageOptions}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <GeneralCardHeader
            title="Working calendar"
            help="Working days and holidays affect new approval and SLA deadlines only (existing due dates are unchanged). Reminder and digest time applies to scheduled digests and overdue checks in your organisation time zone."
          />
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Working days</p>
            <div
              className="inline-flex flex-wrap gap-1 rounded-full border border-[var(--rule)] bg-[#f7e9f0] p-1"
              role="group"
              aria-label="Working days"
            >
              {WEEKDAYS.map((day) => {
                const active = workingWeekdays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleWeekday(day.id)}
                    className={cn(
                      "min-w-[2.75rem] rounded-full px-3 py-2 text-sm font-semibold transition-all",
                      active
                        ? "bg-white text-[#9d174d] shadow-sm"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-600">
              Reminder and digest time
            </span>
            <input
              type="time"
              className="w-full max-w-[10rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={digestTime}
              onChange={(event) => setDigestTime(event.target.value)}
            />
          </label>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">Public holidays</p>
              <div className="w-28">
                <AppSelect
                  ariaLabel="Holiday year"
                  value={String(holidayYear)}
                  onChange={(value) => {
                    const year = Number(value);
                    setHolidayYear(year);
                    void loadHolidaysForYear(year);
                  }}
                  options={yearOptions}
                  className="!w-full"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Holiday</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {holidaysLoading ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-slate-500">
                        Loading holidays…
                      </td>
                    </tr>
                  ) : holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-slate-500">
                        No holidays for {holidayYear}.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {formatDmsDate(row.date)}
                        </td>
                        <td className="px-3 py-2 text-slate-900">{row.name}</td>
                        <td className="px-2 py-2 relative">
                          <button
                            type="button"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Holiday actions"
                            onClick={() =>
                              setHolidayMenuId((current) =>
                                current === row.id ? null : row.id,
                              )
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {holidayMenuId === row.id ? (
                            <div className="absolute right-2 top-9 z-10 min-w-[7rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                                onClick={() => {
                                  setHolidayMenuId(null);
                                  setHolidayDialog({
                                    id: row.id,
                                    name: row.name,
                                    date: row.date,
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                onClick={() => deleteHoliday(row)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHolidayDialog({ name: "", date: "" })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Add holiday
              </button>
              <button
                type="button"
                onClick={copyHolidaysFromLastYear}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Copy from last year
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <GeneralCardHeader
            title="Storage"
            help="Reflects your subscription allocation and per-module usage. Every kept file version counts toward the total. Alerts fire at 80% and 95% (Triggers & Alerts)."
            trailing={
              <span className="text-xs font-semibold text-brand-pink shrink-0">
                Read-only
              </span>
            }
          />
          <p className="text-2xl font-bold text-slate-900">
            {usedGb.toFixed(0)} GB{" "}
            <span className="text-base font-medium text-slate-500">of {quotaGb} GB</span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-text to-brand-pink"
              style={{ width: `${Math.min(100, storage?.used_percent ?? 0)}%` }}
            />
          </div>
          <ul className="space-y-3 pt-1">
            {(storage?.breakdown || []).map((row) => (
              <li key={row.key}>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                  <span>{row.label}</span>
                  <span>{formatBytes(row.bytes)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-300"
                    style={{
                      width: `${Math.max(4, (row.bytes / maxBreakdownBytes) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {storage?.largest_folders?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                Largest folders
              </p>
              <ul className="space-y-1 text-sm text-slate-700">
                {storage.largest_folders.slice(0, 5).map((folder) => (
                  <li key={folder.id} className="flex justify-between gap-2">
                    <span className="truncate">{folder.name}</span>
                    <span className="shrink-0 text-slate-500">
                      {formatBytes(folder.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save general settings"}
      </button>

      {holidayDialog ? (
        <GeneralHolidayDialog
          initial={holidayDialog}
          saving={holidaySaving}
          onClose={() => setHolidayDialog(null)}
          onSave={saveHoliday}
        />
      ) : null}
    </div>
  );
}
