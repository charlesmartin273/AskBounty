/**
 * Full-bleed Fraunces marquee (the Orionix "Watch our reel ·" move).
 * Decorative: the same four words already appear in the sections around it,
 * so the strip is aria-hidden. Two identical halves + translateX(-50%) loop
 * = seamless infinite scroll, pure CSS.
 */
const WORDS = ["Ask", "Escrow", "Answer", "Get paid"] as const;

/* One word-set is ~1200px; the -50% loop is only seamless when a single
   half exceeds the viewport width, so each half repeats the set 3x
   (~3600px - covers ultrawide screens). */
const SET_REPEATS = 3;

function Half() {
  return (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {Array.from({ length: SET_REPEATS }).flatMap((_, rep) =>
        WORDS.map((word) => (
          <span key={`${rep}-${word}`} className="flex items-center gap-8">
            <span className="t-display-48 whitespace-pre text-faint min-[810px]:text-[64px] min-[810px]:leading-[68px] min-[810px]:tracking-[-2.56px]">
              {word}
            </span>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand" />
          </span>
        )),
      )}
    </div>
  );
}

/**
 * Both edges dissolve to nothing - the Orionix logo-grid mask trick.
 * Wide fade bands (30% of the strip per side) so only the middle third
 * reads at full ink and the words melt out long before the screen edge.
 */
const EDGE_FADE =
  "linear-gradient(90deg, transparent 0%, black 32%, black 68%, transparent 100%)";

const EDGE_FADE_MASK: React.CSSProperties = {
  maskImage: EDGE_FADE,
  WebkitMaskImage: EDGE_FADE,
};

export function MarqueeStrip() {
  return (
    // Full-bleed: breaks out of the page container to span the entire
    // viewport width - the strip should touch both screen edges.
    <div
      aria-hidden="true"
      style={EDGE_FADE_MASK}
      className="relative left-1/2 w-screen -translate-x-1/2 select-none overflow-hidden py-8 min-[810px]:py-10"
    >
      {/* Duration scales with SET_REPEATS so the glide speed stays calm */}
      <div
        className="flex w-max animate-marquee-x"
        style={{ "--marquee-duration": `${SET_REPEATS * 32}s` } as React.CSSProperties}
      >
        <Half />
        <Half />
      </div>
    </div>
  );
}
