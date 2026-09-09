"use client";

import { formatRelativeTime, initials, type SocialComment } from "@/lib/socialUtils";

export function CommentItem({
  comment,
  canDelete,
  onReply,
  onDelete,
  nested = false,
}: {
  comment: SocialComment;
  canDelete?: boolean;
  onReply?: () => void;
  onDelete?: (commentId: number) => void;
  nested?: boolean;
}) {
  return (
    <div className={`social-comment-item ${nested ? "is-reply" : ""}`}>
      <div className="social-comment-avatar">{initials(comment.user_name)}</div>
      <div className="social-comment-body">
        <p>
          <strong>{comment.user_name}</strong>
          <span>{comment.body}</span>
        </p>
        <div className="social-comment-meta">
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {onReply && (
            <button type="button" className="social-comment-action" onClick={onReply}>
              Reply
            </button>
          )}
          {canDelete && onDelete && (
            <button type="button" className="social-comment-action danger" onClick={() => onDelete(comment.id)}>
              Delete
            </button>
          )}
        </div>
        {(comment.replies || []).map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            nested
            canDelete={canDelete}
            onReply={onReply}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
