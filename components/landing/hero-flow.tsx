/**
 * Hero depth + centerpiece.
 *
 * HeroBackdrop - soft radial washes + SVG film grain (design-system.md §5.8).
 *
 * HeroFlow - the wow piece: the actual money flow drawn as a faint hairline
 * curve across the whole hero (Asker → Escrow → Agent → Winner), which
 * draws itself in after the headline lands, then a brand-red USDC coin
 * travels the path forever (SMIL animateMotion - zero JS). Escrow node
 * pulses to show where the money sits locked. Decorative (aria-hidden);
 * desktop-only - the curve needs the wide canvas.
 */

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 select-none">
      {/* Warm soft washes - stand-in for Orionix's blurred backdrop image.
          (Film grain now comes from the page-wide overlay in the marketing
          layout - a local copy here would double-expose the hero.) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(640px 420px at 18% 28%, rgb(0 0 0 / 0.045), transparent 70%)," +
            "radial-gradient(720px 480px at 84% 68%, rgb(0 0 0 / 0.05), transparent 70%)," +
            "radial-gradient(520px 320px at 60% 8%, rgb(255 0 0 / 0.02), transparent 70%)",
        }}
      />
    </div>
  );
}

/* One smooth curve through the four stations of the money flow.
   Coordinates live in the 1200x560 viewBox; the coin rides this exact
   path via animateMotion, so path and motion can never drift apart.
   Starts/ends OUTSIDE the viewBox so the line runs edge-to-edge and the
   coin enters and exits the scene instead of popping in place.

   Shape rule: the hero copy owns the CENTER of the shell, so the curve
   stays HIGH only in the outer wings and sags low through the middle -
   no node label may sit under the headline/CTA column. */
const FLOW_PATH =
  "M -60 170 C 60 175 240 430 380 430 C 520 430 680 430 820 430 C 960 430 1080 195 1260 175";

/* Escrow and Agent sit on the exact cubic-segment joins of FLOW_PATH;
   Asker and Winner are evaluated points ON the curve (t=0.4 of segment 1,
   t=0.65 of segment 3) - eyeballed coordinates drift off the line. */
const NODES = [
  { x: 106, y: 264, label: "ASKER", anchor: "start" },
  { x: 380, y: 430, label: "ESCROW · ERC-8183", anchor: "middle" },
  { x: 820, y: 430, label: "AGENT", anchor: "middle" },
  { x: 1090, y: 256, label: "WINNER", anchor: "end" },
] as const;

const MONO = "var(--font-geist-mono), monospace";

/**
 * Editorial corner marks: mono protocol facts printed in the shell's upper
 * corners plus crosshair glyphs at the side midpoints - the print-layout
 * trick that makes a large empty canvas read as intentional, not unfinished.
 */
export function HeroCorners() {
  return (
    <div
      aria-hidden="true"
      className="animate-enter pointer-events-none absolute inset-0 z-0 hidden select-none min-[810px]:block"
      style={{ "--enter-delay": "950ms" } as React.CSSProperties}
    >
      <div className="t-label absolute top-8 left-8 text-faint">
        <p>Agentic escrow</p>
        <p>ERC-8183</p>
      </div>
      <div className="t-label absolute top-8 right-8 text-right text-faint">
        <p>Arc Testnet</p>
        <p>Chain 5042002</p>
      </div>
      <span className="t-label absolute top-1/2 left-8 -translate-y-1/2 text-faint">+</span>
      <span className="t-label absolute top-1/2 right-8 -translate-y-1/2 text-faint">+</span>
    </div>
  );
}

export function HeroFlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 hidden select-none min-[810px]:block"
    >
      <svg
        viewBox="0 0 1200 560"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {/* The route - hairline ink, draws itself in */}
        <path
          d={FLOW_PATH}
          fill="none"
          stroke="rgb(0 0 0 / 0.12)"
          strokeWidth="1.5"
          className="animate-flow-draw"
        />

        {/* Stations */}
        {NODES.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="5" fill="#f9f8f6" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.5" />
            <text
              x={n.x}
              y={n.y + 26}
              textAnchor={n.anchor}
              fill="#a4a4a4"
              style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.36px" }}
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Escrow node pulses - the money sits locked here */}
        <circle
          cx={NODES[1].x}
          cy={NODES[1].y}
          r="8"
          fill="none"
          stroke="rgb(255 0 0 / 0.5)"
          strokeWidth="1.5"
          className="motion-reduce:hidden"
        >
          <animate attributeName="r" values="8;26" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0" dur="2.4s" repeatCount="indefinite" />
        </circle>

        {/* The coin: brand-red dot + amount, riding the exact same path
            forever. SMIL animateMotion - native SVG, no JS, no drift. */}
        <g className="motion-reduce:hidden">
          <circle r="7" fill="#ff0000" />
          <circle r="7" fill="#ff0000" opacity="0.25">
            <animate attributeName="r" values="7;14" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text
            x="14"
            y="4"
            fill="#141414"
            style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: "0.2px" }}
          >
            20 USDC
          </text>
          <animateMotion dur="8s" begin="1.4s" repeatCount="indefinite" path={FLOW_PATH} />
        </g>
      </svg>
    </div>
  );
}
