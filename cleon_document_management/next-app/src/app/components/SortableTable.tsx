"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function SortableTable({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
    const handlers = headers.map((header, index) => {
      if (header.querySelector("input,button") || !header.textContent?.trim()) return () => {};
      header.classList.add("cursor-pointer", "select-none", "hover:text-brand-pink");
      const handler = () => {
        const body = table.tBodies[0];
        if (!body) return;
        const ascending = header.dataset.sortDirection !== "asc";
        headers.forEach((item) => { delete item.dataset.sortDirection; item.removeAttribute("aria-sort"); });
        header.dataset.sortDirection = ascending ? "asc" : "desc";
        header.setAttribute("aria-sort", ascending ? "ascending" : "descending");
        const rows = Array.from(body.rows);
        const value = (row: HTMLTableRowElement) => row.cells[index]?.textContent?.trim() ?? "";
        const numeric = (input: string) => input !== "" && !Number.isNaN(Number(input.replace(/[^\d.-]/g, "")));
        rows.sort((a, b) => {
          const left = value(a), right = value(b);
          const result = numeric(left) && numeric(right) ? Number(left.replace(/[^\d.-]/g, "")) - Number(right.replace(/[^\d.-]/g, "")) : left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
          return ascending ? result : -result;
        });
        rows.forEach((row) => body.appendChild(row));
      };
      header.addEventListener("click", handler);
      return () => header.removeEventListener("click", handler);
    });
    return () => handlers.forEach((cleanup) => cleanup());
  }, []);
  return <table ref={tableRef} data-sortable-managed="true" className={className}>{children}</table>;
}

export function SortableTableManager() {
  const pathname = usePathname();
  useEffect(() => {
    const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table:not([data-sortable-managed])"));
    const cleanups: (() => void)[] = [];
    tables.forEach((table) => {
      table.dataset.sortableManaged = "true";
      Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).forEach((header, index) => {
        if (header.querySelector("input,button") || !header.textContent?.trim()) return;
        header.classList.add("cursor-pointer", "select-none", "hover:text-brand-pink");
        const handler = () => {
          const body = table.tBodies[0]; if (!body) return;
          const ascending = header.dataset.sortDirection !== "asc";
          table.querySelectorAll("thead th").forEach((item) => { delete (item as HTMLElement).dataset.sortDirection; item.removeAttribute("aria-sort"); });
          header.dataset.sortDirection = ascending ? "asc" : "desc"; header.setAttribute("aria-sort", ascending ? "ascending" : "descending");
          const value = (row: HTMLTableRowElement) => row.cells[index]?.textContent?.trim() ?? "";
          const rows = Array.from(body.rows); rows.sort((left, right) => { const a = value(left), b = value(right); const na = Number(a.replace(/[^\d.-]/g, "")), nb = Number(b.replace(/[^\d.-]/g, "")); const result = a && b && !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }); return ascending ? result : -result; }); rows.forEach((row) => body.appendChild(row));
        };
        header.addEventListener("click", handler); cleanups.push(() => header.removeEventListener("click", handler));
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [pathname]);
  return null;
}
