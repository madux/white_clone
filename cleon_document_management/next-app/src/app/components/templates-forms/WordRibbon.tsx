"use client";

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Printer,
  Redo2,
  Replace,
  Search,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  BookOpen,
  RefreshCw,
  Plus,
  Quote,
  Link2,
  Image,
  Pencil,
  FileText,
  Info,
} from "lucide-react";
import { applyBlockStyle, currentBlockStyle } from "./editorFindReplace";
import {
  insertBibliographyPlaceholder,
  insertTableOfContents,
} from "./editorReferences";
import { insertFootnote, gotoNextFootnote } from "./editorFootnotes";
import { insertGeneratedBibliography, setCitationStyle, type CitationStyle } from "./editorCitations";
import { readDocMeta } from "./editorDocumentMeta";
import { insertCaptionForSelection, insertCaptionForTable } from "./editorCaptions";
import { insertIndexBlock } from "./editorIndex";
import { refreshReferenceBlocks } from "./editorReferenceRefresh";
import {
  MARGIN_PRESETS,
  PAGE_SIZES,
  marginSummary,
  type MarginPreset,
  type PageLayoutState,
  type PageOrientation,
  type PageSizeKey,
} from "./editorPageLayout";

const TABS = [
  "File",
  "Home",
  "Insert",
  "Layout",
  "References",
  "Review",
  "View",
  "AI Assistant",
] as const;

const FONTS = ["Arial", "Calibri", "Georgia", "Times New Roman", "Courier New"];
const SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "24px", "36px"];
const STYLES = [
  { value: "paragraph", label: "Normal" },
  { value: "heading1", label: "Heading 1" },
  { value: "heading2", label: "Heading 2" },
  { value: "heading3", label: "Heading 3" },
  { value: "heading4", label: "Heading 4" },
];

