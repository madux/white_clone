"use client";

import { Check, FileSearch, FileText, FolderOpen, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "cn";
import type { DocDocument } from "../../../lib/types";
import { importPolicyBlockReason } from "../../../lib/policyDocumentName";
import { FileTypeIcon } from "./FileTypeIcon";
import ModalDialog from "./ModalDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";

function formatDocDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function DocumentPickerRow({
  document,
  selected,
  importable,
  disabledReason,
  showFolderName,
  onSelect,
}: {
  document: DocDocument;
  selected: boolean;
  importable: boolean;
  disabledReason: string | null;
  showFolderName: boolean;
  onSelect: () => void;
}) {
  const updated = formatDocDate(document.write_date || document.created_at);

  return (
    <li>
      <Button
        type="button"
        variant={selected ? "secondary" : "ghost"}
        role="option"
        aria-selected={selected}
        disabled={!importable}
        title={disabledReason ?? undefined}
        onClick={onSelect}
        className={cn(
          "h-auto w-full justify-start gap-3 px-3 py-2.5 text-left font-normal",
          selected && "ring-1 ring-ring",
          !importable && "opacity-50",
        )}
      >
        <FileTypeIcon
          name={document.name}
          mime_type={document.mime_type}
          document_type={document.document_type}
          source_url={document.source_url}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm font-medium",
                importable ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {document.name}
            </span>
            {selected ? (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {document.document_type ? (
              <Badge variant="muted" className="h-5 px-1.5 text-[11px]">
                {document.document_type}
              </Badge>
            ) : null}
            {showFolderName && document.folder_name ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <FolderOpen className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{document.folder_name}</span>
              </span>
            ) : null}
            {updated ? <span>Updated {updated}</span> : null}
          </span>
          {disabledReason ? (
            <span className="mt-1.5 block text-xs text-amber-800">{disabledReason}</span>
          ) : null}
        </span>
      </Button>
    </li>
  );
}

export default function ComplianceDocumentPickerModal({
  title,
  eyebrow,
  description,
  documents,
  loading = false,
  selectedId,
  onSelectedIdChange,
  onClose,
  onConfirm,
  confirmLabel,
  confirmPending = false,
  zIndex,
  getDisabledReason = importPolicyBlockReason,
  emptyTitle = "No files to choose",
  emptyDescription = "Upload a document to the organizational library first, then return here to import it.",
  showFolderName = true,
}: {
  title: string;
  eyebrow: string;
  description: string;
  documents: DocDocument[];
  loading?: boolean;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  confirmPending?: boolean;
  zIndex?: number;
  getDisabledReason?: (document: DocDocument) => string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  showFolderName?: boolean;
}) {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documents
      .map((document) => ({
        document,
        disabledReason: getDisabledReason(document),
        importable: !getDisabledReason(document),
      }))
      .filter(({ document }) => {
        if (!normalized) return true;
        const haystack = [
          document.name,
          document.document_type,
          document.folder_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => {
        if (a.importable !== b.importable) return a.importable ? -1 : 1;
        return a.document.name.localeCompare(b.document.name);
      });
  }, [documents, getDisabledReason, query]);

  const importableCount = useMemo(
    () => documents.filter((document) => !getDisabledReason(document)).length,
    [documents, getDisabledReason],
  );

  const selectedDocument = useMemo(
    () => documents.find((document) => String(document.id) === selectedId),
    [documents, selectedId],
  );

  const canConfirm =
    Boolean(selectedId) &&
    Boolean(selectedDocument) &&
    !getDisabledReason(selectedDocument!) &&
    !confirmPending;

  return (
    <ModalDialog
      title={title}
      eyebrow={eyebrow}
      onClose={onClose}
      size="xl"
      zIndex={zIndex}
      titleClassName="text-xl"
      backdropClassName="bg-slate-950/40"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden pt-2"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-9 min-w-0 flex-1">
            {selectedDocument ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
              >
                <FileTypeIcon
                  name={selectedDocument.name}
                  mime_type={selectedDocument.mime_type}
                  document_type={selectedDocument.document_type}
                  source_url={selectedDocument.source_url}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedDocument.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedDocument.document_type || "Document"}
                    {showFolderName && selectedDocument.folder_name
                      ? ` · ${selectedDocument.folder_name}`
                      : ""}
                  </p>
                </div>
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a file to continue.</p>
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canConfirm} onClick={() => void onConfirm()}>
              {confirmPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Working…
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      }
    >
      {description ? (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      ) : null}

      <InputGroup className="mb-3 h-9 bg-background">
        <InputGroupAddon>
          <Search className="size-4 text-muted-foreground" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, type, or folder…"
          aria-label="Search documents"
        />
      </InputGroup>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {loading
            ? "Loading library…"
            : `${importableCount} available · ${documents.length} total`}
        </span>
        {query.trim() ? (
          <span>{entries.length} match{entries.length === 1 ? "" : "es"}</span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
        {loading && !documents.length ? (
          <ul className="space-y-1.5 p-0.5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index}>
                <Skeleton className="h-[4.25rem] w-full rounded-lg" />
              </li>
            ))}
          </ul>
        ) : !documents.length ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !entries.length ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>Try a different search term.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Documents">
            {entries.map(({ document, disabledReason, importable }) => {
              const selected = importable && selectedId === String(document.id);
              return (
                <DocumentPickerRow
                  key={document.id}
                  document={document}
                  selected={selected}
                  importable={importable}
                  disabledReason={disabledReason}
                  showFolderName={showFolderName}
                  onSelect={() => {
                    if (!importable) return;
                    onSelectedIdChange(String(document.id));
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>

      {!loading && documents.length > 0 && importableCount === 0 ? (
        <Badge variant="warning" className="mt-3 h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-xs font-normal">
          Every file here is already a policy or linked to one. Upload a regular
          organizational document to import it.
        </Badge>
      ) : null}
    </ModalDialog>
  );
}
