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
  Search,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

const TABS = ["File", "Home", "Insert", "Layout", "Review"] as const;
const FONTS = ["Arial", "Calibri", "Georgia", "Times New Roman", "Courier New"];
const SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "24px", "36px"];

export default function WordRibbon({
  editor,
  tab,
  onTab,
  onComments,
  onAi,
}: {
  editor: Editor | null;
  tab: string;
  onTab: (tab: string) => void;
  onComments: () => void;
  onAi: () => void;
}) {
  function findText() {
    if (!editor) return;
    const query = window.prompt("Find");
    if (!query) return;
    const haystack = editor.state.doc.textContent;
    const index = haystack.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) {
      window.alert("No matches.");
      return;
    }
    let seen = 0;
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const next = seen + node.text.length;
      if (index >= seen && index < next) {
        const from = pos + (index - seen);
        editor.chain().focus().setTextSelection({ from, to: from + query.length }).run();
        return false;
      }
      seen = next;
    });
  }

  return (
    <div className="tf-ribbon shrink-0 border-b border-slate-200 bg-[#f3f3f3] print:hidden">
      <div className="flex items-end gap-1 bg-white px-3 pt-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onTab(name)}
            className={`rounded-t-md px-3 py-1.5 text-xs font-semibold ${
              tab === name ? "bg-[#f3f3f3] text-brand-pink" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-stretch gap-0 px-2 py-2">
        {tab === "File" && (
          <>
            <RibbonGroup label="File">
              <RibbonButton label="Print" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} />
            </RibbonGroup>
          </>
        )}
        {tab === "Home" && (
          <>
            <RibbonGroup label="Undo">
              <RibbonIcon disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} label="Undo">
                <Undo2 className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} label="Redo">
                <Redo2 className="h-4 w-4" />
              </RibbonIcon>
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
              <RibbonIcon active={Boolean(editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()} label="Bold">
                <Bold className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()} label="Italic">
                <Italic className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive("underline"))} onClick={() => editor?.chain().focus().toggleUnderline().run()} label="Underline">
                <Underline className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive("strike"))} onClick={() => editor?.chain().focus().toggleStrike().run()} label="Strikethrough">
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
              <RibbonIcon active={Boolean(editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()} label="Bullets">
                <List className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()} label="Numbering">
                <ListOrdered className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive({ textAlign: "left" }))} onClick={() => editor?.chain().focus().setTextAlign("left").run()} label="Align left">
                <AlignLeft className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive({ textAlign: "center" }))} onClick={() => editor?.chain().focus().setTextAlign("center").run()} label="Align center">
                <AlignCenter className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive({ textAlign: "right" }))} onClick={() => editor?.chain().focus().setTextAlign("right").run()} label="Align right">
                <AlignRight className="h-4 w-4" />
              </RibbonIcon>
              <RibbonIcon active={Boolean(editor?.isActive({ textAlign: "justify" }))} onClick={() => editor?.chain().focus().setTextAlign("justify").run()} label="Justify">
                <AlignJustify className="h-4 w-4" />
              </RibbonIcon>
            </RibbonGroup>
            <RibbonGroup label="Editing">
              <RibbonButton label="Find" icon={<Search className="h-4 w-4" />} onClick={findText} />
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
            />
            <RibbonButton label="Horizontal line" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
          </RibbonGroup>
        )}
        {tab === "Layout" && (
          <RibbonGroup label="Alignment">
            <RibbonButton label="Left" onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
            <RibbonButton label="Center" onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
            <RibbonButton label="Right" onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
            <RibbonButton label="Justify" onClick={() => editor?.chain().focus().setTextAlign("justify").run()} />
          </RibbonGroup>
        )}
        {tab === "Review" && (
          <RibbonGroup label="Review">
            <RibbonButton label="Comments" onClick={onComments} />
            <RibbonButton label="CleonAI" onClick={onAi} />
          </RibbonGroup>
        )}
      </div>
    </div>
  );
}

function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-end gap-1 border-r border-slate-200 px-3 py-1">
      <div className="flex flex-col items-center gap-1">
        <div className="flex flex-wrap items-center gap-1">{children}</div>
        <span className="text-[10px] font-medium text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function RibbonButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded px-2 text-[11px] font-semibold text-slate-700 hover:bg-white"
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
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded ${
        active ? "bg-pink-100 text-brand-pink" : "text-slate-700 hover:bg-white"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
