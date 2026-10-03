import type { Editor } from "@tiptap/react";
import { updateBibliographyBlocks } from "./editorCitations";
import { updateIndexBlocks } from "./editorIndex";
import { updateTableOfContentsBlocks } from "./editorReferences";

export function refreshReferenceBlocks(editor: Editor) {
  updateTableOfContentsBlocks(editor);
  updateBibliographyBlocks(editor);
  updateIndexBlocks(editor);
}
