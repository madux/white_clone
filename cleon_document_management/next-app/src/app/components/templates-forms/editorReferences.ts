import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import {
  attachBlockRemoveButton,
  renderBibliographySection,
  renderTocNav,
} from "./editorBlockNodeView";

export type TocItem = {
  id: string;
  level: number;
  text: string;
};

export type HeadingAnchorOptions = {
  levels: number[];
};

function slugify(text: string, used: Set<string>) {
  let base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  let counter = 2;
  while (used.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
}

export function collectDocumentHeadings(editor: Editor): TocItem[] {
  const items: TocItem[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (!text) return;
    const id = String(node.attrs.id || "");
    items.push({
      id,
      level: Number(node.attrs.level || 1),
      text,
    });
  });
  return items;
}

export function ensureHeadingAnchors(editor: Editor) {
  const used = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === "heading" && node.attrs.id) {
      used.add(String(node.attrs.id));
    }
  });

  const { tr } = editor.state;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const text = node.textContent.trim();
    if (!text) return;
    const currentId = node.attrs.id as string | null;
    if (currentId) {
      used.add(currentId);
      return;
    }
    const nextId = slugify(text, used);
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: nextId });
    changed = true;
  });
  if (changed) {
    editor.view.dispatch(tr);
  }
}

export function updateTableOfContentsBlocks(editor: Editor) {
  ensureHeadingAnchors(editor);
  const items = collectDocumentHeadings(editor);
  const { tr } = editor.state;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "tableOfContents") return;
    const current = JSON.stringify(node.attrs.items || []);
    const next = JSON.stringify(items);
    if (current === next) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, items });
    changed = true;
  });
  if (changed) {
    editor.view.dispatch(tr);
  }
  return items.length;
}

export const HeadingWithAnchor = Extension.create<HeadingAnchorOptions>({
  name: "headingWithAnchor",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("id"),
            renderHTML: (attributes) =>
              attributes.id ? { id: String(attributes.id) } : {},
          },
        },
      },
    ];
  },
});

export const TableOfContentsNode = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: [],
        parseHTML: (element) => {
          const raw = element.getAttribute("data-items");
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => ({
          "data-items": JSON.stringify(attributes.items || []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'nav[data-tf-toc="true"]' }];
  },

  renderHTML({ node }) {
    const items = (node.attrs.items || []) as TocItem[];
    const children: Array<unknown> = [
      ["p", { class: "tf-toc-title" }, "Table of contents"],
    ];
    if (!items.length) {
      children.push(
        [
          "p",
          { class: "tf-toc-empty" },
          "No headings yet. Use Home → Styles, then click Update.",
        ],
      );
    } else {
      children.push([
        "ul",
        {},
        ...items.map((item) => [
          "li",
          { class: `tf-toc-level-${item.level}`, "data-level": String(item.level) },
          ["a", { href: `#${item.id}`, "data-toc-target": item.id }, item.text],
        ]),
      ]);
    }
    return ["nav", mergeAttributes({ "data-tf-toc": "true", class: "tf-toc" }), ...children];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "tf-block-wrap tf-toc-wrap";
      dom.contentEditable = "false";

      attachBlockRemoveButton(dom, editor, getPos, "Remove table of contents");

      const mountNav = (source: { attrs: { items?: TocItem[] } }) => {
        const existing = dom.querySelector("nav.tf-toc");
        existing?.remove();
        const items = (source.attrs.items || []) as TocItem[];
        dom.appendChild(renderTocNav(items));
      };
      mountNav(node);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "tableOfContents") return false;
          mountNav(updatedNode);
          return true;
        },
        ignoreMutation: () => true,
        stopEvent: (event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.("a[data-toc-target]")) {
            return false;
          }
          return true;
        },
      };
    };
  },
});

export const BibliographyPlaceholderNode = Node.create({
  name: "bibliographyPlaceholder",
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'section[data-tf-bibliography="true"]' }];
  },

  renderHTML() {
    return [
      "section",
      mergeAttributes({ "data-tf-bibliography": "true", class: "tf-bibliography" }),
      ["h2", { class: "tf-bibliography-heading" }, "References"],
      [
        "p",
        { class: "tf-bibliography-note" },
        "Bibliography placeholder — add sources manually or finish citations in Word after export. PDF export lists this section as plain text.",
      ],
      ["p", { class: "tf-bibliography-hint" }, "[Your references will appear here.]"],
    ];
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "tf-block-wrap tf-bibliography-wrap";
      dom.contentEditable = "false";

      attachBlockRemoveButton(dom, editor, getPos, "Remove bibliography placeholder");
      dom.appendChild(renderBibliographySection());

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: () => true,
      };
    };
  },
});

export function insertTableOfContents(editor: Editor) {
  ensureHeadingAnchors(editor);
  const items = collectDocumentHeadings(editor);
  const inserted = editor
    .chain()
    .focus()
    .insertContent({
      type: "tableOfContents",
      attrs: { items },
    })
    .run();
  return { inserted, headingCount: items.length };
}

export function refreshTableOfContents(editor: Editor) {
  return updateTableOfContentsBlocks(editor);
}

export function insertBibliographyPlaceholder(editor: Editor) {
  return editor.chain().focus().insertContent({ type: "bibliographyPlaceholder" }).run();
}

export function scrollEditorToHeading(editor: Editor, id: string) {
  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading" && node.attrs.id === id) {
      targetPos = pos;
      return false;
    }
    return undefined;
  });
  if (targetPos == null) return false;
  editor.chain().focus().setTextSelection(targetPos + 1).scrollIntoView().run();
  return true;
}

export const REFERENCES_EXPORT_NOTE =
  "Table of contents links work in the editor. Exported PDFs include TOC text and headings; use Word export for clickable cross-references and citation styles.";
