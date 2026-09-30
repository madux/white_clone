import type { CSSProperties } from "react";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function folderColorHex(value?: string | null) {
  const hex = (value || "").trim();
  return HEX_COLOR.test(hex) ? hex : "";
}

export function folderColorRgba(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function folderIconProps(
  colorHex?: string | null,
  className = "h-4 w-4 shrink-0",
) {
  const hex = folderColorHex(colorHex);
  return {
    className: hex ? className : `${className} text-brand-pink`,
    style: hex ? ({ color: hex } as CSSProperties) : undefined,
  };
}

export function folderRowStyle(colorHex?: string | null): CSSProperties | undefined {
  const hex = folderColorHex(colorHex);
  if (!hex) return undefined;
  return {
    background: `linear-gradient(180deg, ${folderColorRgba(hex, 0.06)} 0%, ${folderColorRgba(hex, 0.14)} 100%)`,
    boxShadow: `inset 3px 0 0 ${hex}`,
  };
}

export function folderCardStyle(colorHex?: string | null): CSSProperties | undefined {
  const hex = folderColorHex(colorHex);
  if (!hex) return undefined;
  return {
    borderColor: folderColorRgba(hex, 0.28),
    background: `linear-gradient(180deg, #fff 0%, ${folderColorRgba(hex, 0.08)} 100%)`,
  };
}

export function folderWellStyle(colorHex?: string | null): CSSProperties | undefined {
  const hex = folderColorHex(colorHex);
  if (!hex) return undefined;
  return {
    backgroundColor: folderColorRgba(hex, 0.12),
    color: hex,
  };
}
