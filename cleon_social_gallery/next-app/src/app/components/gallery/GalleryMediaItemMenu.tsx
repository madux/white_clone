"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical, ExternalLink, FolderInput, Trash2 } from "lucide-react";
import type { GalleryAlbum } from "@/lib/types";

type PanelStyle = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below";
};

export function GalleryMediaItemMenu({
  albums,
  onOpen,
  onMove,
  onDelete,
}: {
  albums: GalleryAlbum[];
  onOpen: () => void;
  onMove: (albumId: number) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAlbums, setShowAlbums] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(260, vw - margin * 2);
    let left = rect.right - width;
    if (left < margin) left = margin;
    if (left + width > vw - margin) left = vw - width - margin;

    const panelEl = panelRef.current;
    const measured = panelEl?.getBoundingClientRect().height ?? 0;
    const estimated = showAlbums
      ? Math.min(280, 56 + albums.length * 40)
      : 148;
    const menuHeight = measured > 0 ? measured : estimated;

    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow;

    if (openAbove) {
      setPanelStyle({
        bottom: vh - rect.top + gap,
        left,
        width,
        maxHeight: Math.max(120, Math.min(320, spaceAbove)),
        placement: "above",
      });
      return;
    }

    setPanelStyle({
      top: rect.bottom + gap,
      left,
      width,
      maxHeight: Math.max(120, Math.min(320, spaceBelow)),
      placement: "below",
    });
  }, [albums.length, showAlbums]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    positionPanel();
    const frame = requestAnimationFrame(() => positionPanel());
    return () => cancelAnimationFrame(frame);
  }, [open, showAlbums, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => positionPanel();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target)
        || panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setShowAlbums(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const close = () => {
    setOpen(false);
    setShowAlbums(false);
  };

  return (
    <div className="gallery-media-menu">
      <button
        ref={triggerRef}
        type="button"
        className="gallery-media-menu-trigger"
        aria-label="Media actions"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
          setShowAlbums(false);
        }}
      >
        <EllipsisVertical size={18} />
      </button>
      {open && panelStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className={`gallery-media-menu-panel gallery-media-menu-panel--fixed gallery-media-menu-panel--${panelStyle.placement}`}
              style={{
                top: panelStyle.top,
                bottom: panelStyle.bottom,
                left: panelStyle.left,
                width: panelStyle.width,
                maxHeight: panelStyle.maxHeight,
              }}
              role="menu"
            >
              {!showAlbums ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="gallery-media-menu-item"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      onOpen();
                    }}
                  >
                    <ExternalLink size={16} aria-hidden />
                    View details
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="gallery-media-menu-item"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAlbums(true);
                    }}
                  >
                    <FolderInput size={16} aria-hidden />
                    Move to album
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="gallery-media-menu-item gallery-media-menu-item--danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      close();
                      onDelete();
                    }}
                  >
                    <Trash2 size={16} aria-hidden />
                    Delete
                  </button>
                </>
              ) : (
                <div className="gallery-media-menu-albums" role="group" aria-label="Choose album">
                  <p className="gallery-media-menu-albums-title">Move to album</p>
                  <ul>
                    {albums.map((album) => (
                      <li key={album.id}>
                        <button
                          type="button"
                          className="gallery-media-menu-item"
                          onClick={(event) => {
                            event.stopPropagation();
                            close();
                            onMove(album.id);
                          }}
                        >
                          {album.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="gallery-media-menu-back"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowAlbums(false);
                    }}
                  >
                    Back
                  </button>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
