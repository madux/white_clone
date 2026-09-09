"use client";

import { LoaderCircle, MessageCircle } from "lucide-react";
import type { SocialComment } from "@/lib/socialUtils";
import { CommentItem } from "./CommentItem";

export function CommentThread({
  comments,
  loading,
  currentUserId,
  isManager,
  onReply,
  onDelete,
}: {
  comments: SocialComment[];
  loading?: boolean;
  currentUserId?: number;
  isManager?: boolean;
  onReply: (comment: SocialComment) => void;
  onDelete: (commentId: number) => void;
}) {
  if (loading) {
    return (
      <div className="social-comment-thread loading">
        <LoaderCircle className="spin" size={20} />
        <span>Loading comments…</span>
      </div>
    );
  }

  if (!comments.length) {
    return (
      <div className="social-comment-thread empty">
        <MessageCircle size={22} />
        <p>No comments yet — start the conversation.</p>
      </div>
    );
  }

  return (
    <div className="social-comment-thread" role="log" aria-label="Comments">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          canDelete={comment.user_id === currentUserId || isManager}
          onReply={() => onReply(comment)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
