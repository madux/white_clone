export type FileVisualKind =
  | "pdf"
  | "word"
  | "excel"
  | "csv"
  | "powerpoint"
  | "image"
  | "text"
  | "archive"
  | "link"
  | "generic";

export type FileVisualSpec = {
  kind: FileVisualKind;
  label: string;
  accent: string;
  labelColor: string;
};

const WORD_MIME =
  /word|msword|officedocument\.wordprocessing|opendocument\.text/i;
const EXCEL_MIME =
  /excel|spreadsheet|ms-excel|officedocument\.spreadsheet|opendocument\.spreadsheet/i;
const PPT_MIME =
  /powerpoint|presentation|officedocument\.presentation|opendocument\.presentation/i;

function extensionFromName(name?: string) {
  const base = (name || "").trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1);
}

export function resolveFileVisual(input: {
  name?: string;
  mime_type?: string;
  document_type?: string;
  source_url?: string;
}): FileVisualSpec {
  if (input.source_url?.trim()) {
    return {
      kind: "link",
      label: "URL",
      accent: "#2563EB",
      labelColor: "#ffffff",
    };
  }

  const ext = extensionFromName(input.name);
  const mime = (input.mime_type || "").toLowerCase();
  const typeName = (input.document_type || "").toLowerCase();

  const extOrType = ext || typeName;

  if (extOrType === "pdf" || mime.includes("pdf")) {
    return { kind: "pdf", label: "PDF", accent: "#E53935", labelColor: "#ffffff" };
  }
  if (
    ["doc", "docx", "odt", "rtf"].includes(extOrType) ||
    WORD_MIME.test(mime) ||
    /\bword\b/.test(typeName)
  ) {
    return { kind: "word", label: "W", accent: "#4A7FE5", labelColor: "#ffffff" };
  }
  if (extOrType === "csv" || mime.includes("csv")) {
    return {
      kind: "csv",
      label: "CSV",
      accent: "#15803D",
      labelColor: "#ffffff",
    };
  }
  if (
    ["xls", "xlsx", "ods"].includes(extOrType) ||
    EXCEL_MIME.test(mime) ||
    /\bexcel\b/.test(typeName)
  ) {
    return { kind: "excel", label: "X", accent: "#1B5E6B", labelColor: "#ffffff" };
  }
  if (
    ["ppt", "pptx", "odp"].includes(extOrType) ||
    PPT_MIME.test(mime) ||
    /\bpowerpoint\b|\bpresentation\b/.test(typeName)
  ) {
    return {
      kind: "powerpoint",
      label: "P",
      accent: "#EA580C",
      labelColor: "#ffffff",
    };
  }
  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "heic"].includes(
      extOrType,
    ) ||
    mime.startsWith("image/")
  ) {
    return {
      kind: "image",
      label: "IMG",
      accent: "#7C3AED",
      labelColor: "#ffffff",
    };
  }
  if (
    ["txt", "md", "log"].includes(extOrType) ||
    mime.startsWith("text/")
  ) {
    return {
      kind: "text",
      label: "TXT",
      accent: "#64748B",
      labelColor: "#ffffff",
    };
  }
  if (
    ["zip", "rar", "7z", "tar", "gz"].includes(extOrType) ||
    mime.includes("zip") ||
    mime.includes("compressed")
  ) {
    return {
      kind: "archive",
      label: "ZIP",
      accent: "#D97706",
      labelColor: "#ffffff",
    };
  }

  const fallback =
    ext && ext.length <= 4 ? ext.toUpperCase() : ext.slice(0, 3).toUpperCase();
  return {
    kind: "generic",
    label: fallback || "FILE",
    accent: "#94A3B8",
    labelColor: "#ffffff",
  };
}

export type FileVisualInput = {
  name?: string;
  mime_type?: string;
  document_type?: string;
  source_url?: string;
};

export function previewVisualsFromDocuments(
  documents: FileVisualInput[],
  limit = 3,
): FileVisualSpec[] {
  const seen = new Set<string>();
  const result: FileVisualSpec[] = [];
  for (const doc of documents) {
    const visual = resolveFileVisual(doc);
    const key = visual.kind === "generic" ? visual.label : visual.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(visual);
    if (result.length >= limit) break;
  }
  return result;
}
