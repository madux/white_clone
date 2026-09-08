import type { DocumentaryFolder } from "../../../lib/types";

export function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function formatDuration(seconds: number) {
  if (!seconds) return "Video";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CD"
  );
}

export function scopeLabel(scope: DocumentaryFolder["access_scope"]) {
  return {
    company: "Everyone",
    department: "Departments",
    grade: "Grades",
    employee: "Selected people",
  }[scope];
}
