"use client";

import {
  Download,
  Gauge,
  LoaderCircle,
  Maximize2,
  MessageCircle,
  Pause,
  PictureInPicture,
  Play,
  Plus,
  Volume2,
  VolumeX,
  Video,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type {
  DocumentaryComment,
  DocumentaryMedia,
} from "../../../../lib/types";
import { api } from "../../../../lib/api";
import { formatBytes, formatDuration, initials } from "../documentaryUtils";

export function VideoModal({
  media,
  onClose,
  onError,
}: {
  media: DocumentaryMedia;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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
  const [comments, setComments] = useState<DocumentaryComment[]>([]);
  const [comment, setComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const lastTracked = useRef(0);
  const sessionId = useId();
  const qualityOptions = [
    "original",
    ...Object.keys(media.variants || {}),
  ].filter((value, index, array) => array.indexOf(value) === index);

  useEffect(() => {
    let cancelled = false;
    api
      .streamUrl(media.id, quality === "original" ? undefined : quality)
      .then((result) => {
        if (!cancelled) setStreamUrl(result.url);
      })
      .catch((error) => {
        if (!cancelled)
          onError(
            error instanceof Error
              ? error.message
              : "The video could not be opened.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [media.id, quality, onError]);

  useEffect(() => {
    let cancelled = false;
    if (!media.subtitles?.length) return () => undefined;
    Promise.all(
      media.subtitles.map(
        async (subtitle) =>
          [
            subtitle.id,
            await api
              .assetReadUrl(media.id, "subtitle", subtitle.id)
              .then((result) => result.url),
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
  }, [media.id, media.subtitles]);

  useEffect(() => {
    if (!media.comments_enabled) return () => undefined;
    api
      .comments(media.id)
      .then(setComments)
      .catch(() => undefined);
    return () => undefined;
  }, [media.id, media.comments_enabled]);

  useEffect(() => {
    void api.watchProgress({
      media_id: media.id,
      position_seconds: 0,
      watched_seconds: 0,
      completion_percent: 0,
      session_id: sessionId,
      event_type: "start",
      delta_seconds: 0,
    });
  }, [media.id, sessionId]);

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
      media_id: media.id,
      position_seconds: video.currentTime,
      watched_seconds: delta,
      completion_percent: Math.min((video.currentTime / duration) * 100, 100),
      completed: video.ended,
      session_id: sessionId,
      event_type: video.ended ? "complete" : "progress",
      delta_seconds: delta,
    });
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setCommentsLoading(true);
    try {
      setComments(await api.comments(media.id, "create", comment.trim()));
      setComment("");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "The comment could not be added.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const result = await api.downloadUrl(media.id);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "The download could not be started.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className={`modal-backdrop video-backdrop ${fullscreen ? "is-fullscreen" : ""}`}
    >
      <div className="video-modal">
        <div className="video-modal-header">
          <div>
            <div className="eyebrow">{media.folder_name}</div>
            <h2>{media.title}</h2>
          </div>
          <div className="video-modal-actions">
            {media.download_allowed && (
              <button
                className="secondary-button dark"
                onClick={download}
                disabled={downloading}
              >
                {downloading ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Download size={16} />
                )}{" "}
                Download
              </button>
            )}
            <button
              className="modal-close dark-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
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
                onLoadedMetadata={(event) =>
                  setDuration(event.currentTarget.duration || duration)
                }
                onTimeUpdate={(event) => {
                  setCurrentTime(event.currentTarget.currentTime);
                  updateProgress(event.currentTarget);
                }}
                onEnded={(event) => updateProgress(event.currentTarget, true)}
                onError={() => onError("The video stream could not be loaded.")}
              >
                {media.subtitles?.map(
                  (subtitle) =>
                    subtitleUrls[subtitle.id] && (
                      <track
                        key={subtitle.id}
                        kind="subtitles"
                        src={subtitleUrls[subtitle.id]}
                        srcLang={subtitle.language}
                        label={subtitle.name}
                        default={subtitle.is_default}
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
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
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
                        if (videoRef.current)
                          videoRef.current.playbackRate = Number(
                            event.target.value,
                          );
                      }}
                      aria-label="Playback speed"
                    >
                      {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((value) => (
                        <option key={value} value={value}>
                          {value}×
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="player-select">
                    <span>HD</span>
                    <select
                      value={quality}
                      onChange={(event) => setQuality(event.target.value)}
                      aria-label="Video quality"
                    >
                      {qualityOptions.map((value) => (
                        <option key={value} value={value}>
                          {value === "original" ? "Original" : value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      const video = videoRef.current as
                        | (HTMLVideoElement & {
                            requestPictureInPicture?: () => Promise<unknown>;
                          })
                        | null;
                      if (video?.requestPictureInPicture)
                        void video.requestPictureInPicture();
                    }}
                    aria-label="Picture in picture"
                  >
                    <PictureInPicture size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (document.fullscreenElement)
                        void document.exitFullscreen();
                      else if (stageRef.current)
                        void stageRef.current.requestFullscreen();
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
        {media.comments_enabled && (
          <section className="comments-panel">
            <div className="comments-heading">
              <span>
                <MessageCircle size={15} /> Discussion
              </span>
              <small>
                {comments.length} comment{comments.length === 1 ? "" : "s"}
              </small>
            </div>
            <div className="comments-list">
              {comments.map((item) => (
                <div className="comment-item" key={item.id}>
                  <div className="comment-avatar">
                    {initials(item.user_name)}
                  </div>
                  <div>
                    <strong>{item.user_name}</strong>
                    <p>{item.body}</p>
                  </div>
                </div>
              ))}
              {!comments.length && (
                <span className="comments-empty">
                  Be the first to add context.
                </span>
              )}
            </div>
            <form className="comment-form" onSubmit={submitComment}>
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a thoughtful note"
              />
              <button
                className="primary-button"
                disabled={commentsLoading || !comment.trim()}
              >
                {commentsLoading ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Plus size={15} />
                )}
              </button>
            </form>
          </section>
        )}
        <div className="video-modal-footer">
          <span>
            {formatBytes(media.file_size)} ·{" "}
            {formatDuration(media.duration_seconds)}
          </span>
          <span>
            {media.view_count} views ·{" "}
            {media.tags.length ? media.tags.join(", ") : "Company library"}
          </span>
        </div>
      </div>
    </div>
  );
}
