"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

function skipTable(table: HTMLTableElement) {
  return (
    table.dataset.noSort === "true" ||
    table.dataset.reactSort === "true" ||
    table.classList.contains("ef-role-access-matrix")
  );
}

function tableUsesReactSort(table: HTMLTableElement) {
  return Boolean(table.querySelector("thead th button"));
}

function skipHeader(header: HTMLTableCellElement) {
  if (
    header.querySelector("input, button, select, textarea") ||
    header.classList.contains("dms-col-check") ||
    header.classList.contains("dms-col-actions") ||
    header.classList.contains("table-actions-header")
  ) {
    return true;
  }
  const text = header.textContent?.trim() ?? "";
  return !text || /^actions?$/i.test(text);
}

function cellValue(row: HTMLTableRowElement, index: number) {
  const cell = row.cells[index];
  if (!cell) return "";
  return (cell.dataset.sortValue ?? cell.textContent ?? "").trim();
}

function parseValue(raw: string): { kind: "empty" | "number" | "date" | "text"; value: number | string } {
  const text = raw.trim();
  if (!text || text === "—" || text === "-" || text === "Unknown" || text === "No expiry") {
    return { kind: "empty", value: "" };
  }
  const numeric = text.replace(/[,$%\s]/g, "");
  if (numeric !== "" && !Number.isNaN(Number(numeric)) && !/[a-z]/i.test(text)) {
    return { kind: "number", value: Number(numeric) };
  }
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const timestamp = Date.parse(normalized);
  if (!Number.isNaN(timestamp) && /\d/.test(text)) {
    return { kind: "date", value: timestamp };
  }
  return { kind: "text", value: text };
}

function compareValues(left: string, right: string) {
  const a = parseValue(left);
  const b = parseValue(right);
  if (a.kind === "empty" || b.kind === "empty") {
    if (a.kind === "empty" && b.kind === "empty") return 0;
    return a.kind === "empty" ? 1 : -1;
  }
  if (a.kind === b.kind && a.kind !== "text") {
    return (a.value as number) - (b.value as number);
  }
  return String(a.value).localeCompare(String(b.value), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

let applyingSort = false;

function applyTableSort(table: HTMLTableElement) {
  if (skipTable(table) || tableUsesReactSort(table)) return;
  const index = Number(table.dataset.sortIndex);
  const direction = table.dataset.sortDir;
  if (!Number.isFinite(index) || (direction !== "asc" && direction !== "desc")) return;
  const body = table.tBodies[0];
  if (!body) return;
  Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).forEach(
    (header, headerIndex) => {
      header.removeAttribute("aria-sort");
      delete header.dataset.sortDirection;
      if (headerIndex === index && !skipHeader(header)) {
        header.dataset.sortDirection = direction;
        header.setAttribute(
          "aria-sort",
          direction === "asc" ? "ascending" : "descending",
        );
      }
    },
  );
  const rows = Array.from(body.rows);
  const sorted = [...rows].sort((left, right) => {
    const result = compareValues(cellValue(left, index), cellValue(right, index));
    return direction === "asc" ? result : -result;
  });
  const unchanged = sorted.every((row, rowIndex) => row === rows[rowIndex]);
  if (unchanged) return;
  applyingSort = true;
  sorted.forEach((row) => body.appendChild(row));
  requestAnimationFrame(() => {
    applyingSort = false;
  });
}

function bindTable(table: HTMLTableElement) {
  if (skipTable(table) || tableUsesReactSort(table)) return;
  table.classList.add("dms-table");
  Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).forEach(
    (header, index) => {
      if (skipHeader(header) || header.dataset.sortBound === "true") return;
      header.dataset.sortBound = "true";
      header.classList.add("cursor-pointer", "select-none");
      header.title = header.title || "Sort";
      header.addEventListener("click", () => {
        const next =
          table.dataset.sortIndex === String(index) && table.dataset.sortDir === "asc"
            ? "desc"
            : "asc";
        table.dataset.sortIndex = String(index);
        table.dataset.sortDir = next;
        applyTableSort(table);
      });
    },
  );
}

function scanTables() {
  document.querySelectorAll("table").forEach((table) => {
    bindTable(table as HTMLTableElement);
  });
  if (applyingSort) return;
  document.querySelectorAll("table[data-sort-index]").forEach((table) => {
    if (tableUsesReactSort(table as HTMLTableElement)) return;
    applyTableSort(table as HTMLTableElement);
  });
}

export default function SortableTable({
  children,
  className = "",
  managedSort = false,
}: {
  children: ReactNode;
  className?: string;
  /** Column sort is handled in React; do not attach global DOM sort. */
  managedSort?: boolean;
}) {
  const merged = ["dms-table", className].filter(Boolean).join(" ");
  return (
    <table
      className={merged}
      data-no-sort={managedSort ? "true" : undefined}
      data-react-sort={managedSort ? "true" : undefined}
    >
      {children}
    </table>
  );
}

export function SortableTableManager() {
  const pathname = usePathname();
  useEffect(() => {
    scanTables();
    const observer = new MutationObserver(() => {
      if (applyingSort) return;
      scanTables();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
