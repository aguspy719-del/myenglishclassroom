"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Fixed animation duration in seconds (default: auto, based on distance) */
  duration?: number;
}

/**
 * Text that scrolls horizontally (marquee) only when it overflows its
 * container — otherwise it renders as a normal static label.
 * The scroll distance is measured in pixels (text width − container width),
 * so the animation always travels exactly far enough to reveal the whole text.
 */
export function MarqueeText({ text, className, duration }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  /** Overflow in px, or null when the text fits (no animation) */
  const [shift, setShift] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      const overflow = t.scrollWidth - c.clientWidth;
      setShift(overflow > 4 ? overflow : null);
    };
    check();
    // Re-check when layout changes (viewport rotate, container resize, font load)
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    if (textRef.current) ro.observe(textRef.current);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [text]);

  // Longer distances scroll slower so the text stays readable
  const animDuration = duration ?? (shift ? Math.max(4, Math.min(12, shift / 25)) : 6);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden w-full", className)}>
      <span
        ref={textRef}
        className={cn(
          "inline-block whitespace-nowrap",
          shift === null ? "max-w-full truncate" : "marquee-scroll"
        )}
        style={
          shift !== null
            ? ({ "--marquee-shift": `${-shift}px`, "--marquee-duration": `${animDuration}s` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
