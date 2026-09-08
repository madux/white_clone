"use client";

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Kept as one table-cell line, then turned into <br> when rendering. */
const CELL_BR = "\u2060BR\u2060";

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-1 text-lg font-semibold text-slate-900">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-1 text-base font-semibold text-slate-900">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-slate-900">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="text-sm font-semibold text-slate-800">{children}</h5>
  ),
  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => (
    <ul className="my-1 list-disc space-y-1 pl-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 list-decimal space-y-1 pl-4">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-pink/40 pl-3 text-slate-600">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-brand-pink underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="rounded bg-slate-200/80 px-1 py-0.5 text-[0.9em]">
          {children}
        </code>
      );
    }
    return (
      <code className="block overflow-x-auto whitespace-pre rounded-xl bg-slate-900 p-3 text-[0.8rem] text-slate-100">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table
        data-sortable-managed="true"
        className="w-full table-fixed border-collapse text-left text-xs"
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 text-slate-500">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-3 py-2 font-semibold align-top break-words">
      {withCellBreaks(children)}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-t border-slate-100 px-3 py-2 align-top break-words text-slate-700">
      {withCellBreaks(children)}
    </td>
  ),
  tr: ({ children }) => <tr className="even:bg-slate-50/70">{children}</tr>,
};

function withCellBreaks(children: ReactNode): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === "string") {
      if (!child.includes(CELL_BR)) return child;
      const parts = child.split(CELL_BR);
      return parts.map((part, partIndex) => (
        <Fragment key={`${index}-${partIndex}`}>
          {partIndex > 0 ? <br /> : null}
          {part}
        </Fragment>
      ));
    }
    if (isValidElement(child)) {
      const nested = (child.props as { children?: ReactNode }).children;
      if (nested == null) return child;
      return cloneElement(child, undefined, withCellBreaks(nested));
    }
    return child;
  });
}

function isFence(line: string) {
  return /^\s*```/.test(line);
}

function isSeparatorLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(trimmed);
}

function isTableRowLine(line: string) {
  const trimmed = line.trim();
  return trimmed.includes("|") && !isFence(trimmed);
}

function splitCells(line: string) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function isBulletText(text: string) {
  return /^\s*(?:[-*+]|•|●|◦|\d+[.)])\s+\S/.test(text);
}

function flattenCell(text: string) {
  return text
    .split(/\n+/)
    .map((part) => part.trim().replace(/^([-*+]|•|●|◦)\s+/, "• "))
    .filter(Boolean)
    .join(CELL_BR)
    .replace(/\|/g, "\\|");
}

function joinRow(cells: string[]) {
  return `| ${cells.map(flattenCell).join(" | ")} |`;
}

function padCells(cells: string[], count: number) {
  const next = cells.slice(0, count);
  while (next.length < count) next.push("");
  return next;
}

function isStrayBulletRow(cells: string[]) {
  if (!isBulletText(cells[0] || "")) return false;
  return cells.slice(1).every((cell) => !cell.trim());
}

function repairMarkdownTables(text: string) {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    const line = lines[i];
    if (isFence(line)) {
      inFence = !inFence;
      out.push(line);
      i += 1;
      continue;
    }
    if (
      !inFence &&
      isTableRowLine(line) &&
      i + 1 < lines.length &&
      isSeparatorLine(lines[i + 1])
    ) {
      const headerCells = splitCells(line);
      const separator = lines[i + 1];
      const columnCount = Math.max(
        headerCells.length,
        splitCells(separator).length,
        1,
      );
      const body: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const bodyLine = lines[i];
        if (isFence(bodyLine) || isSeparatorLine(bodyLine)) break;
        if (!bodyLine.trim()) break;
        if (!isTableRowLine(bodyLine)) {
          if (body.length && isBulletText(bodyLine)) {
            const prev = body[body.length - 1];
            prev[columnCount - 1] = `${prev[columnCount - 1]}\n${bodyLine.trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        let cells = splitCells(bodyLine);
        if (cells.length > columnCount) {
          cells = [
            ...cells.slice(0, columnCount - 1),
            cells.slice(columnCount - 1).join(" | "),
          ];
        }
        cells = padCells(cells, columnCount);
        if (body.length && isStrayBulletRow(cells)) {
          const prev = body[body.length - 1];
          const extra = cells.filter(Boolean).join("\n");
          prev[columnCount - 1] = `${prev[columnCount - 1]}\n${extra}`;
          i += 1;
          continue;
        }
        body.push(padCells(cells, columnCount));
        i += 1;
      }
      out.push(joinRow(padCells(headerCells, columnCount)));
      out.push(separator);
      body.forEach((row) => out.push(joinRow(row)));
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
}

function normalizeChatMarkdown(text: string) {
  const decoded = (text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/br>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&bull;/gi, "•")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&");
  return repairMarkdownTables(decoded);
}

export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-800 [&_p:last-child]:mb-0 [&_table_ul]:my-1 [&_table_ol]:my-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalizeChatMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
