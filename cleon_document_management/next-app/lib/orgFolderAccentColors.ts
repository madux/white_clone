export type OrgFolderAccentColor = {
  hex: string;
  label: string;
};

/** Default organisational folder accent palette (matches folder edit menu). */
export const ORG_FOLDER_ACCENT_COLORS: OrgFolderAccentColor[] = [
  { hex: "#ec4899", label: "Signature pink" },
  { hex: "#3b82f6", label: "Ocean blue" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#64748b", label: "Slate" },
];

export const DEFAULT_ORG_FOLDER_ACCENT = ORG_FOLDER_ACCENT_COLORS[0].hex;

export function orgFolderAccentLabel(hex: string) {
  return (
    ORG_FOLDER_ACCENT_COLORS.find((item) => item.hex.toLowerCase() === hex.toLowerCase())
      ?.label ?? "Custom"
  );
}
