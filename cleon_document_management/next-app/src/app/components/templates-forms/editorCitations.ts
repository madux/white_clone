import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { readDocMeta, writeDocMeta } from "./editorDocumentMeta";

export type CitationStyle = "apa" | "numeric";

export type BibliographySource = {
  id: string;
  author: string;
  title: string;
  year: string;
  publisher?: string;
};

export function newSourceId() {
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatCitationLabel(source: BibliographySource, style: CitationStyle, index: number) {
  if (style === "numeric") return `[${index}]`;
  const author = source.author.trim() || "Unknown";
  const year = source.year.trim() || "n.d.";
  return `(${author}, ${year})`;
}

export function formatBibliographyLine(source: BibliographySource, style: CitationStyle, index: number) {
  if (style === "numeric") {
    return `[${index}] ${source.author}. (${source.year}). ${source.title}.`;
  }
  return `${source.author} (${source.year}). ${source.title}.`;
}

export function getSourcesInDocumentOrder(editor: Editor) {
  const meta = readDocMeta(editor);
  const citedIds: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "citationReference") return;
    const id = String(node.attrs.sourceId || "");
    if (id && !citedIds.includes(id)) citedIds.push(id);
  });
  return citedIds
    .map((id) => meta.bibliographySources.find((item) => item.id === id))
    .filter(Boolean) as BibliographySource[];
}

export function insertCitation(editor: Editor, sourceId: string) {
  const meta = readDocMeta(editor);
  const source = meta.bibliographySources.find((item) => item.id === sourceId);
  if (!source) return false;
  const cited = getSourcesInDocumentOrder(editor);
  const index = cited.findIndex((item) => item.id === sourceId);
  const displayIndex = index >= 0 ? index + 1 : cited.length + 1;
  const label = formatCitationLabel(source, meta.citationStyle, displayIndex);
  const ok = editor
    .chain()
    .focus()
    .insertContent({
      type: "citationReference",
      attrs: { sourceId, label },
    })
    .run();
  if (ok) refreshCitationLabels(editor);
  return ok;
}

export function setCitationStyle(editor: Editor, style: CitationStyle) {
  writeDocMeta(editor, { citationStyle: style });
  refreshCitationLabels(editor);
}

export function refreshCitationLabels(editor: Editor) {
  const meta = readDocMeta(editor);
  const cited = getSourcesInDocumentOrder(editor);
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "citationReference") return;
    const sourceId = String(node.attrs.sourceId || "");
    const source = meta.bibliographySources.find((item) => item.id === sourceId);
    if (!source) return;
    const index = cited.findIndex((item) => item.id === sourceId) + 1;
    const label = formatCitationLabel(source, meta.citationStyle, index);
    if (node.attrs.label === label) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, label });
    changed = true;
  });
  if (changed) editor.view.dispatch(tr);
}

export function insertGeneratedBibliography(editor: Editor) {
  const cited = getSourcesInDocumentOrder(editor);
  const meta = readDocMeta(editor);
  const lines = cited.map((source, index) =>
    formatBibliographyLine(source, meta.citationStyle, index + 1),
  );
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "bibliographyGenerated",
      attrs: { lines },
    })
    .run();
}

export function updateBibliographyBlocks(editor: Editor) {
  const cited = getSourcesInDocumentOrder(editor);
  const meta = readDocMeta(editor);
  const lines = cited.map((source, index) =>
    formatBibliographyLine(source, meta.citationStyle, index + 1),
  );
  const tr = editor.state.tr;
  let changed = false;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "bibliographyGenerated") return;
    const current = JSON.stringify(node.attrs.lines || []);
    const next = JSON.stringify(lines);
    if (current === next) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, lines });
    changed = true;
  });
  if (changed) editor.view.dispatch(tr);
}

export const CitationReference = Node.create({
  name: "citationReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      sourceId: { default: null },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-citation-ref]" }];
  },

  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({
        class: "tf-citation-ref",
        "data-citation-ref": "true",
        "data-source-id": node.attrs.sourceId,
      }),
      node.attrs.label || "",
    ];
  },
});

export const BibliographyGenerated = Node.create({
  name: "bibliographyGenerated",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      lines: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-bibliography-generated="true"]' }];
  },

  renderHTML({ node }) {
    const lines = (node.attrs.lines || []) as string[];
    return [
      "section",
      mergeAttributes({ "data-bibliography-generated": "true", class: "tf-bibliography tf-bibliography-generated" }),
      ["h2", { class: "tf-bibliography-heading" }, "References"],
      [
        "ol",
        { class: "tf-bibliography-list" },
        ...lines.map((line) => ["li", {}, line]),
      ],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "tf-block-wrap tf-bibliography-wrap";
      dom.contentEditable = "false";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tf-block-remove";
      remove.setAttribute("aria-label", "Remove bibliography");
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
      section.className = "tf-bibliography tf-bibliography-generated";
      const heading = document.createElement("h2");
      heading.className = "tf-bibliography-heading";
      heading.textContent = "References";
      section.appendChild(heading);
      const list = document.createElement("ol");
      list.className = "tf-bibliography-list";
      const lines = (node.attrs.lines || []) as string[];
      if (!lines.length) {
        const empty = document.createElement("p");
        empty.className = "tf-bibliography-hint";
        empty.textContent = "Add sources and insert citations to populate this list.";
        section.appendChild(empty);
      } else {
        lines.forEach((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          list.appendChild(li);
        });
        section.appendChild(list);
      }
      dom.appendChild(section);

      return {
        dom,
        update: (updated) => {
          if (updated.type.name !== "bibliographyGenerated") return false;
          const nextLines = (updated.attrs.lines || []) as string[];
          list.replaceChildren();
          if (!nextLines.length) return true;
          nextLines.forEach((line) => {
            const li = document.createElement("li");
            li.textContent = line;
            list.appendChild(li);
          });
          return true;
        },
        ignoreMutation: () => true,
        stopEvent: () => true,
      };
    };
  },
});
