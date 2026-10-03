import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import type { BibliographySource, CitationStyle } from "./editorCitations";

export type EditorDocMeta = {
  bibliographySources: BibliographySource[];
  citationStyle: CitationStyle;
};

/** Hidden block — doc-level attrs cannot be updated at runtime in TipTap/PM. */
export const BibliographyMetaNode = Node.create({
  name: "bibliographyMeta",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return {
      bibliographySources: {
        default: [],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-bibliography-sources");
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-bibliography-sources": JSON.stringify(attributes.bibliographySources || []),
        }),
      },
      citationStyle: {
        default: "apa",
        parseHTML: (element) => element.getAttribute("data-citation-style") || "apa",
        renderHTML: (attributes) => ({
          "data-citation-style": attributes.citationStyle || "apa",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-tf-bibliography-meta="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-tf-bibliography-meta": "true",
        class: "tf-bibliography-meta",
        contenteditable: "false",
      }),
    ];
  },
});

/** Legacy: doc attrs only applied on initial parse; kept for older HTML/JSON. */
export const EditorDocumentMeta = Extension.create({
  name: "editorDocumentMeta",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          bibliographySources: {
            default: [],
            parseHTML: (element) => {
              const raw = element.getAttribute("data-bibliography-sources");
              if (!raw) return [];
              try {
                return JSON.parse(raw);
              } catch {
                return [];
              }
            },
            renderHTML: (attributes) => ({
              "data-bibliography-sources": JSON.stringify(attributes.bibliographySources || []),
            }),
          },
          citationStyle: {
            default: "apa",
            parseHTML: (element) => element.getAttribute("data-citation-style") || "apa",
            renderHTML: (attributes) => ({
              "data-citation-style": attributes.citationStyle || "apa",
            }),
          },
        },
      },
    ];
  },
});

export function findBibliographyMetaPos(editor: Editor): number | null {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "bibliographyMeta") {
      found = pos;
      return false;
    }
  });
  return found;
}

function readLegacyDocMeta(editor: Editor): EditorDocMeta | null {
  const attrs = editor.state.doc.attrs as Record<string, unknown>;
  const legacySources = attrs.bibliographySources as BibliographySource[] | undefined;
  const legacyStyle = attrs.citationStyle as CitationStyle | undefined;
  if (!legacySources?.length && !legacyStyle) return null;
  return {
    bibliographySources: legacySources || [],
    citationStyle: legacyStyle || "apa",
  };
}

export function readDocMeta(editor: Editor): EditorDocMeta {
  let sources: BibliographySource[] = [];
  let citationStyle: CitationStyle = "apa";
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "bibliographyMeta") return;
    sources = (node.attrs.bibliographySources as BibliographySource[]) || [];
    citationStyle = (node.attrs.citationStyle as CitationStyle) || "apa";
    return false;
  });
  if (!sources.length) {
    const legacy = readLegacyDocMeta(editor);
    if (legacy?.bibliographySources.length) {
      sources = legacy.bibliographySources;
      citationStyle = legacy.citationStyle;
    }
  }
  return { bibliographySources: sources, citationStyle };
}

function ensureBibliographyMetaNode(editor: Editor, meta: EditorDocMeta): number | null {
  const existing = findBibliographyMetaPos(editor);
  if (existing != null) return existing;
  const ok = editor
    .chain()
    .insertContentAt(0, {
      type: "bibliographyMeta",
      attrs: {
        bibliographySources: meta.bibliographySources,
        citationStyle: meta.citationStyle,
      },
    })
    .run();
  if (!ok) return null;
  return findBibliographyMetaPos(editor);
}

export function writeDocMeta(editor: Editor, patch: Partial<EditorDocMeta>) {
  const current = readDocMeta(editor);
  const next: EditorDocMeta = { ...current, ...patch };
  const pos = ensureBibliographyMetaNode(editor, next);
  if (pos == null) return;
  const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
    bibliographySources: next.bibliographySources,
    citationStyle: next.citationStyle,
  });
  editor.view.dispatch(tr);
}

/** Move legacy doc.attrs sources into bibliographyMeta after load. */
export function migrateBibliographyMetaFromLegacy(editor: Editor) {
  if (findBibliographyMetaPos(editor) != null) return;
  const legacy = readLegacyDocMeta(editor);
  if (!legacy?.bibliographySources.length) return;
  writeDocMeta(editor, legacy);
}
