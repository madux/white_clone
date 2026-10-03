"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import WordRibbon from "./WordRibbon";
import EditorFindReplaceDialog from "./EditorFindReplaceDialog";
import EditorReferencesExportNoteDialog from "./EditorReferencesExportNoteDialog";
import EditorTocHelpDialog from "./EditorTocHelpDialog";
import {
  BibliographyPlaceholderNode,
  HeadingWithAnchor,
  TableOfContentsNode,
  scrollEditorToHeading,
} from "./editorReferences";
import { TableDeleteHandle } from "./editorTableDeleteHandle";
import {
  DEFAULT_PAGE_LAYOUT,
  pageSurfaceStyle,
  type PageLayoutState,
} from "./editorPageLayout";
import { BibliographyMetaNode, EditorDocumentMeta, migrateBibliographyMetaFromLegacy } from "./editorDocumentMeta";
import {
  EndnotesSection,
  FootnoteEntry,
  FootnoteReference,
  FootnotesSection,
} from "./editorFootnotes";
import { BibliographyGenerated, CitationReference } from "./editorCitations";
import { CrossReference, FigureCaption } from "./editorCaptions";
import { DocumentIndex, IndexMark } from "./editorIndex";
import { refreshReferenceBlocks } from "./editorReferenceRefresh";
import EditorSourcesDialog from "./EditorSourcesDialog";
import EditorCiteDialog from "./EditorCiteDialog";
import EditorCrossRefDialog from "./EditorCrossRefDialog";
import EditorIndexMarkDialog from "./EditorIndexMarkDialog";

