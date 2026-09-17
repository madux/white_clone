"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  children: ReactNode;
  className?: string;
};

/** Smooth expand/collapse for employee file tree sections. */
export default function AnimatedTreeCollapse({
  open,
  children,
  className = "",
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [revealed, setRevealed] = useState(open);
  const skipNextOpenAnimation = useRef(open);

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }

    setMounted(true);

    if (skipNextOpenAnimation.current) {
      skipNextOpenAnimation.current = false;
      setRevealed(true);
      return;
    }

    setRevealed(false);
    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => setRevealed(true));
    });

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <div
      className={`employee-tree-collapse ${revealed ? "is-open" : ""} ${className}`.trim()}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName !== "grid-template-rows") return;
        if (!open) setMounted(false);
      }}
    >
      <div className="employee-tree-collapse-inner">{children}</div>
    </div>
  );
}
