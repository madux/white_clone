import type { CSSProperties } from "react";

export type MarginPreset = "normal" | "narrow" | "moderate" | "wide";
export type PageOrientation = "portrait" | "landscape";
export type PageSizeKey = "a4" | "letter" | "legal";

export type PageLayoutState = {
  marginPreset: MarginPreset;
  orientation: PageOrientation;
  pageSize: PageSizeKey;
  columns: 1 | 2 | 3;
  indentLeftCm: number;
  indentRightCm: number;
  spacingBeforePt: number;
  spacingAfterPt: number;
};

export const DEFAULT_PAGE_LAYOUT: PageLayoutState = {
  marginPreset: "normal",
  orientation: "portrait",
  pageSize: "a4",
  columns: 1,
  indentLeftCm: 0,
  indentRightCm: 0,
  spacingBeforePt: 0,
  spacingAfterPt: 8,
};

export const MARGIN_PRESETS: Record<
  MarginPreset,
  { label: string; top: number; right: number; bottom: number; left: number }
> = {
  normal: { label: "Normal", top: 2.54, right: 2.54, bottom: 2.54, left: 2.54 },
  narrow: { label: "Narrow", top: 1.27, right: 1.27, bottom: 1.27, left: 1.27 },
  moderate: { label: "Moderate", top: 2.54, right: 1.9, bottom: 2.54, left: 1.9 },
  wide: { label: "Wide", top: 2.54, right: 5.08, bottom: 2.54, left: 5.08 },
};

export const PAGE_SIZES: Record<
  PageSizeKey,
  { label: string; widthCm: number; heightCm: number }
> = {
  a4: { label: "A4 (21 x 29.7 cm)", widthCm: 21, heightCm: 29.7 },
  letter: { label: "Letter (21.6 x 27.9 cm)", widthCm: 21.59, heightCm: 27.94 },
  legal: { label: "Legal (21.6 x 35.6 cm)", widthCm: 21.59, heightCm: 35.56 },
};

export function cmToPx(cm: number) {
  return cm * (96 / 2.54);
}

export function ptToPx(pt: number) {
  return pt * (96 / 72);
}

export function pageSurfaceStyle(layout: PageLayoutState): CSSProperties {
  const size = PAGE_SIZES[layout.pageSize];
  const margins = MARGIN_PRESETS[layout.marginPreset];
  const widthCm = layout.orientation === "portrait" ? size.widthCm : size.heightCm;
  const heightCm = layout.orientation === "portrait" ? size.heightCm : size.widthCm;
  return {
    width: cmToPx(widthCm),
    minHeight: cmToPx(heightCm),
    paddingTop: cmToPx(margins.top),
    paddingRight: cmToPx(margins.right),
    paddingBottom: cmToPx(margins.bottom),
    paddingLeft: cmToPx(margins.left),
    columnCount: layout.columns > 1 ? layout.columns : undefined,
    columnGap: layout.columns > 1 ? "1.25rem" : undefined,
    ["--tf-indent-left" as string]: `${cmToPx(layout.indentLeftCm)}px`,
    ["--tf-indent-right" as string]: `${cmToPx(layout.indentRightCm)}px`,
    ["--tf-spacing-before" as string]: `${ptToPx(layout.spacingBeforePt)}px`,
    ["--tf-spacing-after" as string]: `${ptToPx(layout.spacingAfterPt)}px`,
  };
}

export function marginSummary(layout: PageLayoutState) {
  const m = MARGIN_PRESETS[layout.marginPreset];
  return {
    top: m.top,
    left: m.left,
    bottom: m.bottom,
    right: m.right,
  };
}
