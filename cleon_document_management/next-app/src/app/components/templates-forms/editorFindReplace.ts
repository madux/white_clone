import type { Editor } from "@tiptap/react";

export type FindReplaceResult = {
  found: boolean;
  index: number;
  total: number;
};

function buildTextIndex(editor: Editor) {
  const parts: Array<{ pos: number; text: string }> = [];
  let full = "";
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    parts.push({ pos, text: node.text });
    full += node.text;
  });
  return { full, parts };
}

function offsetToRange(parts: Array<{ pos: number; text: string }>, start: number, length: number) {
  let seen = 0;
  for (const part of parts) {
    const next = seen + part.text.length;
    if (start >= seen && start < next) {
      const from = part.pos + (start - seen);
      return { from, to: from + length };
    }
    seen = next;
  }
  return null;
}

export function findInEditor(
  editor: Editor,
  query: string,
  startAt = 0,
  caseSensitive = false,
): FindReplaceResult & { range?: { from: number; to: number } } {
  const needle = query.trim();
  if (!needle) return { found: false, index: 0, total: 0 };
  const { full, parts } = buildTextIndex(editor);
  const haystack = caseSensitive ? full : full.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  let searchFrom = Math.max(0, startAt);
  let total = 0;
  let index = -1;
  let pos = 0;
  while (pos <= haystack.length) {
    const hit = haystack.indexOf(target, pos);
    if (hit < 0) break;
    total += 1;
    if (index < 0 && hit >= searchFrom) index = hit;
    pos = hit + 1;
  }
  if (index < 0) return { found: false, index: 0, total };
  const range = offsetToRange(parts, index, needle.length);
  if (!range) return { found: false, index: 0, total };
  return { found: true, index, total, range };
}

export function replaceInEditor(
  editor: Editor,
  find: string,
  replace: string,
  replaceAll = false,
  caseSensitive = false,
): number {
  const needle = find.trim();
  if (!needle) return 0;
  let count = 0;
  if (replaceAll) {
    const { full } = buildTextIndex(editor);
    const pattern = caseSensitive
      ? new RegExp(escapeRegExp(needle), "g")
      : new RegExp(escapeRegExp(needle), "gi");
    const next = full.replace(pattern, replace);
    if (next === full) return 0;
    editor.commands.setContent({
      type: "doc",
      content: next.split("\n").map((line) => ({
        type: "paragraph",
        content: line ? [{ type: "text", text: line }] : [],
      })),
    });
    return (full.match(pattern) || []).length;
  }
  const hit = findInEditor(editor, needle, 0, caseSensitive);
  if (!hit.found || !hit.range) return 0;
  editor.chain().focus().deleteRange(hit.range).insertContentAt(hit.range.from, replace).run();
  return 1;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function currentBlockStyle(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "heading1";
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  if (editor.isActive("heading", { level: 4 })) return "heading4";
  return "paragraph";
}

export function applyBlockStyle(editor: Editor, style: string) {
  const chain = editor.chain().focus();
  if (style === "paragraph") {
    chain.setParagraph().run();
    return;
  }
  const level = Number(style.replace("heading", "")) as 1 | 2 | 3 | 4;
  chain.toggleHeading({ level }).run();
}
