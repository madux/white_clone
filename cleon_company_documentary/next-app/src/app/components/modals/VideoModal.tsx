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
import { PostNav } from "../social/PostNav";
import { MediaLifecyclePanel } from "../media/MediaLifecyclePanel";
import { VersionHistoryPanel } from "../media/VersionHistoryPanel";
import { ReviewHistoryPanel } from "../media/ReviewHistoryPanel";

type ManagerPanel = "workflow" | "versions" | "review";

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
  isAdministrator,
  isSupervisor,
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
  isAdministrator?: boolean;
  isSupervisor?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onMediaChange?: (media: DocumentaryMedia) => void;
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
  const [showMore, setShowMore] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(media);
  const [managerPanel, setManagerPanel] = useState<ManagerPanel>("workflow");
  const showManagerPanels = Boolean(
    isAdministrator || isSupervisor || currentMedia.can_edit,
  );
  const lastTracked = useRef(0);
  const sessionId = useId();

  const qualityOptions = [
    "original",
    ...Object.keys(media.variants || {}),
  ].filter((value, index, array) => array.indexOf(value) === index);

  useEffect(() => {
    setCurrentMedia(media);
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

  const download = async () => {
    setDownloading(true);
    try {
      const result = await api.downloadUrl(currentMedia.id);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  async function toggleFavorite() {
    try {
      const updated = await api.mediaAction({ id: currentMedia.id, action: "favorite" }) as DocumentaryMedia;
      setCurrentMedia(updated);
      onMediaChange?.(updated);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update favorite.");
    }
  }

  const hasMore = Boolean(currentMedia.transcript || (currentMedia.chapters?.length || 0) > 0);
  const description = stripHtml(currentMedia.description);

  return (
    <div className={`modal-backdrop video-backdrop cinema-backdrop ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="cinema-modal">
        <div className="cinema-modal-toolbar">
          <div className="cinema-modal-toolbar-copy">
            <span className="cinema-eyebrow">{currentMedia.folder_name}</span>
            <h2>{currentMedia.title}</h2>
          </div>
          <div className="cinema-modal-toolbar-actions">
            {onShare && (
              <button type="button" className="secondary-button dark" onClick={onShare}>
                <Share2 size={16} /> Share
              </button>
            )}
            {currentMedia.download_allowed && (
              <button type="button" className="secondary-button dark" onClick={download} disabled={downloading}>
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

        <div className="cinema-modal-screen-wrap">
          <PostNav onPrev={onPrev} onNext={onNext} hasPrev={hasPrev} hasNext={hasNext} />
          <div className="cinema-modal-screen" ref={stageRef}>
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
                  className="video-player cinema-player"
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
                <div className="player-controls cinema-controls">
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
        </div>

        <div className="cinema-modal-body">
          <div className="cinema-modal-details">
            <p className="cinema-description">{description || "No description provided."}</p>
            <div className="cinema-meta-row">
              <span>{formatBytes(currentMedia.file_size)}</span>
              <span>{formatDuration(currentMedia.duration_seconds)}</span>
              <span>{currentMedia.view_count} views</span>
              {currentMedia.tags.length ? <span>{currentMedia.tags.join(" · ")}</span> : null}
            </div>
            <div className="cinema-action-row">
              <button
                type="button"
                className={`cinema-action-btn${currentMedia.favorite ? " is-active" : ""}`}
                onClick={toggleFavorite}
              >
                <Star size={18} fill={currentMedia.favorite ? "currentColor" : "none"} />
                <span>{currentMedia.favorite ? "Bookmarked" : "Bookmark"}</span>
              </button>
              {onShare && (
                <button type="button" className="cinema-action-btn" onClick={onShare}>
                  <Share2 size={18} />
                  <span>Share</span>
                </button>
              )}
            </div>
            {showManagerPanels && (
              <div className="cinema-manager-panels">
                <nav className="cinema-manager-tabs" aria-label="Video administration">
                  <button
                    type="button"
                    className={managerPanel === "workflow" ? "active" : ""}
                    onClick={() => setManagerPanel("workflow")}
                  >
                    Workflow
                  </button>
                  {(isAdministrator || isSupervisor) ? (
                    <>
                      <button
                        type="button"
                        className={managerPanel === "versions" ? "active" : ""}
                        onClick={() => setManagerPanel("versions")}
                      >
                        Versions
                      </button>
                      <button
                        type="button"
                        className={managerPanel === "review" ? "active" : ""}
                        onClick={() => setManagerPanel("review")}
                      >
                        Review history
                      </button>
                    </>
                  ) : null}
                </nav>
                <div className="cinema-manager-panel-body">
                  {managerPanel === "workflow" && (
                    <MediaLifecyclePanel
                      media={currentMedia}
                      isAdministrator={Boolean(isAdministrator)}
                      isSupervisor={Boolean(isSupervisor)}
                      userId={userId}
                      onUpdated={(updated) => {
                        setCurrentMedia(updated);
                        onMediaChange?.(updated);
                      }}
                      onError={onError}
                    />
                  )}
                  {(isAdministrator || isSupervisor) && managerPanel === "versions" && (
                    <VersionHistoryPanel mediaId={currentMedia.id} />
                  )}
                  {(isAdministrator || isSupervisor) && managerPanel === "review" && (
                    <ReviewHistoryPanel mediaId={currentMedia.id} />
                  )}
                </div>
              </div>
            )}
            {hasMore && (
              <div className="cinema-more-section">
                <button type="button" className="cinema-more-toggle" onClick={() => setShowMore((value) => !value)}>
                  Chapters & transcript <ChevronDown size={14} className={showMore ? "is-open" : ""} />
                </button>
                {showMore && (
                  <div className="cinema-more-content">
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
          </div>

        </div>
      </div>
    </div>
  );
}
