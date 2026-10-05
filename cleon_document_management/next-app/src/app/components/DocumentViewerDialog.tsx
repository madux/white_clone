"use client";

import { Download } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import {
  documentPreviewUrl,
  documentVersionPreviewUrl,
} from "../../../lib/documentPreviewUrls";
import DocumentVersionsFooter from "./DocumentVersionsFooter";
import OrganizationalDocumentSummary from "./OrganizationalDocumentSummary";
import ModalDialog from "./ModalDialog";
import ComplianceRuleLink from "./ComplianceRuleLink";
import DocumentShortcutNotice from "./DocumentShortcutNotice";

export type DocumentViewerDialogProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  /** Set when this viewer is rendered from the minimise tray (survives navigation). */
  hostedTraySessionId?: string;
  previewUrl?: string;
  documentId?: number;
  currentVersionNumber?: number;
  initialVersionId?: number | null;
  placeholder?: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl";
  backdropClassName?: string;
  iframeMinHeight?: string;
  enableAiSummary?: boolean;
  linkedPolicyId?: number | false;
  linkedPolicyName?: string;
  isShortcut?: boolean;
  shortcutOfId?: number | false;
  shortcutOfName?: string;
  shortcutOfFolderId?: number | false;
};

export default function DocumentViewerDialog(props: DocumentViewerDialogProps) {
  const {
    title,
    eyebrow = "Document viewer",
    description,
    onClose,
    previewUrl,
    documentId,
    currentVersionNumber,
    initialVersionId = null,
    placeholder,
    footer,
    headerActions,
    size = "2xl",
    backdropClassName = "bg-slate-950/60",
    iframeMinHeight = "min-h-[62vh]",
    enableAiSummary = false,
    linkedPolicyId,
    linkedPolicyName,
    isShortcut,
    shortcutOfId,
    shortcutOfName,
    shortcutOfFolderId,
    hostedTraySessionId,
  } = props;
  const defaultPreview = useMemo(() => {
    if (previewUrl) return previewUrl;
    if (documentId != null && documentId > 0) {
      return documentPreviewUrl(documentId, { variant: "current" });
    }
    return undefined;
  }, [documentId, previewUrl]);

  const [activeVersionId, setActiveVersionId] = useState<number | null>(
    initialVersionId,
  );

  useEffect(() => {
    setActiveVersionId(initialVersionId);
  }, [initialVersionId, documentId]);

  const activePreviewUrl =
    activeVersionId != null
      ? documentVersionPreviewUrl(activeVersionId)
      : defaultPreview;

  const showPreview = activePreviewUrl && !placeholder;
  const versionFooter =
    documentId != null && documentId > 0 ? (
      <DocumentVersionsFooter
        documentId={documentId}
        currentVersionNumber={currentVersionNumber}
        activeVersionId={activeVersionId}
        onViewVersion={(versionId) => setActiveVersionId(versionId)}
        onViewCurrent={() => setActiveVersionId(null)}
      />
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
      panelClassName="h-[min(92vh,calc(100dvh-2rem))]"
      bodyClassName="flex flex-col overflow-hidden"
      hostedInTray={Boolean(hostedTraySessionId)}
      traySessionId={hostedTraySessionId}
      renderHostedOnMinimize={
        hostedTraySessionId
          ? undefined
          : ({ sessionId, onClose: closeHosted }) => (
              <DocumentViewerDialog
                {...props}
                hostedTraySessionId={sessionId}
                onClose={closeHosted}
              />
            )
      }
      footer={resolvedFooter}
      headerActions={
        <>
          {headerActions}
          {documentId != null && documentId > 0 && activeVersionId == null && (
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
      {linkedPolicyId ? (
        <div className="mb-3 shrink-0">
          <ComplianceRuleLink
            policyId={Number(linkedPolicyId)}
            policyName={linkedPolicyName}
            className="w-full max-w-md"
          />
        </div>
      ) : null}
      {isShortcut ? (
        <DocumentShortcutNotice
          className="mb-3 shrink-0"
          shortcutOfId={shortcutOfId}
          shortcutOfName={shortcutOfName}
          shortcutOfFolderId={shortcutOfFolderId}
        />
      ) : null}
      {showPreview && activeVersionId != null ? (
        <p className="mb-2 shrink-0 text-xs font-semibold text-amber-700">
          Out-of-date version
        </p>
      ) : null}
      {enableAiSummary && documentId != null && documentId > 0 ? (
        <OrganizationalDocumentSummary
          documentId={documentId}
          documentName={title}
        >
          <div className="-mx-1 -mt-1 h-full min-h-0 overflow-hidden rounded-2xl bg-slate-100 p-1">
            {showPreview ? (
              <iframe
                title={title}
                src={activePreviewUrl}
                className="pointer-events-auto block h-full min-h-0 w-full rounded-2xl border border-slate-200 bg-white"
              />
            ) : (
              placeholder
            )}
          </div>
        </OrganizationalDocumentSummary>
      ) : (
        <div className="-mx-1 -mt-1 min-h-0 flex-1 overflow-hidden rounded-2xl bg-slate-100 p-1">
          {showPreview ? (
            <iframe
              title={title}
              src={activePreviewUrl}
              className={`pointer-events-auto block h-full w-full rounded-2xl border border-slate-200 bg-white ${iframeMinHeight}`}
            />
          ) : (
            placeholder
          )}
        </div>
      )}
    </ModalDialog>
  );
}
