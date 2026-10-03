import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export type FootnoteNoteType = "footnote" | "endnote";

function newFootnoteId() {
  return `fn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function collectFootnoteRefs(editor: Editor, noteType?: FootnoteNoteType) {
  const items: Array<{ id: string; number: number; pos: number; noteType: FootnoteNoteType }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "footnoteReference") return;
    const type = (node.attrs.noteType as FootnoteNoteType) || "footnote";
    if (noteType && type !== noteType) return;
    items.push({
      id: String(node.attrs.id),
      number: Number(node.attrs.number || 0),
      pos,
      noteType: type,
    });
  });
  return items.sort((a, b) => a.pos - b.pos);
}

function footnoteSectionName(noteType: FootnoteNoteType) {
  return noteType === "endnote" ? "endnotesSection" : "footnotesSection";
}

function footnoteEntryName() {
  return "footnoteEntry";
}

function findFootnoteSectionPos(editor: Editor, noteType: FootnoteNoteType) {
  const sectionType = footnoteSectionName(noteType);
  let sectionPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === sectionType) {
      sectionPos = pos;
      return false;
    }
    return undefined;
  });
  return sectionPos;
}

function nextFootnoteNumber(editor: Editor, noteType: FootnoteNoteType) {
  const refs = collectFootnoteRefs(editor, noteType);
  if (!refs.length) return 1;
  return Math.max(...refs.map((item) => item.number)) + 1;
}

export function insertFootnote(editor: Editor, noteType: FootnoteNoteType = "footnote") {
  const id = newFootnoteId();
  const number = nextFootnoteNumber(editor, noteType);
  const sectionType = footnoteSectionName(noteType);
  const entry = {
    type: footnoteEntryName(),
    attrs: { id, number, noteType },
    content: [{ type: "paragraph", content: [{ type: "text", text: "Footnote text." }] }],
  };
  const ref = {
    type: "footnoteReference",
    attrs: { id, number, noteType },
  };

  const sectionPos = findFootnoteSectionPos(editor, noteType);
  if (sectionPos == null) {
    return editor
      .chain()
      .focus()
      .insertContent(ref)
      .insertContentAt(editor.state.doc.content.size, {
        type: sectionType,
        content: [entry],
      })
      .run();
  }

  const section = editor.state.doc.nodeAt(sectionPos);
  if (!section) return false;
  const insertAt = sectionPos + Math.max(1, section.nodeSize - 1);
  return editor.chain().focus().insertContent(ref).insertContentAt(insertAt, entry).run();
}

export function gotoNextFootnote(editor: Editor) {
  const refs = collectFootnoteRefs(editor);
  if (!refs.length) return false;
  const { from } = editor.state.selection;
  let currentIndex = refs.findIndex((item) => from >= item.pos && from <= item.pos + 1);
  if (currentIndex < 0) {
    const next = refs.find((item) => item.pos > from) || refs[0];
    return focusFootnoteTarget(editor, next.id);
  }
  const nextRef = refs[(currentIndex + 1) % refs.length];
  return focusFootnoteTarget(editor, nextRef.id);
}

function focusFootnoteTarget(editor: Editor, id: string) {
  let entryPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteEntry" && node.attrs.id === id) {
      entryPos = pos;
      return false;
    }
    return undefined;
  });
  if (entryPos != null) {
    editor.chain().focus().setTextSelection(entryPos + 2).scrollIntoView().run();
    return true;
  }
  let refPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteReference" && node.attrs.id === id) {
      refPos = pos;
      return false;
    }
    return undefined;
  });
  if (refPos != null) {
    editor.chain().focus().setTextSelection(refPos + 1).scrollIntoView().run();
    return true;
  }
  return false;
}

export const FootnoteReference = Node.create({
  name: "footnoteReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      number: { default: 1 },
      noteType: { default: "footnote" },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote-ref]" }];
  },

  renderHTML({ node }) {
    return [
      "sup",
      mergeAttributes({
        class: "tf-footnote-ref",
        "data-footnote-ref": "true",
        "data-footnote-id": node.attrs.id,
        "data-note-type": node.attrs.noteType,
      }),
      String(node.attrs.number),
    ];
  },
});

export const FootnoteEntry = Node.create({
  name: "footnoteEntry",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      number: { default: 1 },
      noteType: { default: "footnote" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-footnote-entry]" }];
  },

  renderHTML({ node }) {
    return [
      "div",
      mergeAttributes({
        class: "tf-footnote-entry",
        "data-footnote-entry": "true",
        "data-footnote-id": node.attrs.id,
        "data-footnote-number": node.attrs.number,
      }),
      0,
    ];
  },
});

export const FootnotesSection = Node.create({
  name: "footnotesSection",
  content: "footnoteEntry*",
  group: "block",
  defining: true,

  parseHTML() {
    return [{ tag: 'section[data-footnotes-section="true"]' }];
  },

  renderHTML() {
    return [
      "section",
      mergeAttributes({ "data-footnotes-section": "true", class: "tf-footnotes-section" }),
      0,
    ];
  },
});

export const EndnotesSection = Node.create({
  name: "endnotesSection",
  content: "footnoteEntry*",
  group: "block",
  defining: true,

  parseHTML() {
    return [{ tag: 'section[data-endnotes-section="true"]' }];
  },

  renderHTML() {
    return [
      "section",
      mergeAttributes({ "data-endnotes-section": "true", class: "tf-footnotes-section tf-endnotes-section" }),
      0,
    ];
  },
});
