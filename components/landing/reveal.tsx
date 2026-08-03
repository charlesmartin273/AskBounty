"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Scroll-reveal wrapper (ports Orionix's `useReveal`): children start 24px
 * low + transparent and settle when the block enters the viewport. Children
 * stay server-rendered - only this thin observer shell ships as client JS.
 * Reveals once; `prefers-reduced-motion` disables it entirely in CSS.
 */
export type RevealVariant = "up" | "blur" | "left" | "right" | "scale" | "fade";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "reveal",
  blur: "reveal-blur",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
  fade: "reveal-fade",
};

export function Reveal({
  children,
  delay = 0,
  blur = false,
  variant = "up",
  className = "",
}: {
  children: ReactNode;
  /** Stagger offset in ms (steps of 60-120 read best). */
  delay?: number;
  /** Legacy alias for variant="blur". */
  blur?: boolean;
  /** Entrance style - vary per section so the page doesn't repeat one move. */
  variant?: RevealVariant;
  /** Layout classes for the wrapper (e.g. "flex flex-1" inside card rows). */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (old browsers/test runners): just show.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={`${VARIANT_CLASS[blur ? "blur" : variant]} ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
