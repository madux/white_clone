"use client";

import { X } from "lucide-react";

export type EditorCommentItem = {
  id: number;
  author: string;
  body: string;
  selection?: string;
};

export default function EditorCommentsPanel({
  comments,
  comment,
  selectionPreview,
  onCommentChange,
  onClose,
  onSubmit,
}: {
  comments: EditorCommentItem[];
  comment: string;
  selectionPreview: string;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Comments</h2>
        <button type="button" aria-label="Close comments" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {comments.map((item) => (
          <div key={item.id} className="mb-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">{item.author}</p>
            {item.selection ? (
              <p className="mt-1 italic text-slate-400">&ldquo;{item.selection.slice(0, 120)}&rdquo;</p>
            ) : null}
            <p className="mt-1">{item.body}</p>
          </div>
        ))}
        {selectionPreview ? (
          <p className="mb-2 text-[11px] text-slate-400">
            On selection: &ldquo;{selectionPreview.slice(0, 120)}&rdquo;
          </p>
        ) : null}
        <textarea
          className="field min-h-[72px] w-full"
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Add a comment…"
          aria-label="New comment"
        />
        <button type="button" className="mt-2 text-xs font-semibold text-brand-pink" onClick={onSubmit}>
          Add comment
        </button>
      </div>
    </div>
  );
}
