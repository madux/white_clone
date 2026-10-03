import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import type { TocItem } from "./editorReferences";

export function attachBlockRemoveButton(
  wrapper: HTMLElement,
  editor: Editor,
  getPos: (() => number | undefined) | boolean,
  label: string,
) {
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "tf-block-remove";
  remove.setAttribute("aria-label", label);
  remove.innerHTML = "&times;";
  remove.addEventListener("mousedown", (event) => event.preventDefault());
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (typeof pos !== "number") return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  });
  wrapper.appendChild(remove);
}

export function renderTocNav(items: TocItem[]) {
  const nav = document.createElement("nav");
  nav.className = "tf-toc";
  nav.setAttribute("data-tf-toc", "true");

  const title = document.createElement("p");
  title.className = "tf-toc-title";
  title.textContent = "Table of contents";
  nav.appendChild(title);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "tf-toc-empty";
    empty.textContent = "No headings yet. Use Home → Styles, then click Update.";
    nav.appendChild(empty);
    return nav;
  }

  const list = document.createElement("ul");
  items.forEach((item) => {
    const row = document.createElement("li");
    row.className = `tf-toc-level-${item.level}`;
    row.dataset.level = String(item.level);
    const link = document.createElement("a");
    link.href = `#${item.id}`;
    link.dataset.tocTarget = item.id;
    link.textContent = item.text;
    row.appendChild(link);
    list.appendChild(row);
  });
  nav.appendChild(list);
  return nav;
}

export function renderBibliographySection() {
  const section = document.createElement("section");
  section.className = "tf-bibliography";
  section.setAttribute("data-tf-bibliography", "true");

  const heading = document.createElement("h2");
  heading.className = "tf-bibliography-heading";
  heading.textContent = "References";
  section.appendChild(heading);

  const note = document.createElement("p");
  note.className = "tf-bibliography-note";
  note.textContent =
    "Bibliography placeholder — add sources manually or finish citations in Word after export. PDF export lists this section as plain text.";
  section.appendChild(note);

  const hint = document.createElement("p");
  hint.className = "tf-bibliography-hint";
  hint.textContent = "[Your references will appear here.]";
  section.appendChild(hint);

  return section;
}

export function findTableNodePos(view: EditorView): number | null {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") {
      return $from.before(depth);
    }
  }
  return null;
}

export function positionFloatingControl(
  control: HTMLElement,
  host: HTMLElement,
  target: HTMLElement,
) {
  const hostRect = host.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  control.style.display = "flex";
  control.style.left = `${targetRect.right - hostRect.left - control.offsetWidth - 4 + host.scrollLeft}px`;
  control.style.top = `${targetRect.top - hostRect.top + 4 + host.scrollTop}px`;
}
