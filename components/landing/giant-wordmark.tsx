// Oversized wordmark fused into the closing CTA panel: it rises from the
// panel's bottom edge and gets half-cropped by the panel's overflow-clip
// (the Orionix footer move). Must be the LAST child of the ink section,
// which carries `overflow-clip` and no bottom padding of its own.
// aria-hidden - screen readers already got the real wordmark in the nav.
export function GiantWordmark() {
  return (
    <div aria-hidden="true" className="-mx-6 select-none min-[810px]:-mx-16">
      {/* -mb in em tracks the font size, so the crop depth scales with vw */}
      <p className="t-display -mb-[0.34em] whitespace-nowrap text-center text-[16vw] leading-none tracking-[-0.05em] text-cream opacity-[0.08] min-[1200px]:text-[190px]">
        AskBounty
      </p>
    </div>
  );
}
