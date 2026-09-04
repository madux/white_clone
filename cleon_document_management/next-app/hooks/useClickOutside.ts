import { RefObject, useEffect } from "react";

export function useClickOutside<T extends HTMLElement>(ref: RefObject<T | null>, onOutside: () => void, extraRefs: RefObject<HTMLElement | null>[] = []) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || extraRefs.some((extraRef) => extraRef.current?.contains(target))) return;
      onOutside();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [extraRefs, onOutside, ref]);
}
