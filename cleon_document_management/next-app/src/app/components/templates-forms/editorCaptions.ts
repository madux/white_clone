import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { findTableNodePos } from "./editorBlockNodeView";

export type CaptionKind = "table" | "figure";

function newCaptionId(kind: CaptionKind) {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function countCaptions(editor: Editor, kind: CaptionKind) {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "figureCaption" && node.attrs.kind === kind) count += 1;
  });
  return count;
}

export function insertCaptionForTable(editor: Editor) {
  const tablePos = findTableNodePos(editor.view);
  if (tablePos == null) return { ok: false, message: "Place the cursor in a table first." };
  const tableNode = editor.state.doc.nodeAt(tablePos);
  if (!tableNode) return { ok: false, message: "Table not found." };
  const number = countCaptions(editor, "table") + 1;
  const id = newCaptionId("table");
  const insertAt = tablePos + tableNode.nodeSize;
  const ok = editor
    .chain()
    .focus()
    .insertContentAt(insertAt, {
      type: "figureCaption",
      attrs: {
        id,
        kind: "table",
        number,
        label: `Table ${number}`,
      },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Describe this table." }] }],
    })
    .run();
  return { ok, message: ok ? undefined : "Could not insert caption." };
}

export function insertCaptionForSelection(editor: Editor) {
  const number = countCaptions(editor, "figure") + 1;
  const id = newCaptionId("figure");
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "figureCaption",
      attrs: {
        id,
        kind: "figure",
        number,
        label: `Figure ${number}`,
      },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Describe this figure." }] }],
    })
    .run();
}

export function listCaptionTargets(editor: Editor) {
  const items: Array<{ id: string; label: string }> = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "figureCaption") return;
    items.push({
      id: String(node.attrs.id),
      label: String(node.attrs.label || "Caption"),
    });
  });
  return items;
}

export function insertCrossReference(editor: Editor, targetId: string) {
  const targets = listCaptionTargets(editor);
  const target = targets.find((item) => item.id === targetId);
  if (!target) return false;
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "crossReference",
      attrs: { targetId, label: target.label },
    })
    .run();
}

export const FigureCaption = Node.create({
  name: "figureCaption",
  content: "paragraph+",
  group: "block",
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      kind: { default: "figure" },
      number: { default: 1 },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figcaption[data-figure-caption]" }];
  },

  renderHTML({ node }) {
    return [
      "figcaption",
      mergeAttributes({
        class: "tf-figure-caption",
        "data-figure-caption": "true",
        "data-caption-id": node.attrs.id,
        "data-label": node.attrs.label,
      }),
      0,
    ];
  },
});

export const CrossReference = Node.create({
  name: "crossReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      targetId: { default: null },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-cross-ref]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({
        class: "tf-cross-ref",
        "data-cross-ref": "true",
        "data-target-id": node.attrs.targetId,
      }),
      node.attrs.label || "Reference",
    ];
  },
});