export default function WordRibbon({
  editor,
  tab,
  onTab,
  onComments,
  onAi,
  onOpenFindReplace,
  trackChangesEnabled,
  onTrackChangesToggle,
  onOpenTrackChanges,
  pageLayout,
  onPageLayoutChange,
  onReferencesExportNote,
  onInsertToc,
  onOpenSources,
  onOpenCite,
  onOpenCrossRef,
  onOpenIndexMark,
}: {
  editor: Editor | null;
  tab: string;
  onTab: (tab: string) => void;
  onComments: () => void;
  onAi: () => void;
  onOpenFindReplace: () => void;
  trackChangesEnabled: boolean;
  onTrackChangesToggle: () => void;
  onOpenTrackChanges: () => void;
  pageLayout: PageLayoutState;
  onPageLayoutChange: (patch: Partial<PageLayoutState>) => void;
  onReferencesExportNote: () => void;
  onInsertToc: () => void;
  onOpenSources: () => void;
  onOpenCite: () => void;
  onOpenCrossRef: () => void;
  onOpenIndexMark: () => void;
}) {
  const blockStyle = editor ? currentBlockStyle(editor) : "paragraph";
  const citationStyle = editor ? readDocMeta(editor).citationStyle : "apa";
  const margins = marginSummary(pageLayout);

  return (
    <div className="tf-ribbon shrink-0 border-b border-slate-200 bg-[#f3f3f3] print:hidden">
      <div className="flex items-end gap-0 border-b border-slate-200 bg-white px-3 pt-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onTab(name)}
            className={`tf-ribbon-tab px-3 py-2 text-xs font-semibold ${
              tab === name ? "tf-ribbon-tab-active bg-[#f3f3f3]" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="tf-ribbon-tools flex flex-nowrap items-stretch gap-0 overflow-x-auto px-2 py-2">
        {tab === "File" && (
          <RibbonGroup label="File">
            <RibbonButton label="Print" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} />
          </RibbonGroup>
        )}
        {tab === "Home" && (
          <>
            <RibbonGroup label="Undo">
              <RibbonIcon
                disabled={!editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
                label="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                disabled={!editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
                label="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </RibbonIcon>
            </RibbonGroup>
            <RibbonGroup label="Styles">
              <select
                aria-label="Text style"
                className="h-7 min-w-[120px] rounded border border-slate-300 bg-white px-1 text-xs"
                value={blockStyle}
                onChange={(event) => editor && applyBlockStyle(editor, event.target.value)}
              >
                {STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </RibbonGroup>
            <RibbonGroup label="Font">
              <select
                aria-label="Font"
                className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
                value={String(editor?.getAttributes("textStyle").fontFamily || "Arial")}
                onChange={(event) => editor?.chain().focus().setFontFamily(event.target.value).run()}
              >
                {FONTS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
              <select
                aria-label="Font size"
                className="h-7 w-16 rounded border border-slate-300 bg-white px-1 text-xs"
                value={String(editor?.getAttributes("textStyle").fontSize || "11px")}
                onChange={(event) =>
                  editor?.chain().focus().setMark("textStyle", { fontSize: event.target.value }).run()
                }
              >
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size.replace("px", "")}
                  </option>
                ))}
              </select>
              <RibbonIcon
                active={Boolean(editor?.isActive("bold"))}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                label="Bold"
              >
                <Bold className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive("italic"))}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                label="Italic"
              >
                <Italic className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive("underline"))}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                label="Underline"
              >
                <Underline className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive("strike"))}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                label="Strikethrough"
              >
                <Strikethrough className="h-4 w-4" />
              </RibbonIcon>
              <label className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-white" title="Text color">
                <Highlighter className="h-4 w-4" />
                <input
                  type="color"
                  aria-label="Text color"
                  className="sr-only"
                  onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
                />
              </label>
            </RibbonGroup>
            <RibbonGroup label="Paragraph">
              <RibbonIcon
                active={Boolean(editor?.isActive("bulletList"))}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                label="Bullets"
              >
                <List className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive("orderedList"))}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                label="Numbering"
              >
                <ListOrdered className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive({ textAlign: "left" }))}
                onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                label="Align left"
              >
                <AlignLeft className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive({ textAlign: "center" }))}
                onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                label="Align center"
              >
                <AlignCenter className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive({ textAlign: "right" }))}
                onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                label="Align right"
              >
                <AlignRight className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon
                active={Boolean(editor?.isActive({ textAlign: "justify" }))}
                onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
                label="Justify"
              >
                <AlignJustify className="h-4 w-4" />
              </RibbonIcon>
            </RibbonGroup>
            <RibbonGroup label="Editing">
              <RibbonButton label="Find" icon={<Search className="h-4 w-4" />} onClick={onOpenFindReplace} />
              <RibbonButton label="Replace" icon={<Replace className="h-4 w-4" />} onClick={onOpenFindReplace} />
            </RibbonGroup>
          </>
        )}
        {tab === "Insert" && (
          <RibbonGroup label="Insert">
            <RibbonButton
              label="Link"
              icon={<LinkIcon className="h-4 w-4" />}
              onClick={() => {
                const href = window.prompt("Link URL", "https://");
                if (href) editor?.chain().focus().setLink({ href }).run();
              }}
              keepEditorFocus={false}
            />
            <RibbonButton
              label="Horizontal line"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            />
            <RibbonButton
              label="Table"
              icon={<Table2 className="h-4 w-4" />}
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            />
            <RibbonButton label="Add row" onClick={() => editor?.chain().focus().addRowAfter().run()} />
            <RibbonButton label="Add column" onClick={() => editor?.chain().focus().addColumnAfter().run()} />
            <RibbonButton label="Delete table" onClick={() => editor?.chain().focus().deleteTable().run()} />
          </RibbonGroup>
        )}
        {tab === "Layout" && (
          <>
            <RibbonGroup label="Page margins">
              <div className="flex flex-col gap-1">
                <select
                  aria-label="Page margins"
                  className="h-7 min-w-[100px] rounded border border-slate-300 bg-white px-2 text-xs font-semibold"
                  value={pageLayout.marginPreset}
                  onChange={(event) =>
                    onPageLayoutChange({ marginPreset: event.target.value as MarginPreset })
                  }
                >
                  {(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((key) => (
                    <option key={key} value={key}>
                      {MARGIN_PRESETS[key].label}
                    </option>
                  ))}
                </select>
                <p className="max-w-[220px] text-[9px] leading-tight text-slate-500">
                  Top: {margins.top}cm · Left: {margins.left}cm · Bot: {margins.bottom}cm · Right:{" "}
                  {margins.right}cm
                </p>
              </div>
            </RibbonGroup>
            <RibbonGroup label="Orientation">
              <OrientationButton
                label="Portrait"
                active={pageLayout.orientation === "portrait"}
                onClick={() => onPageLayoutChange({ orientation: "portrait" })}
                portrait
              />
              <OrientationButton
                label="Landscape"
                active={pageLayout.orientation === "landscape"}
                onClick={() => onPageLayoutChange({ orientation: "landscape" })}
                portrait={false}
              />
            </RibbonGroup>
            <RibbonGroup label="Page size">
              <select
                aria-label="Page size"
                className="h-7 min-w-[180px] rounded border border-slate-300 bg-white px-2 text-xs"
                value={pageLayout.pageSize}
                onChange={(event) => onPageLayoutChange({ pageSize: event.target.value as PageSizeKey })}
              >
                {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((key) => (
                  <option key={key} value={key}>
                    {PAGE_SIZES[key].label}
                  </option>
                ))}
              </select>
            </RibbonGroup>
            <RibbonGroup label="Columns">
              {([1, 2, 3] as const).map((count) => (
                <ColumnButton
                  key={count}
                  count={count}
                  active={pageLayout.columns === count}
                  onClick={() => onPageLayoutChange({ columns: count })}
                />
              ))}
            </RibbonGroup>
            <RibbonGroup label="Indent">
              <LayoutNumberField
                label="Left"
                unit="cm"
                value={pageLayout.indentLeftCm}
                onChange={(value) => onPageLayoutChange({ indentLeftCm: value })}
              />
              <LayoutNumberField
                label="Right"
                unit="cm"
                value={pageLayout.indentRightCm}
                onChange={(value) => onPageLayoutChange({ indentRightCm: value })}
              />
            </RibbonGroup>
            <RibbonGroup label="Spacing">
              <LayoutNumberField
                label="Before"
                unit="pt"
                value={pageLayout.spacingBeforePt}
                onChange={(value) => onPageLayoutChange({ spacingBeforePt: value })}
              />
              <LayoutNumberField
                label="After"
                unit="pt"
                value={pageLayout.spacingAfterPt}
                onChange={(value) => onPageLayoutChange({ spacingAfterPt: value })}
              />
            </RibbonGroup>
          </>
        )}
        {tab === "References" && (
          <>
            <RibbonGroup label="Contents" dense>
              <RibbonButton
                dense
                label="TOC"
                icon={<BookOpen className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (!editor) return;
                  const result = insertTableOfContents(editor);
                  if (!result.headingCount) onInsertToc();
                }}
              />
              <RibbonButton
                dense
                label="Update"
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => editor && refreshReferenceBlocks(editor)}
              />
              <RibbonButton
                dense
                label="Help"
                icon={<Info className="h-3.5 w-3.5" />}
                onClick={onInsertToc}
                keepEditorFocus={false}
              />
              <RibbonButton
                dense
                label="Export"
                icon={<Info className="h-3.5 w-3.5" />}
                onClick={onReferencesExportNote}
                keepEditorFocus={false}
              />
            </RibbonGroup>
            <RibbonGroup label="Footnotes" dense>
              <RibbonButton dense label="Footnote" onClick={() => editor && insertFootnote(editor, "footnote")} />
              <RibbonButton dense label="Endnote" onClick={() => editor && insertFootnote(editor, "endnote")} />
              <RibbonButton dense label="Next" onClick={() => editor && gotoNextFootnote(editor)} />
            </RibbonGroup>
            <RibbonGroup label="Citations" dense>
              <RibbonButton dense label="Cite" icon={<Quote className="h-3.5 w-3.5" />} onClick={onOpenCite} keepEditorFocus={false} />
              <RibbonButton dense label="Sources" icon={<BookOpen className="h-3.5 w-3.5" />} onClick={onOpenSources} keepEditorFocus={false} />
              <select
                aria-label="Citation style"
                className="h-7 w-[88px] shrink-0 rounded border border-slate-300 bg-white px-1 text-[10px]"
                value={citationStyle}
                onChange={(event) => {
                  if (!editor) return;
                  setCitationStyle(editor, event.target.value as CitationStyle);
                }}
              >
                <option value="apa">APA</option>
                <option value="numeric">Numbered</option>
              </select>
            </RibbonGroup>
            <RibbonGroup label="Captions" dense>
              <RibbonButton
                dense
                label="Caption"
                icon={<Image className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (!editor) return;
                  const table = insertCaptionForTable(editor);
                  if (!table.ok) insertCaptionForSelection(editor);
                }}
              />
              <RibbonButton dense label="Cross-ref" icon={<Link2 className="h-3.5 w-3.5" />} onClick={onOpenCrossRef} keepEditorFocus={false} />
            </RibbonGroup>
            <RibbonGroup label="Index" dense>
              <RibbonButton dense label="Mark" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onOpenIndexMark} keepEditorFocus={false} />
              <RibbonButton dense label="Insert" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => editor && insertIndexBlock(editor)} />
            </RibbonGroup>
            <RibbonGroup label="Bibliography" dense>
              <RibbonButton
                dense
                label="Refs"
                icon={<BookOpen className="h-3.5 w-3.5" />}
                onClick={() => editor && insertGeneratedBibliography(editor)}
              />
              <RibbonButton
                dense
                label="Placeholder"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => editor && insertBibliographyPlaceholder(editor)}
              />
            </RibbonGroup>
          </>
        )}
        {tab === "Review" && (
          <RibbonGroup label="Review">
            <RibbonButton label="Comments" onClick={onComments} keepEditorFocus={false} />
            <RibbonButton
              label={trackChangesEnabled ? "Track: On" : "Track: Off"}
              onClick={onTrackChangesToggle}
              keepEditorFocus={false}
            />
            <RibbonButton label="Changes" onClick={onOpenTrackChanges} keepEditorFocus={false} />
          </RibbonGroup>
        )}
        {tab === "View" && (
          <RibbonGroup label="View">
            <RibbonButton
              label="100% zoom"
              onClick={() => window.dispatchEvent(new Event("tf-editor-reset-zoom"))}
              keepEditorFocus={false}
            />
          </RibbonGroup>
        )}
        {tab === "AI Assistant" && (
          <RibbonGroup label="AI Assistant">
            <RibbonButton label="Open CleonAI" onClick={onAi} keepEditorFocus={false} />
          </RibbonGroup>
        )}
      </div>
    </div>
  );
}

function OrientationButton({
  label,
  active,
  onClick,
  portrait,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  portrait: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tf-ribbon-segment ${active ? "tf-ribbon-segment-active" : "hover:bg-white"}`}
    >
      <span
        className={`rounded-sm border-2 ${
          portrait ? "h-[18px] w-[14px]" : "h-[14px] w-[18px]"
        } ${active ? "border-brand-pink" : "border-slate-400"}`}
        aria-hidden
      />
      {label}
    </button>
  );
}

