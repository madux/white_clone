import { Mark, Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export type IndexEntry = {
  main: string;
  sub?: string;
  pageHint?: string;
};

export function collectIndexEntries(editor: Editor): IndexEntry[] {
  const map = new Map<string, IndexEntry>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    const mark = node.marks.find((item) => item.type.name === "indexMark");
    if (!mark) return;
    const main = String(mark.attrs.main || "").trim();
    if (!main) return;
    const sub = String(mark.attrs.sub || "").trim();
    const key = `${main.toLowerCase()}::${sub.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, { main, sub: sub || undefined });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const left = `${a.main} ${a.sub || ""}`.toLowerCase();
    const right = `${b.main} ${b.sub || ""}`.toLowerCase();
    return left.localeCompare(right);
  });
}

export function markIndexEntry(editor: Editor, main: string, sub?: string) {
  const trimmed = main.trim();
  if (!trimmed || editor.state.selection.empty) return false;
  return editor
    .chain()
    .focus()
    .setMark("indexMark", { main: trimmed, sub: sub?.trim() || "" })
    .run();
}

export function insertIndexBlock(editor: Editor) {
  const entries = collectIndexEntries(editor);
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "documentIndex",
      attrs: { entries },
    })
    .run();
}

export function updateIndexBlocks(editor: Editor) {
  const entries = collectIndexEntries(editor);
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "documentIndex") return;
    const current = JSON.stringify(node.attrs.entries || []);
    const next = JSON.stringify(entries);
    if (current === next) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, entries });
    changed = true;
  });
  if (changed) editor.view.dispatch(tr);
}

export const IndexMark = Mark.create({
  name: "indexMark",
  inclusive: false,

  addAttributes() {
    return {
      main: { default: "" },
      sub: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-index-mark]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "tf-index-mark",
        "data-index-mark": "true",
      }),
      0,
    ];
  },
});

export const DocumentIndex = Node.create({
  name: "documentIndex",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      entries: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-document-index="true"]' }];
  },

  renderHTML({ node }) {
    const entries = (node.attrs.entries || []) as IndexEntry[];
    return [
      "section",
      mergeAttributes({ "data-document-index": "true", class: "tf-document-index" }),
      ["h2", { class: "tf-document-index-title" }, "Index"],
      [
        "ul",
        {},
        ...entries.map((entry) => [
          "li",
          {},
          entry.sub ? `${entry.main}: ${entry.sub}` : entry.main,
        ]),
      ],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "tf-block-wrap tf-index-wrap";
      dom.contentEditable = "false";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tf-block-remove";
      remove.setAttribute("aria-label", "Remove index");
      remove.innerHTML = "&times;";
      remove.addEventListener("mousedown", (e) => e.preventDefault());
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (typeof pos !== "number") return;
        const target = editor.state.doc.nodeAt(pos);
        if (!target) return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + target.nodeSize }).run();
      });
      dom.appendChild(remove);

      const section = document.createElement("section");
      section.className = "tf-document-index";
      const title = document.createElement("h2");
      title.className = "tf-document-index-title";
      title.textContent = "Index";
      section.appendChild(title);

      const entries = (node.attrs.entries || []) as IndexEntry[];
      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "tf-toc-empty";
        empty.textContent = "Mark text with Index → Mark entry, then insert the index.";
        section.appendChild(empty);
      } else {
        const list = document.createElement("ul");
        entries.forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = entry.sub ? `${entry.main}: ${entry.sub}` : entry.main;
          list.appendChild(li);
        });
        section.appendChild(list);
      }
      dom.appendChild(section);

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== "documentIndex") return false;
          return true;
        },
        ignoreMutation: () => true,
        stopEvent: () => true,
      };
    };
  },
});
