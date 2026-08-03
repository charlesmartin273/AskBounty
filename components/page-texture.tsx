import { GRAIN_URI } from "@/components/landing/grain";

/**
 * The two page-wide texture layers (design-system.md §5.8), shared by both
 * route groups so landing and app read as one product on one paper stock:
 *   1. soft coffee/rose washes that scroll with the content
 *   2. film grain over everything, pointer-transparent
 *
 * Intensity is the ONLY difference between the two groups:
 *   "display" - the marketing page, allowed to show the material off
 *   "work"    - the app, where copy, amounts and hashes must stay crisp;
 *               same masses and positions, roughly a third of the strength
 */
export type TextureIntensity = "display" | "work";

/** One wash mass. Alpha here is the "display" value; "work" scales it down. */
const WASHES = [
  /* mocha, top right - the anchor of the whole wash */
  { size: "1100px 780px", at: "86% 4%", rgb: "120 82 52", alpha: 0.15, stop: 62 },
  /* rose, upper left - answers the mocha across the fold */
  { size: "900px 640px", at: "2% 18%", rgb: "214 128 146", alpha: 0.13, stop: 64 },
  /* espresso, mid right - the deepest brown */
  { size: "1150px 800px", at: "98% 54%", rgb: "96 66 44", alpha: 0.14, stop: 66 },
  /* rose again, centre left, so pink is never only an edge effect */
  { size: "1000px 720px", at: "22% 62%", rgb: "206 118 138", alpha: 0.12, stop: 66 },
  /* latte, lower left */
  { size: "950px 700px", at: "8% 88%", rgb: "150 112 74", alpha: 0.14, stop: 66 },
  /* dusty rose, bottom right - closes the page on the pink side */
  { size: "900px 620px", at: "82% 96%", rgb: "200 116 134", alpha: 0.11, stop: 70 },
  /* neutral mass through the middle - keeps the centre from going sepia */
  { size: "1000px 700px", at: "50% 42%", rgb: "0 0 0", alpha: 0.022, stop: 62 },
] as const;

const WASH_SCALE: Record<TextureIntensity, number> = { display: 1, work: 0.34 };
const GRAIN_OPACITY: Record<TextureIntensity, number> = { display: 0.04, work: 0.016 };

/** First layer paints on top; each mass fades out well before its edge. */
function washes(intensity: TextureIntensity): string {
  const scale = WASH_SCALE[intensity];
  return WASHES.map(
    (w) =>
      `radial-gradient(${w.size} at ${w.at}, rgb(${w.rgb} / ${(w.alpha * scale).toFixed(4)}), transparent ${w.stop}%)`,
  ).join(",");
}

export function PageTexture({ intensity }: { intensity: TextureIntensity }) {
  return (
    <>
      {/* Washes scroll with the page - they belong to the paper, not the screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 select-none"
        style={{ background: washes(intensity) }}
      />
      {/* Grain is fixed and sits above content, saturation stripped */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] select-none saturate-0"
        style={{
          backgroundImage: GRAIN_URI,
          backgroundSize: "120px 120px",
          opacity: GRAIN_OPACITY[intensity],
        }}
      />
    </>
  );
}
