"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { organizationalDocumentHref } from "../../../lib/documentLinks";

export default function DocumentShortcutNotice({
  shortcutOfId,
  shortcutOfName,
  shortcutOfFolderId,
  className = "",
}: {
  shortcutOfId?: number | false;
  shortcutOfName?: string;
  shortcutOfFolderId?: number | false;
  className?: string;
}) {
  const originalId = shortcutOfId ? Number(shortcutOfId) : 0;
  const folderId = shortcutOfFolderId ? Number(shortcutOfFolderId) : 0;
  if (!originalId || !folderId) return null;

  const label = shortcutOfName?.trim() || `Document #${originalId}`;
  const href = organizationalDocumentHref(folderId, originalId);

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950 ${className}`}
      role="status"
    >
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">Shortcut</p>
        <p className="mt-0.5 text-violet-900/90">
          This file is a shortcut. Open the{" "}
          <Link href={href} className="font-semibold text-violet-800 underline">
            original: {label}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
