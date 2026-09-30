"use client";

import type { FileVisualInput, FileVisualSpec } from "../../../lib/fileTypeVisual";
import { resolveFileVisual } from "../../../lib/fileTypeVisual";

/** Portrait file tile used in library tables and lists */
export const DMS_FILE_ICON_CLASS = "h-9 w-7 shrink-0";

export function FileTypeIcon({
  name,
  mime_type,
  document_type,
  source_url,
  visual,
  variant = "tile",
  className = DMS_FILE_ICON_CLASS,
}: {
  name?: string;
  mime_type?: string;
  document_type?: string;
  source_url?: string;
  visual?: FileVisualSpec;
  variant?: "tile" | "peek";
  className?: string;
}) {
  const spec =
    visual ??
    resolveFileVisual({ name, mime_type, document_type, source_url });
  const peek = variant === "peek";
  const label =
    spec.label.length > 4 ? spec.label.slice(0, 4) : spec.label;
  const isPdf = spec.kind === "pdf";
  const isShortLabel = label.length <= 2;
  const fontSize = peek
    ? isShortLabel
      ? 4.5
      : 3.2
    : isPdf
      ? 7.5
      : isShortLabel
        ? 16
        : 8.5;
  const textY = peek
    ? isPdf
      ? 8.2
      : 7.5
    : isPdf
      ? 36
      : 27;

  return (
    <svg
      viewBox="0 0 36 44"
      className={className}
      aria-hidden
      role="presentation"
    >
      <path
        d="M6 2h16l8 8v30a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z"
        fill={spec.accent}
      />
      <path
        d="M22 2h8v8h-5a3 3 0 0 1-3-3V2z"
        fill="rgba(255,255,255,0.22)"
      />
      {spec.kind === "excel" && !peek ? (
        <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.6">
          <line x1="6" y1="14" x2="30" y2="14" />
          <line x1="6" y1="18" x2="30" y2="18" />
          <line x1="6" y1="22" x2="30" y2="22" />
          <line x1="14" y1="12" x2="14" y2="32" />
          <line x1="22" y1="12" x2="22" y2="32" />
        </g>
      ) : null}
      <text
        x="18"
        y={textY}
        textAnchor="middle"
        fill={spec.labelColor}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

export function fileTypeIconFromInput(
  input: FileVisualInput,
  className?: string,
) {
  return (
    <FileTypeIcon
      name={input.name}
      mime_type={input.mime_type}
      document_type={input.document_type}
      source_url={input.source_url}
      className={className}
    />
  );
}
