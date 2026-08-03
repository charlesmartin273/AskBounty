import { Reveal } from "./reveal";

// Protocol facts as big display numbers. Every figure is a mechanism
// guarantee (README), not a usage metric - nothing here can go stale.
const STATS = [
  {
    value: "100%",
    label: "of the bounty escrowed onchain before the question goes live",
  },
  {
    value: "0",
    label: "USDC the agent keeps from any payout - full amount forwarded",
  },
  {
    value: "2",
    label: "public receipts per payout, both linked on Arcscan",
  },
  {
    value: "1st",
    label: "passing answer wins - evaluation order is submission order",
  },
] as const;

export function StatsStrip() {
  return (
    <section className="grid grid-cols-2 gap-4 px-2 pt-16 pb-10 min-[810px]:grid-cols-4 min-[810px]:gap-6 min-[810px]:pt-24 min-[1200px]:px-10">
      {STATS.map((s, i) => (
        // Big numbers sharpen out of a blur, 80ms stagger left-to-right
        <Reveal key={s.value} variant="blur" delay={i * 80}>
          <div className="flex flex-col gap-3 border-t border-line-3 pt-5">
            <span className="t-display-48 text-ink">{s.value}</span>
            <span className="t-body-14 text-muted-ink">{s.label}</span>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
