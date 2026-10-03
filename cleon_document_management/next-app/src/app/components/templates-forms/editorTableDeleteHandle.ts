import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { findTableNodePos, positionFloatingControl } from "./editorBlockNodeView";

export const TableDeleteHandle = Extension.create({
  name: "tableDeleteHandle",

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("tableDeleteHandle");
    return [
      new Plugin({
        key: pluginKey,
        view: (view) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tf-table-remove";
          button.setAttribute("aria-label", "Delete table");
          button.innerHTML = "&times;";

          let host: HTMLElement | null = null;

          const hide = () => {
            button.style.display = "none";
          };

          button.addEventListener("mousedown", (event) => event.preventDefault());
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const tablePos = findTableNodePos(view);
            if (tablePos == null) return;
            const tableNode = view.state.doc.nodeAt(tablePos);
            if (!tableNode) return;
            const tr = view.state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
            view.dispatch(tr);
            hide();
          });

          const update = () => {
            host = view.dom.parentElement;
            if (!host) {
              hide();
              return;
            }
            if (!host.classList.contains("tf-editor-host")) {
              host.classList.add("tf-editor-host");
            }
            if (!host.contains(button)) {
              host.appendChild(button);
            }

            const tablePos = findTableNodePos(view);
            if (tablePos == null) {
              hide();
              return;
            }
            const tableDom = view.nodeDOM(tablePos) as HTMLElement | null;
            if (!tableDom) {
              hide();
              return;
            }
            positionFloatingControl(button, host, tableDom);
          };

          return {
            update: () => update(),
            destroy: () => {
              button.remove();
            },
          };
        },
      }),
    ];
  },
});
