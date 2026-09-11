export function formatRelativeTime(value?: string | false): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export interface SocialComment {
  id: number;
  user_id: number;
  user_name: string;
  body: string;
  createdAt: string;
  parent_id?: number | false;
  replies?: SocialComment[];
  mentioned_names?: string[];
}

type RawComment = {
  id: number;
  user_id: number;
  user_name: string;
  body: string;
  create_date?: string;
  created_at?: string;
  parent_id?: number | false;
  replies?: RawComment[];
  mentioned_names?: string[];
};

export function toSocialComments(comments: RawComment[]): SocialComment[] {
  return comments.map((comment) => ({
    id: comment.id,
    user_id: comment.user_id,
    user_name: comment.user_name,
    body: comment.body,
    createdAt: comment.create_date || comment.created_at || "",
    parent_id: comment.parent_id,
    mentioned_names: comment.mentioned_names,
    replies: comment.replies ? toSocialComments(comment.replies) : [],
  }));
}
