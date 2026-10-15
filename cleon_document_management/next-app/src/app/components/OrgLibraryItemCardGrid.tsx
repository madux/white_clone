"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LibraryFileRow } from "./LibraryFileTable";
import { FileTypeIcon } from "./FileTypeIcon";
import OrgFolderIcon from "./OrgFolderIcon";
import ShortcutIcon from "./ShortcutIcon";
import { Checkbox } from "@/components/ui/checkbox";
import { folderCardStyle, folderWellStyle } from "../../../lib/folderColor";
import EmptyState from "./EmptyState";
import { cn } from "@/lib/utils";

function libraryRowThumbnail(row: LibraryFileRow, className = "h-10 w-10") {
  const folderPreview = row.folderPreview ?? row.orgFolder;
  if (row.icon) return row.icon;
  if (folderPreview) {
    return (
      <OrgFolderIcon
        className={className}
        hasContent={folderPreview.hasContent}
        documents={folderPreview.documents}
        folderKind={row.folderKind}
      />
    );
  }
  if (row.kind === "folder") {
    return (
      <OrgFolderIcon
        className={className}
        hasContent={
          row.documentsCount !== undefined &&
          row.documentsCount !== "—" &&
          Number(row.documentsCount) > 0
        }
        documents={(row.folderPreview ?? row.orgFolder)?.documents}
        folderKind={row.folderKind}
      />
    );
  }
  if (row.fileMeta) {
    return <FileTypeIcon {...row.fileMeta} className={className} />;
  }
  return <FileTypeIcon name={row.name} className={className} />;
}

function CardMain({
  row,
  children,
  className,
}: {
  row: LibraryFileRow;
  children: ReactNode;
  className?: string;
}) {
  if (row.href) {
    return (
      <Link
        href={row.href}
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col no-underline outline-none", className)}
      >
        {children}
      </Link>
    );
  }
  if (row.onOpen) {
    return (
      <button
        type="button"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          className,
        )}
        onClick={row.onOpen}
      >
        {children}
      </button>
    );
  }
  return <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>{children}</div>;
}

function OrgLibraryItemCard({
  row,
  selectable,
}: {
  row: LibraryFileRow;
  selectable?: boolean;
}) {
  const isFolder = row.kind === "folder";
  const folderAccent = isFolder ? folderCardStyle(row.folderColorHex) : undefined;
  const hasFooter = Boolean(row.modified || row.status);

  return (
    <article
      className={cn(
        "group relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/80 shadow-sm ring-1 ring-black/[0.03]",
        !isFolder && "hover:border-primary/25",
      )}
      style={folderAccent}
    >
      <div
        className="relative z-20 flex h-10 shrink-0 items-center justify-between gap-2 px-3"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {selectable && row.onSelectChange ? (
          <Checkbox
            checked={row.selected}
            onCheckedChange={(value) => row.onSelectChange?.(value === true)}
            aria-label={`Select ${row.name}`}
            className="shrink-0 border-slate-300 data-[state=checked]:border-primary"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="w-4" aria-hidden />
        )}
        <div
          className="flex min-h-8 shrink-0 items-center justify-end gap-1 opacity-100 sm:opacity-70 sm:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {row.extra}
          {row.actions}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col transition duration-200",
          "hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-md hover:shadow-slate-200/60",
        )}
      >
      <CardMain row={row} className="flex-1">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex shrink-0 justify-center pt-0.5">
            <div
              className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-slate-100/80"
              style={
                isFolder && row.folderColorHex
                  ? folderWellStyle(row.folderColorHex)
                  : { backgroundColor: "rgb(248 250 252)" }
              }
            >
              <span className="flex h-11 w-11 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full">
                {libraryRowThumbnail(row, "h-11 w-11")}
              </span>
            </div>
          </div>

          <div className="mt-3 shrink-0 text-center">
            <p className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-[1.375rem] text-slate-900">
              {row.isShortcut ? (
                <ShortcutIcon
                  className="mr-1 inline-block h-3.5 w-3.5 shrink-0 align-[-2px] text-sky-600"
                  aria-hidden
                />
              ) : null}
              {row.name}
            </p>
            <p
              className={cn(
                "mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-500",
                !row.subtitle && "invisible",
              )}
              aria-hidden={!row.subtitle}
            >
              {row.subtitle || "—"}
            </p>
          </div>

          {hasFooter ? (
            <footer className="mt-auto shrink-0 space-y-2 border-t border-slate-100/90 pt-3">
              {row.modified ? (
                <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Updated {row.modified}
                </p>
              ) : (
                <p className="min-h-[1rem]" aria-hidden />
              )}
              {row.status ? (
                <div className="flex min-h-[1.5rem] flex-wrap items-center justify-center gap-1">
                  {row.status}
                </div>
              ) : null}
            </footer>
          ) : (
            <div className="mt-auto shrink-0" aria-hidden />
          )}
        </div>
      </CardMain>
      </div>
    </article>
  );
}

export default function OrgLibraryItemCardGrid({
  rows,
  selectable,
  emptyTitle = "This folder is empty",
  emptyDescription,
  className,
}: {
  rows: LibraryFileRow[];
  selectable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (!rows.length) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} className="m-4" />
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
        className,
      )}
    >
      {rows.map((row) => (
        <OrgLibraryItemCard key={row.id} row={row} selectable={selectable} />
      ))}
    </div>
  );
}
