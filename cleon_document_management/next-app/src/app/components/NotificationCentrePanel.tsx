"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dmsContractsApi,
  type NotificationInboxItem,
} from "../../../lib/dmsContractsApi";
import { PinkSwitchRow } from "./PinkSwitch";

function dayGroupLabel(createdAt: string): string {
  const created = new Date(createdAt.replace(" ", "T"));
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startCreated = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  );
  const diffDays = Math.round(
    (startToday.getTime() - startCreated.getTime()) / 86400000,
  );
  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return created.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  onClose?: () => void;
  onUnreadChange?: (count: number) => void;
};

export default function NotificationCentrePanel({ onClose, onUnreadChange }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [groups, setGroups] = useState<
    { code: string; label: string; email_enabled: boolean; locked: boolean }[]
  >([]);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    const result = await dmsContractsApi.notificationInbox(50, tab);
    if (result.success) {
      setItems(result.data.items);
      setUnread(result.data.unread_count);
      onUnreadChange?.(result.data.unread_count);
    }
    setLoading(false);
  }, [tab, onUnreadChange]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!prefsOpen) return;
    dmsContractsApi.notificationPreferences().then((result) => {
      if (!result.success) return;
      setDigestEnabled(result.data.digest_enabled);
      setGroups(result.data.groups);
    });
  }, [prefsOpen]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationInboxItem[]>();
    for (const item of items) {
      const key = dayGroupLabel(item.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  const openItem = async (item: NotificationInboxItem) => {
    const result = await dmsContractsApi.notificationOpen(item.id);
    onClose?.();
    if (!result.success || result.data.permission_denied) {
      router.push("/pages/permission-denied");
      return;
    }
    router.push(result.data.href || "/pages/my-workspace");
    loadInbox();
  };

  const markAllRead = async () => {
    await dmsContractsApi.notificationMarkRead([], true);
    loadInbox();
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    const groupPayload: Record<string, boolean> = {};
    for (const g of groups) {
      groupPayload[g.code] = g.email_enabled;
    }
    await dmsContractsApi.notificationPreferences({
      digest_enabled: digestEnabled,
      groups: groupPayload,
    });
    setSavingPrefs(false);
  };

  return (
    <div className="flex max-h-[min(70vh,520px)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-1 pb-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("unread")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              tab === "unread"
                ? "bg-pink-50 text-brand-pink"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            Unread {unread > 0 ? `(${unread})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              tab === "all"
                ? "bg-pink-50 text-brand-pink"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            All
          </button>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[11px] font-semibold text-brand-pink hover:underline"
          >
            Mark all as read
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {loading ? (
          <p className="px-3 py-6 text-sm text-slate-500">Loading…</p>
        ) : !items.length ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            No notifications in the last 90 days.
          </p>
        ) : (
          grouped.map(([label, groupItems]) => (
            <div key={label} className="mb-3">
              <p className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400">
                {label}
              </p>
              <ul>
                {groupItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-pink-50/60 ${
                        item.read_at
                          ? "text-slate-500"
                          : "font-semibold text-slate-900"
                      }`}
                    >
                      <p>{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 text-xs font-normal text-slate-500 line-clamp-2">
                          {item.body}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setPrefsOpen((v) => !v)}
          className="w-full px-3 py-2 text-left text-xs font-bold text-slate-600 hover:text-brand-pink"
        >
          My notification preferences
        </button>
        {prefsOpen ? (
          <div className="space-y-2.5 px-3 pb-2">
            <PinkSwitchRow
              label="Daily digest email at 09:00"
              checked={digestEnabled}
              onCheckedChange={setDigestEnabled}
            />
            {groups.map((g) => (
              <PinkSwitchRow
                key={g.code}
                label={
                  g.locked ? (
                    <span className="inline-flex items-center gap-1">
                      Email: {g.label}
                      <Lock className="h-3 w-3 text-slate-400" aria-hidden />
                    </span>
                  ) : (
                    `Email: ${g.label}`
                  )
                }
                checked={g.email_enabled}
                disabled={g.locked}
                onCheckedChange={(email_enabled) =>
                  setGroups((prev) =>
                    prev.map((row) =>
                      row.code === g.code
                        ? { ...row, email_enabled }
                        : row,
                    ),
                  )
                }
              />
            ))}
            {groups.some((g) => g.locked) ? (
              <p className="text-[10px] text-slate-400">
                Required by your organisation.
              </p>
            ) : null}
            <button
              type="button"
              disabled={savingPrefs}
              onClick={savePrefs}
              className="rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-bold text-white"
            >
              Save preferences
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
