"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Crop, Download, Heart, Replace, Trash2, Undo2 } from "lucide-react";
import type { GalleryAlbum, GalleryMedia } from "@/lib/types";
import { api, formatBytes, formatDate } from "@/lib/api";
import { MediaThumb, StatusBadge } from "../shared/MediaThumb";
import { useGalleryMutations } from "@/hooks/useSocialGallery";
import { PostNav } from "../social/PostNav";
import AppSelect from "../shared/AppSelect";
import { ModalShell } from "../shared/ModalShell";
import CropModal from "./CropModal";
import { uploadSocialFile } from "@/lib/uploadSocialFile";

export default function MediaDetailModal({
  media,
  albums,
  userId,
  isManager,
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
  onClose: () => void;
  onRefresh: () => void;
  onError?: (message: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const [assetUrl, setAssetUrl] = useState("");
  const [displayName, setDisplayName] = useState(media.display_name);
  const [description, setDescription] = useState(media.description);
  const [moveAlbumId, setMoveAlbumId] = useState<number | "">(media.album_id || "");
  const [currentMedia, setCurrentMedia] = useState(media);
  const [cropOpen, setCropOpen] = useState(false);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const { updateMedia, mediaAction, toggleLike } = useGalleryMutations();
  const isOwner = userId === currentMedia.uploaded_by;
  const approvedAlbums = albums.filter((a) => a.status === "approved");

  useEffect(() => {
    setCurrentMedia(media);
    setDisplayName(media.display_name);
    setDescription(media.description);
    setMoveAlbumId(media.album_id || "");
  }, [media]);

  useEffect(() => {
    api.assetUrl(currentMedia.id).then((r) => setAssetUrl(r.url)).catch(() => {});
    api.mediaAction({ id: currentMedia.id, action: "view" }).catch(() => {});
  }, [currentMedia.id]);

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
      });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const move = async () => {
    if (!moveAlbumId || !isManager) return;
    try {
      await api.moveMedia({ id: currentMedia.id, album_id: Number(moveAlbumId) });
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

  const deleteMedia = async () => {
    if (!window.confirm("Move this item to the Recycle Bin?")) return;
    try {
      await mediaAction.mutateAsync({ id: currentMedia.id, action: "delete" });
      onClose();
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const withdrawMedia = async () => {
    if (!window.confirm("Withdraw this pending upload?")) return;
    try {
      await mediaAction.mutateAsync({ id: currentMedia.id, action: "withdraw" });
      onClose();
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const duplicateMedia = async () => {
    if (!window.confirm("Create an approved copy of this media in the same album?")) return;
    try {
      const copy = await api.duplicateMedia(currentMedia.id);
      setCurrentMedia(copy);
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  const onReplaceFile = async (file: File) => {
    const sameType = currentMedia.media_type === "video"
      ? file.type.startsWith("video/")
      : file.type.startsWith("image/");
    if (!sameType) {
      handleError(new Error("Replacement file must be the same media type."));
      return;
    }
    setReplaceBusy(true);
    try {
      const updated = await uploadSocialFile({
        file,
        displayName: currentMedia.display_name,
        description: currentMedia.description,
        albumId: currentMedia.album_id || undefined,
        replaceMediaId: currentMedia.id,
      });
      setCurrentMedia(updated);
      onRefresh();
    } catch (err) {
      handleError(err);
    } finally {
      setReplaceBusy(false);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const requestReReview = async () => {
    try {
      await updateMedia.mutateAsync({
        id: currentMedia.id,
        trigger_re_review: true,
      });
      onRefresh();
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <ModalShell
      title={currentMedia.display_name}
      eyebrow="Media Detail"
      onClose={onClose}
      wide
      className="media-detail"
    >
      <div className="modal-body social-detail-body">
        <PostNav onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
        <div className="media-detail-layout">
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
          <div className="media-detail-sidebar modal-form">
            <p className="meta-muted">
              {currentMedia.uploaded_by_name} · {currentMedia.album_name || "No album selected"}
            </p>
            <div className="media-detail-status-row">
              <StatusBadge status={currentMedia.approval_status} />
            </div>
            {currentMedia.legal_hold && (
              <p className="media-detail-callout media-detail-callout--warn">Legal hold — deletion and disposal blocked</p>
            )}
            {currentMedia.disposition_state === "due" && (
              <p className="media-detail-callout media-detail-callout--warn">Disposition review required before purge</p>
            )}
            {currentMedia.storage_tier === "cold" && (
              <p className="meta-muted">Storage tier: cold</p>
            )}
            {currentMedia.is_unassigned && (
              <p className="media-detail-callout media-detail-callout--warn">No album selected — reviewer must assign before approval.</p>
            )}
            <p className="meta-muted">{formatBytes(currentMedia.file_size)} · {formatDate(currentMedia.create_date)}</p>

            <div className="media-detail-actions">
              <button type="button" className="secondary-button small" onClick={toggleLikeAction}>
                <Heart size={16} fill={currentMedia.liked_by_me ? "currentColor" : "none"} />
                {currentMedia.like_count}
              </button>
              <button type="button" className="secondary-button small" onClick={download}>
                <Download size={16} />
                Download
              </button>
              {isManager && (
                <button type="button" className="secondary-button small" onClick={duplicateMedia}>
                  <Copy size={16} />
                  Duplicate
                </button>
              )}
              {currentMedia.can_edit && currentMedia.media_type === "image" && assetUrl && (
                <button type="button" className="secondary-button small" onClick={() => setCropOpen(true)}>
                  <Crop size={16} />
                  Crop
                </button>
              )}
              {currentMedia.can_edit && (
                <>
                  <button
                    type="button"
                    className="secondary-button small"
                    disabled={replaceBusy}
                    onClick={() => replaceInputRef.current?.click()}
                  >
                    <Replace size={16} />
                    {replaceBusy ? "Replacing…" : "Replace"}
                  </button>
                  <input
                    ref={replaceInputRef}
                    type="file"
                    hidden
                    accept={currentMedia.media_type === "video" ? "video/*" : "image/*"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onReplaceFile(file);
                    }}
                  />
                </>
              )}
              {currentMedia.can_delete && (
                <button type="button" className="danger-button small" onClick={deleteMedia}>
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
              {currentMedia.can_withdraw && (
                <button type="button" className="secondary-button small" onClick={withdrawMedia}>
                  <Undo2 size={16} />
                  Withdraw
                </button>
              )}
            </div>

            {(currentMedia.can_edit || isOwner) && (
              <>
                <label>
                  Display name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!currentMedia.can_edit}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!currentMedia.can_edit}
                  />
                </label>
                {currentMedia.can_edit && (
                  <button type="button" className="primary-button small" onClick={save}>Save</button>
                )}
                {isOwner && currentMedia.approval_status === "approved" && !isManager && (
                  <button type="button" className="secondary-button small" onClick={requestReReview}>
                    Mark for re-review after edits
                  </button>
                )}
              </>
            )}

            {isManager && (
              <label>
                Move to album
                <div className="contributor-row">
                  <AppSelect
                    value={moveAlbumId === "" ? "" : String(moveAlbumId)}
                    placeholder="Select album"
                    options={[
                      { value: "", label: "Select album" },
                      ...approvedAlbums.map((a) => ({ value: String(a.id), label: a.name })),
                    ]}
                    onChange={(value) => setMoveAlbumId(value ? Number(value) : "")}
                    ariaLabel="Move media to album"
                  />
                  <button type="button" className="secondary-button small" onClick={move}>Move</button>
                </div>
              </label>
            )}

            {currentMedia.approver_comment && (
              <p className="meta-muted"><strong>Review note:</strong> {currentMedia.approver_comment}</p>
            )}
          </div>
        </div>
      </div>
      {cropOpen && assetUrl && (
        <CropModal
          media={currentMedia}
          assetUrl={assetUrl}
          onClose={() => setCropOpen(false)}
          onComplete={() => {
            onRefresh();
            api.assetUrl(currentMedia.id).then((r) => setAssetUrl(r.url)).catch(() => {});
          }}
          onError={handleError}
        />
      )}
    </ModalShell>
  );
}