export default function TiptapEditor({
  json,
  text,
  onChange,
  onReady,
  onComments,
  onAi,
  trackChangesEnabled = false,
  onTrackChangesToggle,
  onOpenTrackChanges,
  wordCount,
}: {
  json: string;
  text: string;
  onChange: (json: string, text: string) => void;
  onReady?: (editor: any) => void;
  onComments: () => void;
  onAi: () => void;
  trackChangesEnabled?: boolean;
  onTrackChangesToggle?: () => void;
  onOpenTrackChanges?: () => void;
  wordCount?: number;
}) {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState("Home");
  const [pageLayout, setPageLayout] = useState<PageLayoutState>(DEFAULT_PAGE_LAYOUT);
  const [findOpen, setFindOpen] = useState(false);
  const [referencesNoteOpen, setReferencesNoteOpen] = useState(false);
  const [tocHelpOpen, setTocHelpOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const [crossRefOpen, setCrossRefOpen] = useState(false);
  const [indexMarkOpen, setIndexMarkOpen] = useState(false);
  const skipChangeRef = useRef(true);
  const loadedJsonRef = useRef("");
  const lastEmittedJsonRef = useRef("");
  const tocRefreshTimer = useRef(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextStyle.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fontSize: {
              default: null,
              parseHTML: (element) => element.style.fontSize || null,
              renderHTML: (attributes) =>
                attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
            },
          };
        },
      }),
      Color,
      FontFamily,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      HeadingWithAnchor,
      TableOfContentsNode,
      BibliographyPlaceholderNode,
      EditorDocumentMeta,
      BibliographyMetaNode,
      FootnoteReference,
      FootnoteEntry,
      FootnotesSection,
      EndnotesSection,
      CitationReference,
      BibliographyGenerated,
      FigureCaption,
      CrossReference,
      IndexMark,
      DocumentIndex,
      TableDeleteHandle,
    ],
    content: parseContent(json, text),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      if (skipChangeRef.current) return;
      const snapshot = JSON.stringify(current.getJSON());
      lastEmittedJsonRef.current = snapshot;
      onChange(snapshot, current.getText());
      window.clearTimeout(tocRefreshTimer.current);
      tocRefreshTimer.current = window.setTimeout(() => {
        refreshReferenceBlocks(current);
      }, 400);
    },
    onSelectionUpdate: () => setTick((value) => value + 1),
    onTransaction: () => setTick((value) => value + 1),
  });

  useEffect(() => {
    (window as any).__tfEditor = editor;
    if (editor) {
      migrateBibliographyMetaFromLegacy(editor);
      onReady?.(editor);
    }
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a[data-toc-target]") as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      const id = link.getAttribute("data-toc-target") || link.getAttribute("href")?.replace(/^#/, "");
      if (id) scrollEditorToHeading(editor, id);
    };
    editor.view.dom.addEventListener("click", onClick);
    return () => editor.view.dom.removeEventListener("click", onClick);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const normalized = json || "";
    if (normalized === loadedJsonRef.current) return;
    if (normalized === lastEmittedJsonRef.current) {
      loadedJsonRef.current = normalized;
      return;
    }
    loadedJsonRef.current = normalized;
    lastEmittedJsonRef.current = normalized;
    skipChangeRef.current = true;
    editor.commands.setContent(parseContent(json, text), { emitUpdate: false });
    const timer = window.setTimeout(() => {
      skipChangeRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, json, text]);

  if (!editor) return <p className="p-6 text-sm text-slate-400">Loading editor…</p>;

  const plain = editor.getText();
  const chars = wordCount ?? plain.length;
  const words = plain.trim() ? plain.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WordRibbon
        editor={editor}
        tab={tab}
        onTab={setTab}
        onComments={onComments}
        onAi={onAi}
        onOpenFindReplace={() => setFindOpen(true)}
        trackChangesEnabled={trackChangesEnabled}
        onTrackChangesToggle={() => onTrackChangesToggle?.()}
        onOpenTrackChanges={() => onOpenTrackChanges?.()}
        pageLayout={pageLayout}
        onPageLayoutChange={(patch) => setPageLayout((current) => ({ ...current, ...patch }))}
        onReferencesExportNote={() => setReferencesNoteOpen(true)}
        onInsertToc={() => setTocHelpOpen(true)}
        onOpenSources={() => setSourcesOpen(true)}
        onOpenCite={() => setCiteOpen(true)}
        onOpenCrossRef={() => setCrossRefOpen(true)}
        onOpenIndexMark={() => setIndexMarkOpen(true)}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-[#e8e8e8] p-6">
        <div
          className={`tf-page mx-auto bg-white shadow-md ${trackChangesEnabled ? "tf-track-changes-on" : ""}`}
          style={pageSurfaceStyle(pageLayout) as CSSProperties}
        >
          <EditorContent editor={editor} className="tf-editor tf-editor-host" />
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-[#f8f8f8] px-4 py-1.5 text-[11px] text-slate-500 print:hidden">
        <span>{words} words · {chars} characters</span>
        <span>Track changes: {trackChangesEnabled ? "On" : "Off"}</span>
        <span>English (UK)</span>
      </footer>
      <EditorFindReplaceDialog editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />
      <EditorReferencesExportNoteDialog
        open={referencesNoteOpen}
        onClose={() => setReferencesNoteOpen(false)}
      />
      <EditorTocHelpDialog open={tocHelpOpen} onClose={() => setTocHelpOpen(false)} />
      <EditorSourcesDialog editor={editor} open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <EditorCiteDialog editor={editor} open={citeOpen} onClose={() => setCiteOpen(false)} />
      <EditorCrossRefDialog editor={editor} open={crossRefOpen} onClose={() => setCrossRefOpen(false)} />
      <EditorIndexMarkDialog editor={editor} open={indexMarkOpen} onClose={() => setIndexMarkOpen(false)} />
    </div>
  );
}

function parseContent(json: string, text: string) {
  try {
    const parsed = JSON.parse(json || "");
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    /* use plaintext */
  }
  const lines = (text || "").split("\n");
  return {
    type: "doc",
    content: (lines.length ? lines : [""]).map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