function ColumnButton({
  count,
  active,
  onClick,
}: {
  count: 1 | 2 | 3;
  active: boolean;
  onClick: () => void;
}) {
  const heights = [18, 14, 10];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tf-ribbon-segment ${active ? "tf-ribbon-segment-active" : "hover:bg-white"}`}
    >
      <span className="tf-ribbon-segment-icon" aria-hidden>
        {Array.from({ length: count }).map((_, index) => (
          <span
            key={index}
            className="tf-ribbon-segment-bar"
            style={{ height: heights[index] || 10 }}
          />
        ))}
      </span>
      {count === 1 ? "One" : count === 2 ? "Two" : "Three"}
    </button>
  );
}

function LayoutNumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] font-medium text-slate-600">
      {label}
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={unit === "pt" ? 1 : 0.1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="h-7 w-14 rounded border border-slate-300 bg-white px-1 text-xs text-slate-800"
        />
        <span className="text-[10px] text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

function RibbonGroup({
  label,
  children,
  dense = false,
}: {
  label: string;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-end border-r border-slate-200 py-1 last:border-r-0 ${
        dense ? "px-1.5" : "px-3"
      }`}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className={`flex flex-nowrap items-end ${dense ? "gap-0.5" : "gap-2"}`}>{children}</div>
        <span
          className={`whitespace-nowrap font-semibold uppercase tracking-wide text-slate-500 ${
            dense ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function RibbonButton({
  label,
  icon,
  onClick,
  keepEditorFocus = true,
  disabled,
  title,
  dense = false,
}: {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  keepEditorFocus?: boolean;
  disabled?: boolean;
  title?: string;
  dense?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title || label}
      onMouseDown={(event) => {
        if (keepEditorFocus && !disabled) event.preventDefault();
      }}
      onClick={() => onClick?.()}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded font-semibold ${
        dense ? "h-7 gap-0.5 px-1.5 text-[10px]" : "h-8 gap-1 px-2 text-[11px]"
      } ${disabled ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-white"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function RibbonIcon({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded ${
        active ? "bg-pink-100 text-brand-pink" : "text-slate-700 hover:bg-white"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
