"use client";

import { useCallback, useRef, type MouseEvent, type TouchEvent } from "react";

const DEFAULT_DELAY_MS = 480;

export function useLongPress(
  onLongPress: () => void,
  { delay = DEFAULT_DELAY_MS }: { delay?: number } = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    firedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, delay);
  }, [clear, delay, onLongPress]);

  const consumeLongPress = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const bind = useCallback(
    () => ({
      onTouchStart: (event: TouchEvent) => {
        if (event.touches.length > 1) return;
        start();
      },
      onTouchEnd: clear,
      onTouchCancel: clear,
      onTouchMove: clear,
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
      },
    }),
    [clear, start],
  );

  return { bind, consumeLongPress, clear };
}
