"use client";

import type { DocFolder } from "../../../lib/types";
import type { FileVisualInput, FileVisualSpec } from "../../../lib/fileTypeVisual";
import { previewVisualsFromDocuments } from "../../../lib/fileTypeVisual";

const FOLDER_PINK = "var(--color-brand-pink, #e83e8c)";
const FOLDER_PINK_DARK = "#d12f7a";
const POLICY_TAB = "#be185d";

export const DMS_FOLDER_ICON_CLASS = "h-9 w-9 shrink-0";

export type OrgFolderIconKind = DocFolder["folder_kind"] | "employee";

function miniDocLabel(spec: FileVisualSpec) {
  return spec.label.length > 3 ? spec.label.slice(0, 3) : spec.label;
}

function MiniDocGlyph({
  spec,
  x,
  y,
  rotate = 0,
}: {
  spec: FileVisualSpec | null;
  x: number;
  y: number;
  rotate?: number;
}) {
  const accent = spec?.accent ?? "#F9A8D4";
  const label = spec ? miniDocLabel(spec) : "";
  const fontSize = label.length >= 3 ? 2.4 : 3.2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} 4.5 6)`}>
      <path
        d="M1 1.5h6.5l2.8 2.8v8.2a1 1 0 0 1-1 1H1.5a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z"
        fill="#ffffff"
        stroke={accent}
        strokeWidth="0.55"
      />
      <path
        d="M8.3 1.5h1.7v2.8H7.3a1 1 0 0 1-1-1V1.5z"
        fill="rgba(255,255,255,0.35)"
      />
      <rect x="1" y="1.5" width="8" height="3.8" rx="0.5" fill={accent} />
      {spec ? (
        <text
          x="5"
          y="4.2"
          textAnchor="middle"
          fill={spec.labelColor}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function StandardOrgFolderIcon({
  hasContent,
  peekSpecs,
  className,
}: {
  hasContent: boolean;
  peekSpecs: FileVisualSpec[];
  className: string;
}) {
  const peekSlots: (FileVisualSpec | null)[] = hasContent
    ? peekSpecs.length
      ? peekSpecs
      : [null, null, null]
    : [];

  const peekLayout = [
    { x: 6.5, y: 3.5, rotate: -6 },
    { x: 11.5, y: 2.8, rotate: 0 },
    { x: 16.5, y: 3.5, rotate: 6 },
  ];

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden role="presentation">
      <path
        d="M3.5 9.5V24.5a3 3 0 0 0 3 3h19a3 3 0 0 0 3-3V11.5a3 3 0 0 0-3-3h-8.2L12.8 6.3A2.4 2.4 0 0 0 11.2 5.5H6.5a3 3 0 0 0-3 3v1Z"
        fill={FOLDER_PINK_DARK}
      />
      {peekSlots.map((visual, index) => {
        const slot = peekLayout[index] ?? peekLayout[1];
        return (
          <MiniDocGlyph
            key={`peek-${index}`}
            spec={visual}
            x={slot.x}
            y={slot.y}
            rotate={slot.rotate}
          />
        );
      })}
      <path
        d="M3.5 13.5V24.5a3 3 0 0 0 3 3h19a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3H6.5a3 3 0 0 0-3 3Z"
        fill={FOLDER_PINK}
      />
      <path d="M3.5 13.5h25v1.2H3.5z" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}

/** Policy registry folders: binder tab + shield (distinct from standard org/employee folders). */
function PolicyFolderIcon({
  hasContent,
  peekSpecs,
  className,
}: {
  hasContent: boolean;
  peekSpecs: FileVisualSpec[];
  className: string;
}) {
  const peek = hasContent && peekSpecs[0];

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden role="presentation">
      <path
        d="M7 6.5h11.5a2 2 0 0 1 1.4.6l2.1 2.1H24a2.5 2.5 0 0 1 2.5 2.5v14.8a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5V9a2.5 2.5 0 0 1 2.5-2.5Z"
        fill={FOLDER_PINK_DARK}
      />
      <path
        d="M8.5 8h10.2l2.3 2.3H23.5a1.5 1.5 0 0 1 1.5 1.5v13.2a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V9.5a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="#ffffff"
        stroke="rgba(190,24,93,0.25)"
        strokeWidth="0.4"
      />
      <path
        d="M9 5.5h9.5a1.6 1.6 0 0 1 1.1.45l1.4 1.4H22a1.8 1.8 0 0 1 1.8 1.8v1.2H7.2V7.3A1.8 1.8 0 0 1 9 5.5Z"
        fill={POLICY_TAB}
      />
      {peek ? (
        <MiniDocGlyph spec={peek} x={17} y={10} rotate={4} />
      ) : (
        <g transform="translate(11.5 12.5)">
          <path
            d="M4.5 1.2a3.3 3.3 0 0 0-3.3 3.3v3.1c0 2.2 3.3 4.4 3.3 4.4s3.3-2.2 3.3-4.4V4.5a3.3 3.3 0 0 0-3.3-3.3Z"
            fill={FOLDER_PINK}
            stroke={FOLDER_PINK_DARK}
            strokeWidth="0.55"
          />
          <path
            d="M4.5 6.1l.9.9 1.8-1.9"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
      <rect x="8.5" y="23" width="15" height="2.2" rx="1.1" fill={FOLDER_PINK} opacity="0.35" />
      <rect x="8.5" y="23" width="9" height="2.2" rx="1.1" fill={FOLDER_PINK} />
    </svg>
  );
}

export default function OrgFolderIcon({
  hasContent,
  documents = [],
  folderKind = "folder",
  className = DMS_FOLDER_ICON_CLASS,
}: {
  hasContent: boolean;
  documents?: FileVisualInput[];
  folderKind?: OrgFolderIconKind;
  className?: string;
}) {
  const peekSpecs = hasContent ? previewVisualsFromDocuments(documents, 3) : [];

  if (folderKind === "policy") {
    return (
      <PolicyFolderIcon
        hasContent={hasContent}
        peekSpecs={peekSpecs}
        className={className}
      />
    );
  }

  return (
    <StandardOrgFolderIcon
      hasContent={hasContent}
      peekSpecs={peekSpecs}
      className={className}
    />
  );
}
