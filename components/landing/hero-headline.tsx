import type { CSSProperties } from "react";

/**
 * Per-character staggered hero headline (the Orionix hero move) - rendered
 * entirely on the server: each glyph is a span with an inline
 * animation-delay, so the cascade is pure CSS with zero client JS.
 * "paid" keeps the brand-red emphasis approved in decision 2.
 */
const LINES: ReadonlyArray<ReadonlyArray<{ text: string; brand?: boolean }>> = [
  [{ text: "Good answers," }],
  [{ text: "paid", brand: true }, { text: " instantly." }],
];

/** ms between consecutive glyphs; base offset lets the pill land first. */
const CHAR_STAGGER_MS = 20;
const BASE_DELAY_MS = 150;

export function HeroHeadline() {
  let charIndex = 0;
  return (
    <div className="flex flex-col items-center gap-1">
      {LINES.map((segments, lineIdx) => (
        <h1
          key={lineIdx}
          aria-label={segments.map((s) => s.text).join("")}
          className="t-display-48 whitespace-pre text-center text-ink min-[810px]:text-[72px] min-[810px]:leading-[76px] min-[810px]:tracking-[-2.88px] min-[1200px]:text-[88px] min-[1200px]:leading-[92px] min-[1200px]:tracking-[-3.52px]"
        >
          {segments.map((segment, segIdx) =>
            Array.from(segment.text).map((char, i) => {
              const delay = BASE_DELAY_MS + charIndex * CHAR_STAGGER_MS;
              charIndex += 1;
              return (
                <span
                  key={`${segIdx}-${i}`}
                  aria-hidden="true"
                  className={`animate-enter inline-block whitespace-pre ${segment.brand ? "text-brand" : ""}`}
                  style={{ animationDelay: `${delay}ms` } as CSSProperties}
                >
                  {char}
                </span>
              );
            }),
          )}
        </h1>
      ))}
    </div>
  );
}
