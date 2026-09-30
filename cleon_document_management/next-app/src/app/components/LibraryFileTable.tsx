"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { FileVisualInput } from "../../../lib/fileTypeVisual";
import { FileTypeIcon } from "./FileTypeIcon";
import OrgFolderIcon from "./OrgFolderIcon";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  type LibrarySortField,
  sortMark,
  toggleLibrarySortKey,
} from "../../../lib/libraryTableSort";
import { useClientPagination } from "../../../lib/useClientPagination";
import EmptyState from "./EmptyState";
import ListPagination from "./ListPagination";
import PersonCell from "./PersonCell";
import ShortcutIcon from "./ShortcutIcon";

export type LibraryFileRow = {
  id: string;
  kind?: "folder" | "file" | "person";
  icon?: ReactNode;
  name: string;
  subtitle?: string;
  description?: string;
  documentsCount?: number | string;
  href?: string;
  onOpen?: () => void;
  owner?: string;
  ownerHref?: string;
  modified?: string;
  /** ISO or API datetime for column sorting */
  modifiedRaw?: string;
  location?: string;
  status?: ReactNode;
  extra?: ReactNode;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  actions?: ReactNode;
  fileMeta?: FileVisualInput;
  isShortcut?: boolean;
  /** Pink folder with in-folder file peeks when the folder has items */
  folderPreview?: { hasContent: boolean; documents?: FileVisualInput[] };
  /** @deprecated use folderPreview */
  orgFolder?: { hasContent: boolean; documents?: FileVisualInput[] };
};

export default function LibraryFileTable({
  rows,
  loading,
  emptyTitle = "This folder is empty",
  emptyDescription,
  emptyAction,
  selectable,
  allSelected,
  onToggleAll,
  showOwner = true,
  showModified = true,
  showLocation = false,
  showStatus = false,
  showDescription = false,
  showDocuments = false,
  documentsColumnLabel = "Documents",
  nameLabel = "Name",
  pageSize = EMPLOYEE_FILE_LIST_PAGE_SIZE,
  sortKey,
  onSortChange,
}: {
  rows: LibraryFileRow[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  selectable?: boolean;
  allSelected?: boolean;
  onToggleAll?: (checked: boolean) => void;
  showOwner?: boolean;
  showModified?: boolean;
  showLocation?: boolean;
  showStatus?: boolean;
  showDescription?: boolean;
  showDocuments?: boolean;
  documentsColumnLabel?: string;
  nameLabel?: string;
  pageSize?: number;
  sortKey?: string;
  onSortChange?: (order: string) => void;
}) {
  const columnSort = Boolean(sortKey && onSortChange);
  const toggleSort = (field: LibrarySortField) =>
    onSortChange?.(toggleLibrarySortKey(sortKey || `${field} asc`, field));

  const SortHead = ({
    field,
    label,
    className,
  }: {
    field: LibrarySortField;
    label: string;
    className?: string;
  }) =>
    columnSort ? (
      <TableHead className={className}>
        <button
          type="button"
          className="inline-flex items-center font-medium hover:text-foreground"
          onClick={() => toggleSort(field)}
        >
          {label}
          {sortMark(sortKey || "", field)}
        </button>
      </TableHead>
    ) : (
      <TableHead className={className}>{label}</TableHead>
    );
  const paging = useClientPagination(
    rows,
    `${rows.length}:${rows[0]?.id ?? ""}:${rows[rows.length - 1]?.id ?? ""}`,
    pageSize,
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <>
    <Table data-no-sort={columnSort ? "true" : undefined}>
      <TableHeader>
        <TableRow>
          {selectable ? (
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(value) => onToggleAll?.(value === true)}
                aria-label="Select all"
              />
            </TableHead>
          ) : null}
          <SortHead field="name" label={nameLabel} />
          {showDescription ? (
            <SortHead field="description" label="Description" className="dms-col-description" />
          ) : null}
          {showDocuments ? (
            <SortHead
              field="documents"
              label={documentsColumnLabel}
              className="dms-col-center"
            />
          ) : null}
          {showOwner ? <SortHead field="owner" label="Owner" /> : null}
          {showLocation ? <TableHead>Location</TableHead> : null}
          {showStatus ? <TableHead>Status</TableHead> : null}
          {showModified ? <SortHead field="modified" label="Modified" /> : null}
          <TableHead className="table-actions-header w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paging.items.map((row) => (
          <TableRow key={row.id} data-state={row.selected ? "selected" : undefined}>
            {selectable ? (
              <TableCell>
                {row.onSelectChange ? (
                  <Checkbox
                    checked={row.selected}
                    onCheckedChange={(value) => row.onSelectChange?.(value === true)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${row.name}`}
                  />
                ) : null}
              </TableCell>
            ) : null}
            <TableCell className="max-w-md">
              <LibraryNameCell row={row} />
            </TableCell>
            {showDescription ? (
              <TableCell className="dms-col-description">
                <span title={row.description || undefined}>
                  {row.description || "—"}
                </span>
              </TableCell>
            ) : null}
            {showDocuments ? (
              <TableCell className="dms-col-center text-muted-foreground">
                {row.documentsCount ?? "—"}
              </TableCell>
            ) : null}
            {showOwner ? (
              <TableCell>
                <PersonCell name={row.owner || "—"} href={row.ownerHref} />
              </TableCell>
            ) : null}
            {showLocation ? (
              <TableCell className="text-muted-foreground">{row.location || "—"}</TableCell>
            ) : null}
            {showStatus ? <TableCell>{row.status ?? row.extra ?? "—"}</TableCell> : null}
            {showModified ? (
              <TableCell className="text-muted-foreground">{row.modified || "—"}</TableCell>
            ) : null}
            <TableCell className="text-right">{row.actions}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <ListPagination
      page={paging.page}
      pageSize={paging.pageSize}
      total={paging.total}
      onPageChange={paging.setPage}
    />
    </>
  );
}

function LibraryNameCell({ row }: { row: LibraryFileRow }) {
  const folderPreview = row.folderPreview ?? row.orgFolder;
  const Icon =
    row.icon ??
    (folderPreview ? (
      <OrgFolderIcon
        hasContent={folderPreview.hasContent}
        documents={folderPreview.documents}
      />
    ) : row.kind === "folder" ? (
      <OrgFolderIcon
        hasContent={
          row.documentsCount !== undefined &&
          row.documentsCount !== "—" &&
          Number(row.documentsCount) > 0
        }
        documents={(row.folderPreview ?? row.orgFolder)?.documents}
      />
    ) : row.fileMeta ? (
      <FileTypeIcon {...row.fileMeta} />
    ) : (
      <FileTypeIcon name={row.name} />
    ));
  const copy = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full">
        {Icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
          {row.isShortcut ? <ShortcutIcon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="truncate">{row.name}</span>
        </span>
        {row.subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>
        ) : null}
      </span>
      {row.extra}
    </span>
  );
  if (row.href) {
    return (
      <Link href={row.href} className="block min-w-0 no-underline hover:text-primary">
        {copy}
      </Link>
    );
  }
  if (row.onOpen) {
    return (
      <button type="button" className="block min-w-0 text-left" onClick={row.onOpen}>
        {copy}
      </button>
    );
  }
  return copy;
}
