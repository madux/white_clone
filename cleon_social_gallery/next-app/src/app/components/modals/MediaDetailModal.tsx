"use client";

import { useEffect, useRef, useState } from "react";
import { History, Images, Trash2 } from "lucide-react";
import type { GalleryAlbum, GalleryComment, GalleryMedia, GalleryTag } from "@/lib/types";
import { api, formatBytes, formatDate } from "@/lib/api";
import { toSocialComments, type SocialComment } from "@/lib/socialUtils";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useGalleryComments, useGalleryMutations, useGalleryTags } from "@/hooks/useSocialGallery";
import { PostDetailLayout } from "../social/PostDetailLayout";
import { PostHeader } from "../social/PostHeader";
import { PostCaption } from "../social/PostCaption";
import { EngagementBar, LikeCount } from "../social/EngagementBar";
import { CommentThread } from "../social/CommentThread";
import { CommentComposer } from "../social/CommentComposer";
import { PostNav } from "../social/PostNav";
import ShareModal from "./ShareModal";
import { ModalShell } from "../shared/ModalShell";
import { EmptyState } from "../shared/EmptyState";

export default function MediaDetailModal({
  media,
  albums,
  userId,
  isManager,
  allowExternalShare,
  onClose,
  onRefresh,
  onError,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  media: GalleryMedia;
  albums: GalleryAlbum[];
  userId?: number;
  isManager?: boolean;
  allowExternalShare?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onError?: (message: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const [assetUrl, setAssetUrl] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [displayName, setDisplayName] = useState(media.display_name);
  const [description, setDescription] = useState(media.description);
  const [accessibleDescription, setAccessibleDescription] = useState(media.accessible_description);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<SocialComment | null>(null);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [confirmReport, setConfirmReport] = useState(false);
  const [versions, setVersions] = useState<GalleryMedia[]>([]);
  const [similar, setSimilar] = useState<GalleryMedia[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">(media.album_id || "");
  const [currentMedia, setCurrentMedia] = useState(media);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(media.tag_ids || []);
  const [newTagName, setNewTagName] = useState("");
  const [manageTab, setManageTab] = useState<"details" | "versions" | "similar">("details");
  const composerRef = useRef<HTMLInputElement>(null);

  const commentsQuery = useGalleryComments(currentMedia.id);
  const tagsQuery = useGalleryTags();
  const { updateMedia, mediaAction, toggleLike, postComment, deleteComment, createTag } = useGalleryMutations();

  useEffect(() => {
    setCurrentMedia(media);
    setDisplayName(media.display_name);
    setDescription(media.description);
    setAccessibleDescription(media.accessible_description);
    setMoveAlbumId(media.album_id || "");
    setSelectedTagIds(media.tag_ids || []);
    setShowManage(false);
    setReplyTo(null);
    setCommentBody("");
  }, [media]);

  useEffect(() => {
    api.assetUrl(currentMedia.id).then((r) => setAssetUrl(r.url)).catch(() => {});
    api.mediaAction({ id: currentMedia.id, action: "view" }).catch(() => {});
  }, [currentMedia.id]);

  useEffect(() => {
    if (!showManage) return;
    if (manageTab === "versions") api.mediaVersions(currentMedia.id).then(setVersions).catch(() => {});
    if (manageTab === "similar") api.similarMedia(currentMedia.id).then(setSimilar).catch(() => {});
  }, [showManage, manageTab, currentMedia.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (event.key === "ArrowRight" && hasNext) onNext?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext]);

  const handleError = (err: unknown) => onError?.(err instanceof Error ? err.message : "Action failed");

  const save = async () => {
    try {
      await updateMedia.mutateAsync({
        id: currentMedia.id,
        display_name: displayName,
        description,
        accessible_description: accessibleDescription,
        tag_ids: selectedTagIds,
      });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const move = async () => {
    if (!moveAlbumId) return;
    try {
      await api.moveMedia({ id: currentMedia.id, album_id: Number(moveAlbumId) });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const report = async () => {
    if (!confirmReport) {
      setConfirmReport(true);
      return;
    }
    try {
      await api.reportMedia({ id: currentMedia.id, reason: reportReason });
      setConfirmReport(false);
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const download = async () => {
    try {
      const { url } = await api.assetUrl(currentMedia.id, true);
      window.open(url, "_blank");
    } catch (err) {
      handleError(err);
    }
  };

  const toggleLikeAction = async () => {
    try {
      const result = await toggleLike.mutateAsync(currentMedia.id);
      setCurrentMedia((prev) => ({
        ...prev,
        liked_by_me: result.liked,
        like_count: result.like_count,
      }));
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const submitComment = async () => {
    if (!commentBody.trim()) return;
    try {
      await postComment.mutateAsync({
        media_id: currentMedia.id,
        body: commentBody.trim(),
        parent_id: replyTo?.id,
      });
      setCommentBody("");
      setReplyTo(null);
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await createTag.mutateAsync(name) as GalleryTag;
      setSelectedTagIds((prev) => [...new Set([...prev, tag.id])]);
      setNewTagName("");
    } catch (err) {
      handleError(err);
    }
  };

  const comments = toSocialComments((commentsQuery.data || []) as GalleryComment[]);
  const allTags = (tagsQuery.data || []) as GalleryTag[];

  return (
    <>
      <ModalShell
        title={currentMedia.display_name}
        eyebrow="Media Detail"
        onClose={onClose}
        wide
        className="media-detail"
      >
        <div className="modal-body social-detail-body">
          <PostNav onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
          <PostDetailLayout
            media={(
              <div className="media-detail-asset-frame">
                {assetUrl ? (
                  currentMedia.media_type === "video" ? (
                    <video src={assetUrl} controls className="media-detail-asset" />
                  ) : (
                    <img src={assetUrl} alt={currentMedia.display_name} className="media-detail-asset" />
                  )
                ) : (
                  <MediaThumb media={currentMedia} />
                )}
              </div>
            )}
            sidebar={(
              <>
                <PostHeader
                  userName={currentMedia.uploaded_by_name}
                  subtitle={currentMedia.album_name}
                  createdAt={currentMedia.create_date}
                  onMenu={() => setShowManage((value) => !value)}
                />
                <PostCaption title={currentMedia.display_name} description={currentMedia.description} />
                <EngagementBar
                  liked={currentMedia.liked_by_me}
                  onLike={toggleLikeAction}
                  onComment={() => composerRef.current?.focus()}
                  onShare={() => setShowShare(true)}
                  onDownload={download}
                  extra={currentMedia.can_edit ? (
                    <button
                      type="button"
                      className="social-post-icon-btn danger"
                      onClick={() => mediaAction.mutateAsync({ id: currentMedia.id, action: "delete" }).then(onClose).catch(handleError)}
                      aria-label="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  ) : undefined}
                />
                <LikeCount count={currentMedia.like_count} />
                {currentMedia.comment_count > 0 && (
                  <p className="social-post-like-count">
                    <strong>{currentMedia.comment_count}</strong> {currentMedia.comment_count === 1 ? "comment" : "comments"}
                  </p>
                )}
                <CommentThread
                  comments={comments}
                  loading={commentsQuery.isLoading}
                  currentUserId={userId}
                  isManager={isManager}
                  onReply={(comment) => setReplyTo(comment)}
                  onDelete={(commentId) => deleteComment.mutateAsync({ media_id: currentMedia.id, comment_id: commentId }).catch(handleError)}
                />
                {currentMedia.comments_enabled && (
                  <CommentComposer
                    value={commentBody}
                    onChange={setCommentBody}
                    onSubmit={submitComment}
                    loading={postComment.isPending}
                    replyTo={replyTo?.user_name}
                    onCancelReply={() => setReplyTo(null)}
                    placeholder={replyTo ? `Reply to ${replyTo.user_name}…` : "Add a comment…"}
                    inputRef={composerRef}
                  />
                )}
                {showManage && (
                  <div className="social-manage-drawer">
                    <div className="panel-tabs">
                      {(["details", "versions", "similar"] as const).map((tab) => (
                        <button key={tab} type="button" className={manageTab === tab ? "active" : ""} onClick={() => setManageTab(tab)}>
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                    {manageTab === "details" && (
                      <div className="modal-form">
                        <label>
                          Display Name
                          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!currentMedia.can_edit} />
                        </label>
                        <label>
                          Description
                          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!currentMedia.can_edit} />
                        </label>
                        <label>
                          Accessible Description
                          <textarea value={accessibleDescription} onChange={(e) => setAccessibleDescription(e.target.value)} disabled={!currentMedia.can_edit} />
                        </label>
                        <StatusBadge status={currentMedia.approval_status} />
                        <p className="meta-muted">Size: {formatBytes(currentMedia.file_size)} · {formatDate(currentMedia.create_date)}</p>
                        {currentMedia.can_edit && (
                          <>
                            <label>
                              Tags
                              <div className="tag-picker">
                                {allTags.map((tag) => (
                                  <label key={tag.id} className="tag-chip">
                                    <input
                                      type="checkbox"
                                      checked={selectedTagIds.includes(tag.id)}
                                      onChange={(e) => setSelectedTagIds((prev) => e.target.checked ? [...prev, tag.id] : prev.filter((id) => id !== tag.id))}
                                    />
                                    {tag.name}
                                  </label>
                                ))}
                              </div>
                              <div className="contributor-row">
                                <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="New tag name" />
                                <button type="button" className="secondary-button small" onClick={addTag}>Add</button>
                              </div>
                            </label>
                            <label>
                              Move to album
                              <div className="contributor-row">
                                <select value={moveAlbumId} onChange={(e) => setMoveAlbumId(e.target.value ? Number(e.target.value) : "")}>
                                  <option value="">Select album</option>
                                  {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <button type="button" className="secondary-button small" onClick={move}>Move</button>
                              </div>
                            </label>
                            <button type="button" className="primary-button small" onClick={save}>Save changes</button>
                          </>
                        )}
                        <label>
                          Report content
                          <div className="contributor-row">
                            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                              <option value="inappropriate">Inappropriate Content</option>
                              <option value="harassment">Harassment</option>
                              <option value="privacy">Privacy Violation</option>
                              <option value="copyright">Copyright Issue</option>
                              <option value="other">Other</option>
                            </select>
                            <button type="button" className="danger-button small" onClick={report}>
                              {confirmReport ? "Confirm Report" : "Report"}
                            </button>
                          </div>
                        </label>
                      </div>
                    )}
                    {manageTab === "versions" && (
                      versions.length === 0 ? (
                        <EmptyState icon={History} title="No previous versions" description="Edits and replacements will appear here." />
                      ) : (
                        <div className="stack-list">
                          {versions.map((version) => (
                            <div key={version.id} className="activity-row">
                              <span className="status-badge pending">v{version.version}</span>
                              <div className="profile-copy">
                                <strong>{version.display_name}</strong>
                                <span>{formatDate(version.create_date)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                    {manageTab === "similar" && (
                      similar.length === 0 ? (
                        <EmptyState icon={Images} title="No similar content" description="Related media will be suggested here." />
                      ) : (
                        <div className="similar-grid">
                          {similar.map((item) => (
                            <article key={item.id} className="media-card" onClick={() => setCurrentMedia(item)} role="button" tabIndex={0}>
                              <MediaThumb media={item} />
                              <div className="media-copy"><span className="media-title">{item.display_name}</span></div>
                            </article>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          />
        </div>
      </ModalShell>
      {showShare && (
        <ShareModal
          mediaId={currentMedia.id}
          allowExternalShare={allowExternalShare}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
