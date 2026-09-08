"use client";

import { Download } from "lucide-react";
import { ReactNode } from "react";
import { api } from "../../../lib/api";
import DocumentVersionsFooter from "./DocumentVersionsFooter";
import ModalDialog from "./ModalDialog";

type DocumentViewerDialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  previewUrl?: string;
  documentId?: number;
  placeholder?: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl";
  backdropClassName?: string;
  iframeMinHeight?: string;
};

export default function DocumentViewerDialog({
  title,
  eyebrow = "Document viewer",
  description,
  onClose,
  previewUrl,
  documentId,
  placeholder,
  footer,
  headerActions,
  size = "2xl",
  backdropClassName = "bg-slate-950/60",
  iframeMinHeight = "min-h-[62vh]",
}: DocumentViewerDialogProps) {
  const showPreview = previewUrl && !placeholder;
  const versionFooter =
    documentId != null && documentId > 0 ? (
      <DocumentVersionsFooter documentId={documentId} />
    ) : null;
  const resolvedFooter =
    footer || versionFooter ? (
      <>
        {footer}
        {versionFooter}
      </>
    ) : undefined;

  return (
    <ModalDialog
      title={title}
      eyebrow={eyebrow}
      description={description}
      onClose={onClose}
      size={size}
      backdropClassName={backdropClassName}
      titleClassName="text-lg"
      footer={resolvedFooter}
      headerActions={
        <>
          {headerActions}
          {documentId != null && documentId > 0 && (
            <button
              type="button"
              onClick={() => api.downloadDocument(documentId)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-pink px-3 py-2 text-xs font-bold text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}
        </>
      }
    >
      <div className="-mx-1 -mt-1 min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-100 p-1">
        {showPreview ? (
          <iframe
            title={title}
            src={previewUrl}
            className={`block h-full w-full pointer-events-auto rounded-2xl border border-slate-200 bg-white ${iframeMinHeight}`}
          />
        ) : (
          placeholder
        )}
      </div>
    </ModalDialog>
  );
}
