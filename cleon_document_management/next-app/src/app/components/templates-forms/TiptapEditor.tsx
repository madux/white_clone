"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect, useState } from "react";
import WordRibbon from "./WordRibbon";

export default function TiptapEditor({
  json,
  text,
  onChange,
  onReady,
  onComments,
  onAi,
}: {
  json: string;
  text: string;
  onChange: (json: string, text: string) => void;
  onReady?: (editor: any) => void;
  onComments: () => void;
  onAi: () => void;
}) {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState("Home");
  const editor = useEditor({
    extensions: [
      StarterKit,
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
    ],
    content: parseContent(json, text),
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      onChange(JSON.stringify(current.getJSON()), current.getText());
    },
    onSelectionUpdate: () => setTick((value) => value + 1),
    onTransaction: () => setTick((value) => value + 1),
  });

  useEffect(() => {
    (window as any).__tfEditor = editor;
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  if (!editor) return <p className="p-6 text-sm text-slate-400">Loading editor…</p>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WordRibbon editor={editor} tab={tab} onTab={setTab} onComments={onComments} onAi={onAi} />
      <div className="min-h-0 flex-1 overflow-auto bg-[#e8e8e8] p-6">
        <div className="tf-page mx-auto bg-white shadow-md">
          <EditorContent editor={editor} className="tf-editor" />
        </div>
      </div>
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
