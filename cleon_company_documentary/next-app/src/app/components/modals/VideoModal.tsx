"use client";

import {
  ChevronDown,
  Download,
  Gauge,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture,
  Play,
  Share2,
  Star,
  Volume2,
  VolumeX,
  Video,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { DocumentaryComment, DocumentaryMedia } from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { formatBytes, formatDuration } from "../documentaryUtils";
import { toSocialComments, type SocialComment } from "@/lib/socialUtils";
import { useDocumentaryComments, useDocumentaryMutations } from "../../../../hooks/useDocumentary";
import { PostDetailLayout } from "../social/PostDetailLayout";
import { PostHeader } from "../social/PostHeader";
import { PostCaption } from "../social/PostCaption";
import { EngagementBar, LikeCount } from "../social/EngagementBar";
import { CommentThread } from "../social/CommentThread";
import { CommentComposer } from "../social/CommentComposer";
import { PostNav } from "../social/PostNav";

function stripHtml(value?: string) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function VideoModal({
  media,
  onClose,
  onShare,
  onError,
  userId,
  isManager,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onMediaChange,
}: {
  media: DocumentaryMedia;
  onClose: () => void;
  onShare?: () => void;
  onError: (message: string) => void;
  userId?: number;
  isManager?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onMediaChange?: (media: DocumentaryMedia) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [quality, setQuality] = useState("original");
  const [speed, setSpeed] = useState("1");
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(media.duration_seconds || 0);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [subtitleUrls, setSubtitleUrls] = useState<Record<number, string>>({});
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<SocialComment | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(media);
  const lastTracked = useRef(0);
  const sessionId = useId();

  const commentsQuery = useDocumentaryComments(currentMedia.id);
  const { postComment, deleteComment, toggleLike } = useDocumentaryMutations();

  const qualityOptions = [
    "original",
    ...Object.keys(media.variants || {}),
  ].filter((value, index, array) => array.indexOf(value) === index);

  useEffect(() => {
    setCurrentMedia(media);
    setReplyTo(null);
    setCommentBody("");
    setShowMore(false);
  }, [media]);

  useEffect(() => {
    let cancelled = false;
    api
      .streamUrl(currentMedia.id, quality === "original" ? undefined : quality)
      .then((result) => {
        if (!cancelled) setStreamUrl(result.url);
      })
      .catch((error) => {
        if (!cancelled)
          onError(error instanceof Error ? error.message : "The video could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentMedia.id, quality, onError]);

  useEffect(() => {
    let cancelled = false;
    if (!currentMedia.subtitles?.length) return () => undefined;
    Promise.all(
      currentMedia.subtitles.map(
        async (subtitle) =>
          [
            subtitle.id,
            await api.assetReadUrl(currentMedia.id, "subtitle", subtitle.id).then((result) => result.url),
          ] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setSubtitleUrls(Object.fromEntries(entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [currentMedia.id, currentMedia.subtitles]);

  useEffect(() => {
    void api.watchProgress({
      media_id: currentMedia.id,
      position_seconds: 0,
      watched_seconds: 0,
      completion_percent: 0,
      session_id: sessionId,
      event_type: "start",
      delta_seconds: 0,
    });
  }, [currentMedia.id, sessionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (event.key === "ArrowRight" && hasNext) onNext?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function updateProgress(video: HTMLVideoElement, force = false) {
    if (!duration) return;
    const delta = Math.max(video.currentTime - lastTracked.current, 0);
    if (!force && delta < 5) return;
    lastTracked.current = video.currentTime;
    void api.watchProgress({
      media_id: currentMedia.id,
      position_seconds: video.currentTime,
      watched_seconds: delta,
      completion_percent: Math.min((video.currentTime / duration) * 100, 100),
      completed: video.ended,
      session_id: sessionId,
      event_type: video.ended ? "complete" : "progress",
      delta_seconds: delta,
    });
  }

  async function submitComment() {
    if (!commentBody.trim()) return;
    try {
      await postComment.mutateAsync({
        media_id: currentMedia.id,
        body: commentBody.trim(),
        parent_id: replyTo?.id,
      });
      setCommentBody("");
      setReplyTo(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "The comment could not be added.");
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const result = await api.downloadUrl(currentMedia.id);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : "The download could not be started.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleLike() {
    try {
      const result = await toggleLike.mutateAsync(currentMedia.id);
      const next = { ...currentMedia, liked_by_me: result.liked, like_count: result.like_count };
      setCurrentMedia(next);
      onMediaChange?.(next);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update like.");
    }
  }

  async function toggleFavorite() {
    try {
      const updated = await api.mediaAction({ id: currentMedia.id, action: "favorite" }) as DocumentaryMedia;
      setCurrentMedia(updated);
      onMediaChange?.(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update favorite.");
    }
  }

  const comments = toSocialComments((commentsQuery.data || []) as DocumentaryComment[]);
  const hasMore = Boolean(currentMedia.transcript || (currentMedia.chapters?.length || 0) > 0);

  return (
    <div className={`modal-backdrop video-backdrop ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="video-modal video-modal-split">
        <div className="video-modal-header">
          <div>
            <div className="eyebrow">{currentMedia.folder_name}</div>
            <h2>{currentMedia.title}</h2>
          </div>
          <div className="video-modal-actions">
            {onShare && (
              <button className="secondary-button dark" onClick={onShare}>
                <Share2 size={16} /> Share
              </button>
            )}
            {currentMedia.download_allowed && (
              <button className="secondary-button dark" onClick={download} disabled={downloading}>
                {downloading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
                Download
              </button>
            )}
            <button
              type="button"
              className="modal-close dark-close"
              onClick={() => setFullscreen((value) => !value)}
              aria-label={fullscreen ? "Exit full screen" : "Maximize full screen"}
            >
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button type="button" className="modal-close dark-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="video-modal-body social-detail-body">
          <PostNav onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
          <PostDetailLayout
            media={(
              <div className="video-stage" ref={stageRef}>
                {loading && (
                  <div className="video-loading">
                    <LoaderCircle className="spin" size={28} />
                    <span>Preparing secure playback…</span>
                  </div>
                )}
                {!loading && streamUrl && (
                  <>
                    <video
                      ref={videoRef}
                      src={streamUrl}
                      autoPlay
                      className="video-player"
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onLoadedMetadata={(event) => {
                        setDuration(event.currentTarget.duration || duration);
                        if (currentMedia.watch_progress?.position_seconds) {
                          event.currentTarget.currentTime = currentMedia.watch_progress.position_seconds;
                          setCurrentTime(currentMedia.watch_progress.position_seconds);
                        }
                      }}
                      onTimeUpdate={(event) => {
                        setCurrentTime(event.currentTarget.currentTime);
                        updateProgress(event.currentTarget);
                      }}
                      onEnded={(event) => updateProgress(event.currentTarget, true)}
                      onError={() => onError("The video stream could not be loaded.")}
                    >
                      {currentMedia.subtitles?.map(
                        (subtitle) =>
                          subtitleUrls[subtitle.id] && (
                            <track
                              key={subtitle.id}
                              kind="subtitles"
                              src={subtitleUrls[subtitle.id]}
                              srcLang={subtitle.language}
                              label={subtitle.name}
                              default={subtitle.is_default}
                              onLoad={() => void api.captionEvent(currentMedia.id)}
                            />
                          ),
                      )}
                    </video>
                    <div className="player-controls">
                      <input
                        className="timeline"
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.1"
                        value={Math.min(currentTime, duration || 0)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (videoRef.current) videoRef.current.currentTime = value;
                          setCurrentTime(value);
                        }}
                        aria-label="Video timeline"
                      />
                      <div className="control-row">
                        <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                          {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                        </button>
                        <button
                          onClick={() => {
                            const next = volume > 0 ? 0 : 1;
                            setVolume(next);
                            if (videoRef.current) videoRef.current.volume = next;
                          }}
                          aria-label="Toggle volume"
                        >
                          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        <span className="timecode">
                          {formatDuration(currentTime)} / {formatDuration(duration)}
                        </span>
                        <span className="control-spacer" />
                        <label className="player-select">
                          <Gauge size={14} />
                          <select
                            value={speed}
                            onChange={(event) => {
                              setSpeed(event.target.value);
                              if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value);
                            }}
                            aria-label="Playback speed"
                          >
                            {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((value) => (
                              <option key={value} value={value}>{value}×</option>
                            ))}
                          </select>
                        </label>
                        <label className="player-select">
                          <span>HD</span>
                          <select value={quality} onChange={(event) => setQuality(event.target.value)} aria-label="Video quality">
                            {qualityOptions.map((value) => (
                              <option key={value} value={value}>{value === "original" ? "Original" : value}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          onClick={() => {
                            const video = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
                            if (video?.requestPictureInPicture) void video.requestPictureInPicture();
                          }}
                          aria-label="Picture in picture"
                        >
                          <PictureInPicture size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (document.fullscreenElement) void document.exitFullscreen();
                            else if (stageRef.current) void stageRef.current.requestFullscreen();
                            setFullscreen((value) => !value);
                          }}
                          aria-label="Fullscreen"
                        >
                          <Maximize2 size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {!loading && !streamUrl && (
                  <div className="video-loading">
                    <Video size={32} />
                    <span>No playable video is available.</span>
                  </div>
                )}
              </div>
            )}
            sidebar={(
              <>
                <PostHeader
                  userName={currentMedia.owner_name || "Team"}
                  subtitle={currentMedia.folder_name}
                  createdAt={currentMedia.created_at}
                />
                <PostCaption title={currentMedia.title} description={stripHtml(currentMedia.description)} />
                <EngagementBar
                  liked={currentMedia.liked_by_me}
                  onLike={handleLike}
                  onComment={() => composerRef.current?.focus()}
                  onShare={onShare}
                  onDownload={currentMedia.download_allowed ? download : undefined}
                  extra={(
                    <button
                      type="button"
                      className={`social-post-icon-btn ${currentMedia.favorite ? "is-liked" : ""}`}
                      onClick={toggleFavorite}
                      aria-label={currentMedia.favorite ? "Remove bookmark" : "Bookmark"}
                    >
                      <Star size={22} fill={currentMedia.favorite ? "currentColor" : "none"} />
                    </button>
                  )}
                />
                <LikeCount count={currentMedia.like_count || 0} />
                {(currentMedia.comment_count || 0) > 0 && (
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
                  onDelete={(commentId) => deleteComment.mutateAsync({ media_id: currentMedia.id, comment_id: commentId }).catch((error) => onError(error instanceof Error ? error.message : "Delete failed"))}
                />
                {currentMedia.comments_enabled && (
                  <CommentComposer
                    value={commentBody}
                    onChange={setCommentBody}
                    onSubmit={submitComment}
                    loading={postComment.isPending}
                    replyTo={replyTo?.user_name}
                    onCancelReply={() => setReplyTo(null)}
                    placeholder="Add a comment… Use @name to mention"
                    inputRef={composerRef}
                  />
                )}
                {hasMore && (
                  <div className="video-more-section">
                    <button type="button" className="video-more-toggle" onClick={() => setShowMore((value) => !value)}>
                      More <ChevronDown size={14} className={showMore ? "is-open" : ""} />
                    </button>
                    {showMore && (
                      <div className="video-more-content">
                        {currentMedia.transcript && (
                          <div className="video-more-block">
                            <strong>Transcript</strong>
                            <p>{currentMedia.transcript}</p>
                          </div>
                        )}
                        {(currentMedia.chapters?.length || 0) > 0 && (
                          <div className="video-more-block">
                            <strong>Chapters</strong>
                            <div className="chapters-panel">
                              {(currentMedia.chapters || []).map((chapter, index) => (
                                <button
                                  key={`${chapter.start_seconds}-${index}`}
                                  className="chapter-row"
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = chapter.start_seconds;
                                      setCurrentTime(chapter.start_seconds);
                                    }
                                  }}
                                >
                                  <span>{formatDuration(chapter.start_seconds)}</span>
                                  <strong>{chapter.title}</strong>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          />
        </div>

        <div className="video-modal-footer">
          <span>{formatBytes(currentMedia.file_size)} · {formatDuration(currentMedia.duration_seconds)}</span>
          <span>{currentMedia.view_count} views · {currentMedia.tags.length ? currentMedia.tags.join(", ") : "Company library"}</span>
        </div>
      </div>
    </div>
  );
}
