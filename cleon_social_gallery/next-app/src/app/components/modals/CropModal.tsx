"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { GalleryMedia } from "@/lib/types";
import { uploadSocialFile } from "@/lib/uploadSocialFile";
import { ModalShell } from "../shared/ModalShell";

type CropRect = { x: number; y: number; w: number; h: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function CropModal({
  media,
  assetUrl,
  onClose,
  onComplete,
  onError,
}: {
  media: GalleryMedia;
  assetUrl: string;
  onClose: () => void;
  onComplete: () => void;
  onError?: (message: string) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  const syncDisplaySize = useCallback(() => {
    const img = imageRef.current;
    const frame = frameRef.current;
    if (!img || !frame) return;
    const rect = img.getBoundingClientRect();
    setDisplay({ w: rect.width, h: rect.height });
    if (!crop.w && natural.w) {
      const margin = Math.min(rect.width, rect.height) * 0.1;
      setCrop({
        x: margin,
        y: margin,
        w: rect.width - margin * 2,
        h: rect.height - margin * 2,
      });
    }
  }, [crop.w, natural.w]);

  useEffect(() => {
    syncDisplaySize();
    window.addEventListener("resize", syncDisplaySize);
    return () => window.removeEventListener("resize", syncDisplaySize);
  }, [syncDisplaySize, natural]);

  const onPointerDown = (event: React.PointerEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    setDragging(true);
    setOrigin({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    setCrop({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, w: 0, h: 0 });
    frame.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging || !frameRef.current) return;
    const bounds = frameRef.current.getBoundingClientRect();
    const x = clamp(event.clientX - bounds.left, 0, display.w);
    const y = clamp(event.clientY - bounds.top, 0, display.h);
    const left = Math.min(origin.x, x);
    const top = Math.min(origin.y, y);
    const w = Math.abs(x - origin.x);
    const h = Math.abs(y - origin.y);
    setCrop({ x: left, y: top, w, h });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    setDragging(false);
    frameRef.current?.releasePointerCapture(event.pointerId);
  };

  const applyCrop = async () => {
    const img = imageRef.current;
    if (!img || !natural.w || crop.w < 8 || crop.h < 8) {
      onError?.("Draw a crop region on the image.");
      return;
    }
    const scaleX = natural.w / display.w;
    const scaleY = natural.h / display.h;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      onError?.("Could not process image.");
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    setUploading(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), media.mime_type || "image/jpeg", 0.92);
      });
      const ext = (media.file_name || "crop.jpg").replace(/^.*(\.[^.]+)$/, "$1") || ".jpg";
      const file = new File([blob], `crop${ext}`, { type: blob.type });
      await uploadSocialFile({
        file,
        displayName: media.display_name,
        description: media.description,
        albumId: media.album_id || undefined,
        replaceMediaId: media.id,
        onProgress: setProgress,
      });
      onComplete();
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Crop upload failed");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <ModalShell title="Crop image" eyebrow="Media" onClose={onClose} wide>
      <div className="modal-form">
        <p className="meta-muted">Drag on the image to select the area to keep. Saving replaces the file and may trigger re-review.</p>
        <div
          ref={frameRef}
          className="crop-frame"
          style={{ position: "relative", maxWidth: "100%", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            ref={imageRef}
            src={assetUrl}
            alt={media.display_name}
            style={{ display: "block", maxWidth: "100%", maxHeight: "60vh", userSelect: "none" }}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              syncDisplaySize();
            }}
            draggable={false}
          />
          {crop.w > 0 && (
            <div
              style={{
                position: "absolute",
                left: crop.x,
                top: crop.y,
                width: crop.w,
                height: crop.h,
                border: "2px solid var(--sg-accent, #2563eb)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
        {progress && <p className="meta-muted">{progress}</p>}
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={uploading} onClick={onClose}>Cancel</button>
        <button type="button" className="primary-button" disabled={uploading} onClick={applyCrop}>
          {uploading ? <LoaderCircle size={16} className="spin" /> : null}
          Save crop
        </button>
      </div>
    </ModalShell>
  );
}
