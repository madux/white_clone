/** Position a fixed action menu beside a trigger, keeping it inside the viewport. */
export function positionActionMenu(
  triggerRect: DOMRect,
  menuSize: { width: number; height: number },
  options?: { gap?: number; padding?: number },
): { top: number; left: number } {
  const gap = options?.gap ?? 8;
  const padding = options?.padding ?? 12;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const menuWidth = menuSize.width;
  const menuHeight = menuSize.height;

  let top = triggerRect.bottom + gap;
  if (top + menuHeight > viewportH - padding) {
    const above = triggerRect.top - menuHeight - gap;
    if (above >= padding) {
      top = above;
    } else {
      top = Math.max(padding, viewportH - menuHeight - padding);
    }
  }
  top = Math.max(padding, Math.min(top, viewportH - menuHeight - padding));

  let left = triggerRect.right - menuWidth;
  left = Math.max(padding, Math.min(left, viewportW - menuWidth - padding));

  return { top, left };
}
