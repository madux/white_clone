"use client";

import { useEffect, useState } from "react";
import {
  Download, Heart, History, Images, LoaderCircle, MessageCircle, Share2, Trash2,
} from "lucide-react";
import type { GalleryAlbum, GalleryComment, GalleryMedia, GalleryTag } from "@/lib/types";
import { api, formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useGalleryComments, useGalleryMutations, useGalleryTags } from "@/hooks/useSocialGallery";
import ShareModal from "./ShareModal";
import { ModalShell } from "../shared/ModalShell";
import { EmptyState } from "../shared/EmptyState";
import { LoadingState } from "../shared/LoadingState";

export default function MediaDetailModal({
  media, albums, userId, isManager, allowExternalShare, onClose, onRefresh, onError,
}: {
  media: GalleryMedia;
  albums: GalleryAlbum[];
  userId?: number;
  isManager?: boolean;
  allowExternalShare?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onError?: (message: string) => void;
}) {
  const [assetUrl, setAssetUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "comments" | "versions" | "similar">("details");
  const [displayName, setDisplayName] = useState(media.display_name);
  const [description, setDescription] = useState(media.description);
  const [accessibleDescription, setAccessibleDescription] = useState(media.accessible_description);
  const [commentBody, setCommentBody] = useState("");
  const [reportReason, setReportReason] = useState("inappropriate");
  const [confirmReport, setConfirmReport] = useState(false);
  const [versions, setVersions] = useState<GalleryMedia[]>([]);
  const [similar, setSimilar] = useState<GalleryMedia[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">(media.album_id || "");
  const [currentMedia, setCurrentMedia] = useState(media);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(media.tag_ids || []);
  const [newTagName, setNewTagName] = useState("");

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
    setActiveTab("details");
  }, [media]);

  useEffect(() => {
    api.assetUrl(currentMedia.id).then((r) => setAssetUrl(r.url)).catch(() => {});
    api.mediaAction({ id: currentMedia.id, action: "view" }).catch(() => {});
  }, [currentMedia.id]);

  useEffect(() => {
    if (activeTab === "versions") api.mediaVersions(currentMedia.id).then(setVersions).catch(() => {});
    if (activeTab === "similar") api.similarMedia(currentMedia.id).then(setSimilar).catch(() => {});
  }, [activeTab, currentMedia.id]);

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

  const comments = (commentsQuery.data || []) as GalleryComment[];
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
        <div className="analytics-two-column">
          <div>
            {assetUrl ? (
              currentMedia.media_type === "video" ? (
                <video src={assetUrl} controls className="media-detail-asset" />
              ) : (
                <img src={assetUrl} alt={currentMedia.display_name} className="media-detail-asset" />
              )
            ) : (
              <MediaThumb media={currentMedia} />
            )}
            <div className="primary-actions">
              <button type="button" className="secondary-button small" onClick={toggleLikeAction}>
                <Heart size={14} />
                {currentMedia.liked_by_me ? "Unlike" : "Like"} ({currentMedia.like_count})
              </button>
              <button type="button" className="secondary-button small" onClick={() => setShowShare(true)}>
                <Share2 size={14} />
                Share
              </button>
              <button type="button" className="secondary-button small" onClick={download}>
                <Download size={14} />
                Download
              </button>
              {currentMedia.can_edit && (
                <>
                  <button type="button" className="primary-button small" onClick={save}>Save</button>
                  <button type="button" className="text-button danger" onClick={() => mediaAction.mutateAsync({ id: currentMedia.id, action: "delete" }).then(onClose).catch(handleError)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="panel-tabs">
              {(["details", "comments", "versions", "similar"] as const).map((tab) => (
                <button key={tab} type="button" className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "details" && (
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
                {currentMedia.approver_comment && (
                  <p className="meta-muted">Reviewer note: {currentMedia.approver_comment}</p>
                )}
                {currentMedia.ai_review_status === "flagged" && (
                  <div className="review-flags">
                    <span className="status-badge flagged">AI flagged</span>
                    {currentMedia.ai_moderation_note && <span className="meta-muted">{currentMedia.ai_moderation_note}</span>}
                  </div>
                )}
                <p className="meta-muted">Uploader: {currentMedia.uploaded_by_name}</p>
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
                    <button type="button" className="danger-button" onClick={report}>
                      {confirmReport ? "Confirm Report" : "Report"}
                    </button>
                  </div>
                </label>
              </div>
            )}

            {activeTab === "comments" && (
              <div className="modal-form">
                {commentsQuery.isLoading ? (
                  <LoadingState message="Loading comments…" compact />
                ) : comments.length === 0 ? (
                  <EmptyState icon={MessageCircle} title="No comments yet" description="Be the first to leave a comment." />
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`activity-row ${comment.parent_id ? "comment-reply" : ""}`}>
                      <div className="profile-copy">
                        <strong>{comment.user_name}</strong>
                        <span>{formatDate(comment.create_date)}</span>
                      </div>
                      <p>{comment.body}</p>
                      {(comment.user_id === userId || isManager) && (
                        <button
                          type="button"
                          className="text-button danger"
                          onClick={() => deleteComment.mutateAsync({ media_id: currentMedia.id, comment_id: comment.id }).catch(handleError)}
                        >
                          Delete
                        </button>
                      )}
                      {(comment.replies || []).map((reply) => (
                        <div key={reply.id} className="activity-row comment-reply">
                          <div className="profile-copy">
                            <strong>{reply.user_name}</strong>
                            <span>{formatDate(reply.create_date)}</span>
                          </div>
                          <p>{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                {currentMedia.comments_enabled && (
                  <>
                    <label>
                      Add Comment
                      <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3} />
                    </label>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="primary-button small"
                        disabled={!commentBody.trim() || postComment.isPending}
                        onClick={() => postComment.mutateAsync({ media_id: currentMedia.id, body: commentBody }).then(() => setCommentBody("")).catch(handleError)}
                      >
                        {postComment.isPending ? <LoaderCircle size={16} className="spin" /> : null}
                        Post
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "versions" && (
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

            {activeTab === "similar" && (
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
