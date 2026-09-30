"use client";

import type { FileVisualInput, FileVisualSpec } from "../../../lib/fileTypeVisual";
import { previewVisualsFromDocuments } from "../../../lib/fileTypeVisual";

const FOLDER_PINK = "var(--color-brand-pink, #e83e8c)";
const FOLDER_PINK_DARK = "#d12f7a";

export const DMS_FOLDER_ICON_CLASS = "h-9 w-9 shrink-0";

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

export default function OrgFolderIcon({
  hasContent,
  documents = [],
  className = DMS_FOLDER_ICON_CLASS,
}: {
  hasContent: boolean;
  documents?: FileVisualInput[];
  className?: string;
}) {
  const peekSpecs = hasContent
    ? previewVisualsFromDocuments(documents, 3)
    : [];

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
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      role="presentation"
    >
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
      <path
        d="M3.5 13.5h25v1.2H3.5z"
        fill="rgba(255,255,255,0.2)"
      />
    </svg>
  );
}
