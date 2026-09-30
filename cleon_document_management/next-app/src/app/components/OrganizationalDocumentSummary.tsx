"use client";

import { RefreshCw, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { api } from "../../../lib/api";

const summaryCache = new Map<number, string>();
const FAB_SIZE = 58;
const FAB_PAD = 16;
const DRAG_THRESHOLD = 8;

const LOADING_STEPS = [
  "Reading the document",
  "Finding the key points",
  "Writing a briefing",
];

function parseSummary(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const points = lines
    .filter((line) => line.startsWith("•"))
    .map((line) => line.replace(/^•\s*/, ""));
  const rest = lines.filter((line) => !line.startsWith("•"));
  return {
    overview: rest[0] || (points.length ? "" : text.trim()),
    points,
    closing: rest.slice(1).join(" "),
  };
}

function clampFab(x: number, y: number, width: number, height: number) {
  return {
    x: Math.min(Math.max(FAB_PAD, x), Math.max(FAB_PAD, width - FAB_SIZE - FAB_PAD)),
    y: Math.min(Math.max(FAB_PAD, y), Math.max(FAB_PAD, height - FAB_SIZE - FAB_PAD)),
  };
}

function AnimatedRobot({ busy }: { busy: boolean }) {
  return (
    <span className={`org-ai-robot${busy ? " is-busy" : ""}`} aria-hidden="true">
      <span className="org-ai-robot__antenna">
        <span className="org-ai-robot__antenna-tip" />
      </span>
      <span className="org-ai-robot__head">
        <span className="org-ai-robot__ear org-ai-robot__ear--left" />
        <span className="org-ai-robot__ear org-ai-robot__ear--right" />
        <span className="org-ai-robot__visor">
          <span className="org-ai-robot__scan" />
          <span className="org-ai-robot__eye" />
          <span className="org-ai-robot__eye" />
        </span>
        <span className="org-ai-robot__mouth" />
      </span>
    </span>
  );
}

export default function OrganizationalDocumentSummary({
  documentId,
  documentName,
  children,
}: {
  documentId: number;
  documentName: string;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState(() => summaryCache.get(documentId) || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const loadSummary = useCallback(
    async (force = false) => {
      if (!force) {
        const cached = summaryCache.get(documentId);
        if (cached) {
          setSummary(cached);
          setLoading(false);
          setError("");
          return;
        }
      }
      setLoading(true);
      setError("");
      try {
        const result = await api.summarizeOrganizationalDocument(documentId);
        const next = result.data?.summary?.trim() || "";
        if (!next) {
          setError("The model did not return a summary.");
          if (force) setSummary("");
          return;
        }
        summaryCache.set(documentId, next);
        setSummary(next);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Unable to summarize this document.";
        setError(
          /timeout/i.test(message)
            ? "The summary took too long. Try again."
            : message,
        );
        if (force) setSummary("");
      } finally {
        setLoading(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    setOpen(false);
    setSummary(summaryCache.get(documentId) || "");
    setError("");
    setLoading(false);
    setFabPos(null);
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    void loadSummary(false);
  }, [open, loadSummary]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % LOADING_STEPS.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [loading]);

  const keepFabInView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !fabPos) return;
    const next = clampFab(fabPos.x, fabPos.y, stage.clientWidth, stage.clientHeight);
    if (next.x !== fabPos.x || next.y !== fabPos.y) setFabPos(next);
  }, [fabPos]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => keepFabInView());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [keepFabInView]);

  const parsed = useMemo(() => parseSummary(summary), [summary]);
  const cached = summaryCache.has(documentId);

  const startFabDrag = (
    clientX: number,
    clientY: number,
    pointerId: number,
    target?: HTMLElement,
  ) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const current = fabPos ?? {
      x: rect.width - FAB_SIZE - FAB_PAD,
      y: rect.height - FAB_SIZE - FAB_PAD,
    };
    dragRef.current = {
      pointerId,
      dragging: true,
      moved: false,
      startX: clientX,
      startY: clientY,
      origX: current.x,
      origY: current.y,
    };
    setDragging(true);
    if (target && pointerId >= 0) {
      try {
        target.setPointerCapture(pointerId);
      } catch {
        /* capture is optional; window listeners still move the circle */
      }
    }
  };

  const moveFabDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;
    const stage = stageRef.current;
    if (!stage) return;
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setFabPos(
      clampFab(drag.origX + dx, drag.origY + dy, stage.clientWidth, stage.clientHeight),
    );
  };

  const endFabDrag = (pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag.dragging) return;
    if (pointerId != null && drag.pointerId >= 0 && pointerId !== drag.pointerId) return;
    const moved = drag.moved;
    drag.dragging = false;
    drag.pointerId = -1;
    drag.moved = false;
    setDragging(false);
    if (!moved) setOpen((current) => !current);
  };

  const moveFabDragRef = useRef(moveFabDrag);
  const endFabDragRef = useRef(endFabDrag);
  moveFabDragRef.current = moveFabDrag;
  endFabDragRef.current = endFabDrag;

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) =>
      moveFabDragRef.current(event.clientX, event.clientY);
    const onMouseMove = (event: MouseEvent) =>
      moveFabDragRef.current(event.clientX, event.clientY);
    const onPointerUp = (event: PointerEvent) => endFabDragRef.current(event.pointerId);
    const onMouseUp = () => endFabDragRef.current();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const onFabPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startFabDrag(event.clientX, event.clientY, event.pointerId, event.currentTarget);
  };

  const onFabMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || dragRef.current.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    startFabDrag(event.clientX, event.clientY, -2);
  };

  return (
    <div className={`org-ai-viewer${open ? " is-open" : ""}${dragging ? " is-repositioning" : ""}`}>
      <div ref={stageRef} className="org-ai-viewer__doc">
        <div className="org-ai-viewer__frame">{children}</div>
        <button
          type="button"
          className={`org-ai-fab${open ? " is-open" : ""}${loading ? " is-busy" : ""}${fabPos ? " is-placed" : ""}${dragging ? " is-dragging" : ""}`}
          style={fabPos ? { left: fabPos.x, top: fabPos.y } : undefined}
          aria-expanded={open}
          aria-label={open ? "Hide AI document summary" : "Show AI document summary"}
          draggable={false}
          onPointerDown={onFabPointerDown}
          onMouseDown={onFabMouseDown}
        >
          <AnimatedRobot busy={loading} />
        </button>
      </div>
      {open ? (
        <aside className="org-ai-summary" aria-live="polite" aria-busy={loading}>
          <header className="org-ai-summary__header">
            <div>
              <p className="org-ai-summary__kicker">AI briefing</p>
              <p className="org-ai-summary__title">Document summary</p>
            </div>
            <div className="org-ai-summary__actions">
              {cached || summary ? (
                <button
                  type="button"
                  onClick={() => void loadSummary(true)}
                  className="org-ai-summary__ghost"
                  disabled={loading}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refine
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="org-ai-summary__close"
                aria-label="Close summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="org-ai-summary__body">
            {loading ? (
              <div className="org-ai-summary__loading">
                <div className="org-ai-scan" aria-hidden="true">
                  <div className="org-ai-scan__page">
                    <span className="org-ai-scan__rule" />
                    <span className="org-ai-scan__rule" />
                    <span className="org-ai-scan__rule" />
                    <span className="org-ai-scan__rule" />
                    <span className="org-ai-scan__beam" />
                  </div>
                  <div className="org-ai-scan__rings">
                    <span className="org-ai-scan__ring" />
                    <span className="org-ai-scan__ring" />
                    <span className="org-ai-scan__core" />
                  </div>
                  <div className="org-ai-scan__orbit">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <p className="org-ai-summary__status">{LOADING_STEPS[stepIndex]}</p>
                <p className="org-ai-summary__status-sub">
                  Preparing a concise briefing for {documentName}
                </p>
              </div>
            ) : error && !summary ? (
              <div className="org-ai-summary__empty">
                <p className="org-ai-summary__error">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadSummary(true)}
                  className="org-ai-summary__cta"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="org-ai-summary__content">
                {error ? <p className="org-ai-summary__error">{error}</p> : null}
                {parsed.overview ? (
                  <p className="org-ai-summary__overview">{parsed.overview}</p>
                ) : null}
                {parsed.points.length ? (
                  <ul className="org-ai-summary__points">
                    {parsed.points.map((point, index) => (
                      <li key={`${index}-${point.slice(0, 24)}`} className="org-ai-summary__point">
                        <span className="org-ai-summary__point-mark" aria-hidden="true">
                          •
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {parsed.closing ? (
                  <p className="org-ai-summary__closing">{parsed.closing}</p>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
