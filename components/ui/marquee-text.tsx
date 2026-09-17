"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Animation duration in seconds (slower = higher) */
  duration?: number;
}

/**
 * Text that scrolls horizontally (marquee) only when it overflows its
 * container — otherwise it renders as a normal static label.
 * Use for labels that get truncated on narrow screens (e.g. "Not checked in",
 * long dates, assignment titles).
 */
export function MarqueeText({ text, className, duration = 6 }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const check = () => {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      setOverflows(t.scrollWidth > c.clientWidth + 2);
    };
    check();
    // Re-check when the text changes or the viewport resizes
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden w-full", className)}
      style={{ "--marquee-container": "100%" } as React.CSSProperties}
    >
      <span
        ref={textRef}
        className={cn(
          "inline-block whitespace-nowrap max-w-full truncate",
          overflows && "!max-w-none !overflow-visible marquee-scroll"
        )}
        style={
          overflows
            ? ({ "--marquee-duration": `${duration}s`, "--marquee-container": "100%" } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
