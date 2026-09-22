"use client";

import { UniverDocsCorePreset } from "@univerjs/preset-docs-core";
import UniverPresetDocsCoreEnUS from "@univerjs/preset-docs-core/locales/en-US";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { useEffect, useRef } from "react";

import "@univerjs/preset-docs-core/lib/index.css";

function snapshotText(snapshot: Record<string, unknown> | null | undefined) {
  const body = (snapshot?.body || {}) as { dataStream?: string };
  return (body.dataStream || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

export default function UniverEditor({
  title,
  text,
  onChange,
  onFailed,
}: {
  title: string;
  text: string;
  onChange: (snapshotJson: string, plainText: string) => void;
  onFailed?: (error: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const textRef = useRef(text);
  const onFailedRef = useRef(onFailed);
  onChangeRef.current = onChange;
  textRef.current = text;
  onFailedRef.current = onFailed;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let api: { dispose?: () => void; getActiveDocument?: () => unknown } | undefined;
    let timer = 0;
    let cancelled = false;

    try {
      const created = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(UniverPresetDocsCoreEnUS),
        },
        presets: [
          UniverDocsCorePreset({
            container,
            toolbar: true,
            header: true,
            footer: true,
          }),
        ],
      });
      if (cancelled) {
        created.univerAPI.dispose?.();
        return;
      }
      api = created.univerAPI as typeof api;
      const univerApi = created.univerAPI as any;
      const document =
        univerApi.createUniverDoc?.({ name: title || "Document" }) ||
        univerApi.createDocument?.({ name: title || "Document" });
      const bodyText = (textRef.current || "").trim();
      if (bodyText && document?.appendText) {
        Promise.resolve(document.appendText(bodyText)).catch(() => undefined);
      }
      let lastText = bodyText;
      timer = window.setInterval(() => {
        const active = univerApi.getActiveDocument?.() || document;
        const snapshot = active?.getSnapshot?.() || null;
        const plain = snapshotText(snapshot);
        if (plain === lastText) return;
        lastText = plain;
        onChangeRef.current(JSON.stringify(snapshot || {}), plain);
      }, 2500);
    } catch (error) {
      onFailedRef.current?.(error);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try {
        api?.dispose?.();
      } catch {
        /* ignore dispose races from React Strict Mode */
      }
    };
  }, [title]);

  return <div ref={containerRef} className="h-full min-h-0 w-full" />;
}
